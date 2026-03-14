/**
 * N8N 编辑图片结果回调
 * 接收 n8n 传来的文件路径 → 翻译为宿主机路径 → 入队 TOS 上传
 *
 * 请求体格式：
 * {
 *   generationId: string
 *   imageIndex: number
 *   filePath: string   // n8n 容器内文件路径，如 /mnt/temp/xxx_edit.png
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
      console.error("[编辑回调] ❌ 密钥校验失败")
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

  const { generationId, imageIndex } = body
  // 兼容多种字段名：filePath / file_path / editFilePath
  const filePath = body.filePath || body.file_path || body.editFilePath

  if (!generationId || typeof imageIndex !== "number" || !filePath) {
    console.error("[编辑回调] ❌ 缺少必要字段", { generationId, imageIndex, filePath })
    return NextResponse.json({ error: "缺少必要字段: generationId, imageIndex, filePath" }, { status: 400 })
  }

  const shortId = (generationId as string).slice(0, 8)

  // ── 3. 查询 Generation（获取 userId 和编辑费用） ──
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { id: true, userId: true, status: true, editingImageIndexes: true },
  })

  if (!generation) {
    console.error(`[编辑回调] ❌ Generation 不存在: ${generationId}`)
    return NextResponse.json({ error: "Generation not found" }, { status: 404 })
  }

  // ── 4. 检查编辑状态是否有效 ──
  if (!generation.editingImageIndexes?.includes(imageIndex)) {
    console.error(`[编辑回调] ❌ 图片#${imageIndex + 1} 不在编辑状态`)
    return NextResponse.json({ error: "图片不在编辑状态" }, { status: 400 })
  }

  const hostFilePath = translateToHostPath(filePath)

  console.log(`[编辑回调] ▶  ${shortId}... 图片#${imageIndex + 1} | ${filePath} → ${hostFilePath}`)

  // ── 5. 入队（用 generationId + imageIndex 作为 jobId，保证幂等） ──
  try {
    await addTosUploadJob({
      generationId,
      userId: generation.userId!,
      hostFilePaths: [hostFilePath],
      imageCount: 1,
      costPerImage: 0,
      totalCost: 0,
      qualityMode: "EDIT",
      taskType: "EDIT",
      jobType: "EDIT",
      imageIndex,
    }, `${generationId}_edit_${imageIndex}`)

    console.log(`[编辑回调] ✅ ${shortId}... 图片#${imageIndex + 1} 已入队`)
    return NextResponse.json({ success: true, queued: true })
  } catch (error: any) {
    console.error(`[编辑回调] ❌ 入队失败: ${error.message}`)
    // 入队失败时清除编辑状态（不退款，因为还没扣费）
    const cleanedIndexes = (generation.editingImageIndexes || []).filter((idx: number) => idx !== imageIndex)
    await prisma.generation.update({
      where: { id: generationId },
      data: { editingImageIndexes: cleanedIndexes },
    })
    return NextResponse.json({ error: "入队失败" }, { status: 500 })
  }
}
