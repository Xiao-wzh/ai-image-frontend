/**
 * N8N Webhook 回调（新版）— 接收文件路径，异步入队上传 TOS
 *
 * 请求体格式：
 * {
 *   generationId: string          // Generation UUID
 *   filePaths: string[]           // n8n 容器内文件路径，如 ["/mnt/temp/xxx_1.png"]
 *   fullImagePath?: string        // 合并大图路径（STANDARD 模式）
 * }
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { addTosUploadJob } from "@/lib/tos-upload-queue"
import { refundCredits } from "@/lib/credit-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const N8N_CONTAINER_BASE = process.env.N8N_CONTAINER_TEMP_PATH || "/mnt/temp"
const N8N_HOST_BASE = process.env.N8N_HOST_TEMP_PATH || "/opt/stack/n8n_files/temp"

function translateToHostPath(containerPath: string): string {
  return containerPath.replace(N8N_CONTAINER_BASE, N8N_HOST_BASE)
}

export async function POST(req: NextRequest) {
  // ── 1. 密钥校验 ──
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET
  if (expectedSecret) {
    const received = req.headers.get("x-n8n-secret") || req.headers.get("X-N8N-Secret")
    if (received !== expectedSecret) {
      console.error("[N8N回调] ❌ 密钥校验失败")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // ── 2. 解析请求体 ──
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { generationId, filePaths, fullImagePath } = body

  if (!generationId) {
    return NextResponse.json({ error: "缺少 generationId" }, { status: 400 })
  }

  const shortId = (generationId as string).slice(0, 8)

  // ── 3. 查询 Generation（获取业务参数） ──
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    select: {
      id: true,
      userId: true,
      status: true,
      imageCount: true,
      costPerImage: true,
      totalCost: true,
      qualityMode: true,
      taskType: true,
    },
  })

  if (!generation) {
    console.error(`[N8N回调] ❌ Generation 不存在: ${generationId}`)
    return NextResponse.json({ error: "Generation not found" }, { status: 404 })
  }

  // ── 4. 幂等检查 ──
  const terminalStatuses = ["COMPLETED", "PARTIAL_SUCCESS", "FAILED"]
  if (terminalStatuses.includes(generation.status)) {
    console.log(`[N8N回调] ⏭  ${shortId}... 已终态(${generation.status})，跳过`)
    return NextResponse.json({ success: true, skipped: true, status: generation.status })
  }

  // ── 5. 校验 filePaths ──
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    console.error(`[N8N回调] ❌ ${shortId}... 缺少或无效的 filePaths 数组`)
    // 标记为失败并全额退款
    await prisma.$transaction(async (tx: any) => {
      const totalCost = generation.totalCost ?? generation.imageCount * generation.costPerImage
      await tx.generation.update({
        where: { id: generationId },
        data: { status: "FAILED", refundAmount: totalCost },
      })
      if (generation.userId) {
        await refundCredits(tx, generation.userId, totalCost, "N8N生成失败（缺少文件路径）全额退款")
      }
    })
    return NextResponse.json({ error: "缺少或无效的 filePaths 数组" }, { status: 400 })
  }

  // ── 6. 路径翻译（容器 → 宿主机） ──
  const hostFilePaths = filePaths.map(translateToHostPath)
  const hostFullImagePath = fullImagePath ? translateToHostPath(fullImagePath) : undefined

  console.log(`[N8N回调] ▶  ${shortId}... | ${generation.qualityMode} ${generation.taskType} | ${filePaths.length}个文件 | ${filePaths[0]} → ${hostFilePaths[0]}`)

  // ── 7. 标记为 PROCESSING ──
  await prisma.generation.update({
    where: { id: generationId },
    data: { status: "PROCESSING" },
  })

  // ── 8. 入队（generationId 作为 jobId，保证幂等） ──
  await addTosUploadJob({
    generationId,
    userId: generation.userId!,
    hostFilePaths,
    hostFullImagePath,
    imageCount: generation.imageCount,
    costPerImage: generation.costPerImage,
    totalCost: generation.totalCost ?? generation.imageCount * generation.costPerImage,
    qualityMode: generation.qualityMode,
    taskType: generation.taskType,
  })

  console.log(`[N8N回调] ✅ ${shortId}... 已入队`)

  return NextResponse.json({ success: true, queued: true })
}
