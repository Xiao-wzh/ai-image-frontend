/**
 * TOS 上传 Worker 进程
 *
 * 启动方式：npm run worker:tos-upload
 *
 * 特性：
 * - 并发数=3，防止带宽爆炸
 * - 幂等入队（generationId 作为 jobId）
 * - 最多重试 5 次，指数退避
 * - CAS 乐观锁防止并发双重退款
 * - 清道夫 Repeatable Job：每小时清理 2 小时前的孤儿临时文件
 */

import "dotenv/config"
import fs from "fs/promises"
import path from "path"
import { Worker, Job, Queue } from "bullmq"
import { imageSizeFromFile } from "image-size/fromFile"
import pLimit from "p-limit"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import {
  TOS_UPLOAD_QUEUE_NAME,
  TosUploadJobData,
  TosUploadJobResult,
  getTosUploadQueue,
} from "../lib/tos-upload-queue"
import { tosClient, TOS_BUCKET } from "../lib/tos"
import { refundCredits } from "../lib/credit-service"
import { keyToCdnUrl } from "../lib/cdnUrl"
import { sliceImages } from "../lib/image-slicer"

const CONCURRENCY = 3
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1"
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379")
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined
const N8N_HOST_TEMP_PATH = process.env.N8N_HOST_TEMP_PATH || "/opt/stack/n8n_files/temp"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL 未配置")
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter }) as any

console.log(`✅ TOS Upload Worker 已启动 | 并发数=${CONCURRENCY} | Redis=${REDIS_HOST}:${REDIS_PORT}`)

/** 上传单个文件到 TOS，返回 objectKey */
async function uploadFileToTos(filePath: string, objectKey: string): Promise<string> {
  const buffer = await fs.readFile(filePath)
  await tosClient.putObject({
    bucket: TOS_BUCKET,
    key: objectKey,
    body: buffer,
    contentType: "image/png",
  })
  return objectKey
}

/** 删除宿主机临时文件（静默失败） */
async function cleanupTempFiles(filePaths: (string | undefined)[]): Promise<void> {
  await Promise.allSettled(
    filePaths
      .filter((p): p is string => !!p)
      .map((p) => fs.unlink(p).catch((e) => console.warn(`[TOS-Worker] ⚠  删除临时文件失败: ${p} — ${e.message}`)))
  )
}

