/**
 * 去水印 Worker 进程（生产级）
 * 
 * 启动方式：npm run worker:watermark
 * 
 * 特性：
 * - 原子认领（避免重复处理）
 * - 远端 taskId 落库（避免重复创建）
 * - 指数退避轮询（2s→4s→8s→16s）
 * - 幂等退款（refundedAt 控制）
 */

import "dotenv/config"
import { Worker, Job, QueueEvents } from "bullmq"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { QUEUE_NAME, WatermarkJobData, WatermarkJobResult } from "../lib/watermark-queue"

// API 配置
const API_URL = "https://techsz.aoscdn.com/api/tasks/visual/external/watermark-remove"
const MAX_POLL_ATTEMPTS = 15      // 最大轮询次数
const MAX_POLL_INTERVAL = 16000   // 最大轮询间隔 16s
const FETCH_TIMEOUT = 15000       // fetch 超时 15s
const CONCURRENCY = 5             // Worker 并发数
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1"
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379")
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined

// 创建 Prisma 客户端
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL 未配置")
    process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter }) as any

console.log("🚀 去水印 Worker 启动中...")
console.log(`📊 并发数: ${CONCURRENCY}`)
console.log(`🔗 Redis: ${REDIS_HOST}:${REDIS_PORT}`)

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(url, { ...options, signal: controller.signal })
    } finally {
        clearTimeout(timeout)
    }
}

/**
 * 指数退避延迟（带上限）
 */
function getBackoffDelay(attempt: number): number {
    const delay = Math.min(2000 * Math.pow(2, attempt), MAX_POLL_INTERVAL)
    // 加入抖动 ±20%
    const jitter = delay * 0.2 * (Math.random() - 0.5)
    return Math.round(delay + jitter)
}

