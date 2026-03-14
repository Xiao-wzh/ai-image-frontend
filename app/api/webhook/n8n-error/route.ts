/**
 * N8N 工作流错误回调
 * 当 N8N 工作流中任何节点失败时，Error Handler 回调此接口
 *
 * 请求体格式：
 * {
 *   generationId: string
 *   errorMessage: string
 *   errorCode?: string
 *   nodeId?: string
 * }
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { refundCredits } from "@/lib/credit-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  // ── 1. 密钥校验 ──
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET
  if (expectedSecret) {
    const received = req.headers.get("x-n8n-secret") || req.headers.get("X-N8N-Secret")
    if (received !== expectedSecret) {
      console.error("[N8N错误回调] ❌ 密钥校验失败")
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

  const { generationId, errorMessage, errorCode, nodeId } = body

  if (!generationId) {
    return NextResponse.json({ error: "缺少 generationId" }, { status: 400 })
  }

  const shortId = (generationId as string).slice(0, 8)

  // ── 3. 查询 Generation ──
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    select: {
      id: true,
      userId: true,
      status: true,
      totalCost: true,
      imageCount: true,
      costPerImage: true,
      taskType: true,
      qualityMode: true,
    },
  })

  if (!generation) {
    console.error(`[N8N错误回调] ❌ Generation 不存在: ${generationId}`)
    return NextResponse.json({ error: "Generation not found" }, { status: 404 })
  }

  // ── 4. 幂等检查：已是终态则跳过 ──
  const terminalStatuses = ["COMPLETED", "PARTIAL_SUCCESS", "FAILED"]
  if (terminalStatuses.includes(generation.status)) {
    console.log(`[N8N错误回调] ⏭  ${shortId}... 已终态(${generation.status})，跳过`)
    return NextResponse.json({ success: true, skipped: true, status: generation.status })
  }

  const errorDesc = `N8N工作流失败${nodeId ? `(节点: ${nodeId})` : ""}: ${errorMessage || "未知错误"}`
  console.error(`[N8N错误回调] ❌ ${shortId}... ${errorDesc}`)

  // ── 5. 标记为 FAILED 并全额退款 ──
  const totalCost = generation.totalCost ?? generation.imageCount * generation.costPerImage

  await prisma.$transaction(async (tx: any) => {
    const updated = await tx.generation.updateMany({
      where: { id: generationId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "FAILED", refundAmount: totalCost },
    })

    if (updated.count > 0 && generation.userId) {
      await refundCredits(tx, generation.userId, totalCost, errorDesc)
    }
  }).catch((e: any) => console.error(`[N8N错误回调] ❌ DB更新失败: ${e.message}`))

  console.log(`[N8N错误回调] ✅ ${shortId}... 已标记失败并退款 ${totalCost} 积分`)

  return NextResponse.json({ success: true, marked_failed: true })
}