// ── 主 Worker ──
const worker = new Worker<TosUploadJobData, TosUploadJobResult>(
  TOS_UPLOAD_QUEUE_NAME,
  async (job: Job<TosUploadJobData, TosUploadJobResult>) => {
    const {
      generationId, userId, hostFilePaths, hostFullImagePath,
      imageCount, costPerImage, totalCost, qualityMode, taskType,
      jobType = "GENERATE", imageIndex,
    } = job.data

    const shortId = generationId.slice(0, 8)
    const retryTag = job.attemptsMade > 0 ? ` (重试#${job.attemptsMade})` : ""
    const startTime = Date.now()

    // ── EDIT 模式：上传单张编辑图片，替换 generatedImages[imageIndex] ──
    if (jobType === "EDIT") {
      if (typeof imageIndex !== "number") throw new Error("EDIT 模式缺少 imageIndex")
      const filePath = hostFilePaths[0]
      if (!filePath) throw new Error("EDIT 模式缺少文件路径")

      // 先查询当前状态，验证 imageIndex 是否有效
      const generation = await prisma.generation.findUnique({
        where: { id: generationId },
        select: { generatedImages: true, editingImageIndexes: true },
      })
      if (!generation) throw new Error(`Generation 不存在: ${generationId}`)

      // 验证 imageIndex 是否在 editingImageIndexes 中
      // 如果不在，使用 editingImageIndexes 中的第一个索引（修复 N8N 返回错误索引的问题）
      let actualIndex = imageIndex
      const editingIndexes = generation.editingImageIndexes || []
      if (!editingIndexes.includes(imageIndex)) {
        if (editingIndexes.length > 0) {
          actualIndex = editingIndexes[0]
          console.warn(`[TOS-Worker] ⚠  ${shortId}... N8N返回的imageIndex=${imageIndex}不在编辑列表${JSON.stringify(editingIndexes)}中，使用actualIndex=${actualIndex}`)
        } else {
          // 没有编辑中的索引，可能已被其他进程处理，直接返回成功
          console.warn(`[TOS-Worker] ⏭  ${shortId}... 没有编辑中的图片，跳过`)
          return { success: true, imageKeys: [] }
        }
      }

      console.log(`[TOS-Worker] ▶  ${shortId}... | EDIT 图片#${actualIndex + 1}${retryTag}`)

      const objectKey = `generations/${generationId}/edit_${actualIndex + 1}_${Date.now()}.png`
      await uploadFileToTos(filePath, objectKey)

      const updatedImages = [...generation.generatedImages]
      updatedImages[actualIndex] = keyToCdnUrl(objectKey)

      // 清除实际使用的索引
      const cleanedIndexes = editingIndexes.filter((idx: number) => idx !== actualIndex)

      console.log(`[TOS-Worker] 📝 更新数据库: actualIndex=${actualIndex}, editingIndexes=${JSON.stringify(editingIndexes)}, cleanedIndexes=${JSON.stringify(cleanedIndexes)}`)

      // 使用事务原子性更新，确保 generatedImages 和 editingImageIndexes 同时成功或失败
      await prisma.$transaction(async (tx: any) => {
        // 第一步：更新 generatedImages
        await tx.generation.update({
          where: { id: generationId },
          data: { generatedImages: updatedImages },
        })

        // 第二步：更新 editingImageIndexes（空数组使用原生 SQL）
        if (cleanedIndexes.length === 0) {
          await tx.$executeRaw`UPDATE "Generation" SET "editingImageIndexes" = '{}' WHERE id = ${generationId}::uuid`
        } else {
          await tx.generation.update({
            where: { id: generationId },
            data: { editingImageIndexes: cleanedIndexes },
          })
        }
      })

      console.log(`[TOS-Worker] ✅ 数据库更新完成`)

      await cleanupTempFiles([filePath])

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1)
      const counts = await getTosUploadQueue().getJobCounts()
      const waitingJobs = (counts.waiting ?? 0) + (counts.delayed ?? 0)
      const inProgressJobs = Math.max(0, (counts.active ?? 1) - 1)
      console.log(`[TOS-Worker] ✅ EDIT 图片#${actualIndex + 1} | ${shortId}... 完成(${elapsedSec}s) | 队列: ${waitingJobs}个Job等待 ${inProgressJobs}个Job进行中`)

      return { success: true, imageKeys: [objectKey] }
    }

    // ── GENERATE 模式（原有逻辑） ──
    // 计算实际要上传的文件数
    const uploadFileCount = qualityMode === "STANDARD" ? 1 : hostFilePaths.length
    console.log(`[TOS-Worker] ▶  ${shortId}... | ${qualityMode} ${taskType} 上传${uploadFileCount}个文件${retryTag}`)

    let finalImageKeys: string[]
    let fullImageKey: string | undefined

    if (qualityMode === "STANDARD") {
      const sourcePath = hostFullImagePath || hostFilePaths[0]
      if (!sourcePath) throw new Error("STANDARD 模式缺少合并大图文件路径")

      // 读取真实尺寸（本地文件，零带宽）
      let actualWidth = 0
      let actualHeight = 0
      try {
        const dim = await imageSizeFromFile(sourcePath)
        actualWidth = dim?.width ?? 0
        actualHeight = dim?.height ?? 0
      } catch (e: any) {
        console.warn(`[TOS-Worker] ⚠  读取图片尺寸失败，使用默认值 — ${e.message}`)
      }

      const objectKey = `generations/${generationId}/full.png`
      await uploadFileToTos(sourcePath, objectKey)
      fullImageKey = objectKey

      const fullCdnUrl = keyToCdnUrl(objectKey) as string
      const slicedUrls = sliceImages({ qualityMode, taskType, fullImageUrl: fullCdnUrl, actualWidth, actualHeight })

      if (slicedUrls.length === 0) throw new Error("切图结果为空")
      finalImageKeys = slicedUrls

    } else {
      // PRO 模式：并发上传所有分图（限速：每个 Job 内最多 3 张同时上传）
      const limit = pLimit(3)
      const uploadResults = await Promise.allSettled(
        hostFilePaths.map((filePath, index) =>
          limit(() => uploadFileToTos(filePath, `generations/${generationId}/image_${index + 1}.png`))
        )
      )

      finalImageKeys = []
      for (const result of uploadResults) {
        if (result.status === "fulfilled") {
          // 转换为 CDN URL
          finalImageKeys.push(keyToCdnUrl(result.value) as string)
        }
      }

      if (hostFullImagePath) {
        fullImageKey = await uploadFileToTos(
          hostFullImagePath,
          `generations/${generationId}/full.png`
        ).catch(() => undefined)
      }

      if (finalImageKeys.length === 0) throw new Error(`全部 ${hostFilePaths.length} 张分图上传失败`)
    }

    // ── 计算状态和退款 ──
    const successCount = finalImageKeys.length

    let finalStatus: string
    let refundAmount: number

    if (qualityMode === "STANDARD") {
      // STANDARD 模式：只有 1 张大图，裁剪成 N 张 URL
      // 要么全部成功（裁剪完成），要么全部失败（大图上传失败）
      finalStatus = successCount > 0 ? "COMPLETED" : "FAILED"
      refundAmount = successCount > 0 ? 0 : totalCost
    } else {
      // PRO 模式：N 张独立图片，可能部分失败
      const failedCount = Math.max(imageCount - successCount, 0)
      finalStatus = successCount === 0 ? "FAILED" : failedCount > 0 ? "PARTIAL_SUCCESS" : "COMPLETED"

      // 关键修复：全部失败退还 totalCost，部分失败按 costPerImage 退款
      refundAmount = successCount === 0 ? totalCost : (failedCount * costPerImage)
    }

    // ── CAS 乐观锁更新 DB ──
    // 将 objectKey 转换为 CDN URL 后再存入数据库
    const cdnImageKeys = finalImageKeys.map(key => keyToCdnUrl(key))
    const cdnFullImageKey = fullImageKey ? keyToCdnUrl(fullImageKey) : null

    await prisma.$transaction(async (tx: any) => {
      const updated = await tx.generation.updateMany({
        where: { id: generationId, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: finalStatus, generatedImages: cdnImageKeys, generatedImage: cdnFullImageKey, refundAmount },
      })
      if (updated.count === 0) {
        console.log(`[TOS-Worker] ⏭  ${shortId}... 已被处理，跳过`)
        return
      }
      if (refundAmount > 0 && userId) {
        const reason = qualityMode === "STANDARD"
          ? `STANDARD模式生图失败全额退款`
          : `PRO模式部分生图失败退款 (${imageCount - successCount}张×${costPerImage}积分)`
        await refundCredits(tx, userId, refundAmount, reason)
      }
    })

    // ── 完成日志 + 队列统计 + 用时 ──
    await cleanupTempFiles([...hostFilePaths, hostFullImagePath])

    const elapsedMs = Date.now() - startTime
    const elapsedSec = (elapsedMs / 1000).toFixed(1)

    const counts = await getTosUploadQueue().getJobCounts()
    const waitingJobs = (counts.waiting ?? 0) + (counts.delayed ?? 0)
    const inProgressJobs = Math.max(0, (counts.active ?? 1) - 1)

    // 计算队列中等待的总图片数
    const queue = getTosUploadQueue()
    const waitingJobsData = await queue.getJobs(["waiting", "delayed"], 0, -1)
    const totalWaitingImages = waitingJobsData.reduce((sum, j) => sum + (j.data.imageCount || 0), 0)

    let resultTag: string
    if (finalStatus === "COMPLETED") {
      resultTag = `✅ ${uploadFileCount}个文件`
    } else if (finalStatus === "PARTIAL_SUCCESS") {
      resultTag = `⚠  ${successCount}/${uploadFileCount}个文件 退款${refundAmount}积分`
    } else {
      resultTag = `❌ 全部失败 退款${refundAmount}积分`
    }

    console.log(`[TOS-Worker] ${resultTag} | ${shortId}... 完成(${elapsedSec}s) | 队列: ${waitingJobs}个Job等待(${totalWaitingImages}张图) ${inProgressJobs}个Job进行中`)

    return { success: true, imageKeys: finalImageKeys, fullImageKey }
  },
  {
    connection: { host: REDIS_HOST, port: REDIS_PORT, password: REDIS_PASSWORD },
    concurrency: CONCURRENCY,
  }
)