// 创建 Worker
const worker = new Worker<WatermarkJobData, WatermarkJobResult>(
    QUEUE_NAME,
    async (job: Job<WatermarkJobData, WatermarkJobResult>) => {
        const { taskId, originalUrl, userId } = job.data
        console.log(`[Worker] 处理任务 ${taskId}，第 ${job.attemptsMade + 1} 次尝试`)

        try {
            // ✅ 原子认领：条件更新 status=PENDING，更新不到说明已被处理
            const claimed = await prisma.watermarkTask.updateMany({
                where: {
                    id: taskId,
                    status: { in: ["PENDING", "PROCESSING"] }  // 允许重入
                },
                data: {
                    status: "PROCESSING",
                    attemptsMade: job.attemptsMade + 1
                }
            })

            if (claimed.count === 0) {
                console.log(`[Worker] 任务 ${taskId} 已被处理或取消，跳过`)
                return { success: true, resultUrl: undefined }
            }

            // 获取任务详情（检查是否有 remoteTaskId）
            const task = await prisma.watermarkTask.findUnique({
                where: { id: taskId },
                select: { remoteTaskId: true }
            })

            const apiKey = process.env.WATERMARK_API_KEY
            if (!apiKey) {
                throw new Error("WATERMARK_API_KEY 未配置")
            }

            let remoteTaskId = task?.remoteTaskId

            // ✅ 如果没有 remoteTaskId，创建远端任务
            if (!remoteTaskId) {
                console.log(`[Worker] 任务 ${taskId} 创建远端任务...`)

                const createResponse = await fetchWithTimeout(API_URL, {
                    method: "POST",
                    headers: {
                        "X-API-KEY": apiKey,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ url: originalUrl, sync: 0 })
                }, FETCH_TIMEOUT)

                const createText = await createResponse.text()
                console.log(`[Worker] 创建响应:`, createResponse.status, createText.substring(0, 100))

                let createResult: any
                try {
                    createResult = JSON.parse(createText)
                } catch {
                    throw new Error(`API 返回无效 JSON: ${createText.substring(0, 200)}`)
                }

                if (createResult.status !== 200) {
                    throw new Error(createResult.message || `API 创建失败: ${createResult.status}`)
                }

                remoteTaskId = createResult.data?.task_id
                if (!remoteTaskId) {
                    throw new Error("创建响应中没有 task_id")
                }

                // ✅ 立即保存 remoteTaskId 到数据库（重试时可复用）
                await prisma.watermarkTask.update({
                    where: { id: taskId },
                    data: { remoteTaskId }
                })
                console.log(`[Worker] 远端任务ID已保存: ${remoteTaskId}`)
            } else {
                console.log(`[Worker] 复用已有远端任务: ${remoteTaskId}`)
            }

            // ✅ 指数退避轮询
            let resultUrl: string | null = null

            for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
                const delay = getBackoffDelay(attempt)
                await new Promise(resolve => setTimeout(resolve, delay))

                await job.updateProgress(Math.round((attempt / MAX_POLL_ATTEMPTS) * 90))

                try {
                    const pollResponse = await fetchWithTimeout(
                        `${API_URL}/${remoteTaskId}`,
                        { method: "GET", headers: { "X-API-KEY": apiKey } },
                        FETCH_TIMEOUT
                    )

                    const pollText = await pollResponse.text()
                    let pollResult: any
                    try {
                        pollResult = JSON.parse(pollText)
                    } catch {
                        console.error(`[Worker] 轮询解析错误:`, pollText.substring(0, 100))
                        continue
                    }

                    if (pollResult.status !== 200) {
                        throw new Error(pollResult.message || `轮询失败: ${pollResult.status}`)
                    }

                    const state = pollResult.data?.state
                    const progress = pollResult.data?.progress

                    if (state === 1 && progress === 100) {
                        resultUrl = pollResult.data?.file
                        break
                    } else if (state < 0) {
                        const stateMessages: Record<number, string> = {
                            [-7]: "无效文件（文件损坏或格式不对）",
                            [-5]: "文件超出大小限制（最大50MB）",
                            [-3]: "下载失败（检查URL是否可访问）",
                            [-2]: "上传失败",
                            [-1]: "处理失败"
                        }
                        throw new Error(stateMessages[state] || `任务状态异常: ${state}`)
                    }

                    console.log(`[Worker] 任务 ${taskId} 轮询 #${attempt + 1} state=${state} progress=${progress}`)
                } catch (err: any) {
                    if (err.name === "AbortError") {
                        console.warn(`[Worker] 轮询超时，继续重试...`)
                        continue
                    }
                    throw err
                }
            }

            if (!resultUrl) {
                throw new Error("轮询超时：结果未就绪")
            }

            // 更新任务为已完成
            await prisma.watermarkTask.update({
                where: { id: taskId },
                data: { status: "COMPLETED", resultUrl }
            })

            console.log(`✅ 任务 ${taskId} 处理完成`)
            return { success: true, resultUrl }

        } catch (error: any) {
            console.error(`❌ 任务 ${taskId} 失败:`, error.message)

            // 如果是最后一次尝试，执行退款
            if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
                console.log(`[Worker] 任务 ${taskId} 最终失败，执行退款...`)

                await prisma.$transaction(async (tx: any) => {
                    // ✅ 幂等退款：先占位 refundedAt，占到才退款
                    const refundClaim = await tx.watermarkTask.updateMany({
                        where: {
                            id: taskId,
                            refundedAt: null  // 未退款
                        },
                        data: {
                            status: "FAILED",
                            errorMsg: error?.message || "未知错误",
                            refundedAt: new Date()  // 占位
                        }
                    })

                    if (refundClaim.count === 0) {
                        console.log(`[Worker] 任务 ${taskId} 已退款，跳过`)
                        return
                    }

                    // 执行退款
                    const refundAmount = 50
                    await tx.user.update({
                        where: { id: userId },
                        data: { credits: { increment: refundAmount } }
                    })
                    await tx.creditRecord.create({
                        data: {
                            userId,
                            amount: refundAmount,
                            type: "REFUND",
                            description: "去水印失败退款"
                        }
                    })
                    console.log(`💰 已退还 ${refundAmount} 积分给用户 ${userId}`)
                })
            } else {
                // 非最终失败，只更新错误信息
                await prisma.watermarkTask.update({
                    where: { id: taskId },
                    data: { errorMsg: error?.message || "处理中..." }
                })
            }

            throw error
        }
    },
    {
        connection: {
            host: REDIS_HOST,
            port: REDIS_PORT,
            password: REDIS_PASSWORD,
        },
        concurrency: CONCURRENCY,
    }
)

// 监控事件
const queueEvents = new QueueEvents(QUEUE_NAME, {
    connection: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD,
    }
})

queueEvents.on("completed", ({ jobId }) => {
    console.log(`[监控] 任务完成: ${jobId}`)
})

queueEvents.on("failed", ({ jobId, failedReason }) => {
    console.error(`[监控] 任务失败: ${jobId}`, failedReason)
})

// Worker 事件
worker.on("error", (err) => {
    console.error("[Worker] 错误:", err)
})

// 优雅关闭
async function shutdown() {
    console.log("\n🛑 正在关闭 Worker...")
    await worker.close()
    await queueEvents.close()
    await prisma.$disconnect()
    await pool.end()
    console.log("✅ Worker 已关闭")
    process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

console.log("✅ Worker 已启动，等待任务...")
