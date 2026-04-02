/**
 * N8N 编辑图片失败回调
 * 清除 editingImageIndexes 并退款
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { refundCredits } from "@/lib/credit-service"
import { getSystemCost } from "@/lib/system-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  // 密钥校验
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET
  if (expectedSecret) {
    const received = req.headers.get("x-n8n-secret") || req.headers.get("X-N8N-Secret")
    if (received !== expectedSecret) {
      console.error("[编辑错误回调] ❌ 密钥校验失败")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // 解析请求体
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { generationId, imageIndex, error } = body

  console.log(`[编辑错误回调] 📥 收到: generationId=${generationId}, imageIndex=${imageIndex}, error=${error}`)

  if (!generationId || typeof imageIndex !== "number") {
    console.error("[编辑错误回调] ❌ 缺少必要字段")
    return NextResponse.json({ error: "缺少必要字段" }, { status: 400 })
  }

  const shortId = generationId.slice(0, 8)

  // 查询 Generation
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { id: true, userId: true, editingImageIndexes: true },
  })

  if (!generation) {
    console.error(`[编辑错误回调] ❌ Generation 不存在: ${generationId}`)
    return NextResponse.json({ error: "Generation not found" }, { status: 404 })
  }

  // 清除编辑状态
  const cleanedIndexes = (generation.editingImageIndexes || []).filter(
    (idx: number) => idx !== imageIndex
  )

  // 退款
  const EDIT_COST = await getSystemCost("IMAGE_EDIT_COST")

  try {
    await prisma.$transaction(async (tx: any) => {
      // 更新 editingImageIndexes
      if (cleanedIndexes.length === 0) {
        await tx.$executeRaw`UPDATE "Generation" SET "editingImageIndexes" = ARRAY[]::INTEGER[] WHERE id = ${generationId}::uuid`
      } else {
        await tx.generation.update({
          where: { id: generationId },
          data: { editingImageIndexes: cleanedIndexes },
        })
      }

      // 退款
      if (generation.userId) {
        await refundCredits(tx, generation.userId, EDIT_COST, `图片编辑失败退款: ${error || "N8N处理失败"}`)
      }
    })

    console.log(`[编辑错误回调] ✅ ${shortId}... 图片#${imageIndex + 1} 已清除编辑状态并退款`)
    return NextResponse.json({ success: true, refunded: true })
  } catch (err: any) {
    console.error(`[编辑错误回调] ❌ 处理失败: ${err.message}`)
    return NextResponse.json({ error: "处理失败" }, { status: 500 })
  }
}