// ── 最终失败：全额退款 ──
worker.on("failed", async (job, err) => {
  if (!job) return
  const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 5)
  if (!isLastAttempt) return

  const shortId = job.data.generationId.slice(0, 8)
  const jobType = job.data.jobType ?? "GENERATE"
  const imageIndex = job.data.imageIndex

  console.error(`[TOS-Worker] ❌ ${shortId}... ${jobType}模式 最终失败(第${job.attemptsMade}次): ${err.message}`)

  // ── EDIT 模式：清除编辑状态，不退款（编辑本身不扣费） ──
  if (jobType === "EDIT") {
    await prisma.generation.findUnique({
      where: { id: job.data.generationId },
      select: { editingImageIndexes: true },
    }).then(async (gen: any) => {
      if (gen && typeof imageIndex === "number") {
        const cleanedIndexes = (gen.editingImageIndexes || []).filter((idx: number) => idx !== imageIndex)
        await prisma.generation.update({
          where: { id: job.data.generationId },
          data: { editingImageIndexes: cleanedIndexes },
        })
        console.log(`[TOS-Worker] ⏭  EDIT 图片#${imageIndex + 1} 清除编辑状态`)
      }
    }).catch((e: any) => console.error(`[TOS-Worker] ❌ EDIT 状态清除失败: ${e.message}`))
  } else {
    // ── GENERATE 模式：标记 FAILED 并全额退款 ──
    await prisma.$transaction(async (tx: any) => {
      const updated = await tx.generation.updateMany({
        where: { id: job.data.generationId, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: "FAILED", refundAmount: job.data.totalCost },
      })
      if (updated.count > 0 && job.data.userId) {
        await refundCredits(tx, job.data.userId, job.data.totalCost, "TOS上传最终失败全额退款")
      }
    }).catch((e: any) => console.error(`[TOS-Worker] ❌ DB退款更新失败: ${e.message}`))
  }

  await cleanupTempFiles([...job.data.hostFilePaths, job.data.hostFullImagePath])
})

worker.on("error", (err) => console.error("[TOS-Worker] ❌ Worker错误:", err))

// ── 清道夫：每小时清理孤儿临时文件 ──
const JANITOR_QUEUE_NAME = "tos-upload-janitor"
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

const janitorQueue = new Queue(JANITOR_QUEUE_NAME, {
  connection: { host: REDIS_HOST, port: REDIS_PORT, password: REDIS_PASSWORD },
})

janitorQueue
  .add("sweep", {}, { repeat: { every: 60 * 60 * 1000 } })
  .catch((e) => console.warn(`[Janitor] ⚠  注册失败: ${e.message}`))

const janitorWorker = new Worker(
  JANITOR_QUEUE_NAME,
  async () => {
    let files: string[]
    try {
      files = await fs.readdir(N8N_HOST_TEMP_PATH)
    } catch {
      return
    }

    let deletedCount = 0
    await Promise.allSettled(
      files.map(async (file) => {
        const filePath = path.join(N8N_HOST_TEMP_PATH, file)
        try {
          const stat = await fs.stat(filePath)
          if (Date.now() - stat.mtimeMs > TWO_HOURS_MS) {
            await fs.unlink(filePath)
            deletedCount++
          }
        } catch { /* 已被删除，忽略 */ }
      })
    )

    if (deletedCount > 0) {
      console.log(`[Janitor] 🗑  已清理 ${deletedCount} 个孤儿临时文件`)
    }
  },
  { connection: { host: REDIS_HOST, port: REDIS_PORT, password: REDIS_PASSWORD }, concurrency: 1 }
)

janitorWorker.on("error", (err) => console.error("[Janitor] ❌ 错误:", err))

// ── 优雅关闭 ──
async function shutdown() {
  console.log("\n🛑 TOS Upload Worker 关闭中...")
  await worker.close()
  await janitorWorker.close()
  await janitorQueue.close()
  await prisma.$disconnect()
  await pool.end()
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
