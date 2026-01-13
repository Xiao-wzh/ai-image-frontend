import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/check-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await req.json().catch(() => null)
  const platformId = String(body?.platformId ?? "").trim()
  const productType = String(body?.productType ?? "").trim()
  const taskType = String(body?.taskType ?? "MAIN_IMAGE").trim()
  const description = String(body?.description ?? "").trim()
  const promptTemplate = String(body?.promptTemplate ?? "").trim()
  const userIdRaw = body?.userId
  const userId = userIdRaw === null || userIdRaw === undefined || String(userIdRaw).trim() === "" ? null : String(userIdRaw).trim()

  if (!platformId) return NextResponse.json({ error: "缺少 platformId" }, { status: 400 })
  if (!productType) return NextResponse.json({ error: "缺少 productType" }, { status: 400 })
  if (!promptTemplate) return NextResponse.json({ error: "promptTemplate 不能为空" }, { status: 400 })

  // 防止重复：同一平台 + 同一 productType + 同一 taskType + 同一 userId（null 表示系统）只允许一条
  const existing = await prisma.productTypePrompt.findFirst({
    where: {
      platformId,
      userId,
      productType,
      taskType,
    },
    select: { id: true },
  })

  if (existing) {
    return NextResponse.json(
      { error: userId ? "该用户私有 Prompt 已存在" : "该平台下该类型的系统 Prompt 已存在" },
      { status: 409 },
    )
  }

  // 如果是私有 prompt，校验用户存在
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!u) {
      return NextResponse.json({ error: "userId 无效（用户不存在）" }, { status: 400 })
    }
  }

  const created = await prisma.productTypePrompt.create({
    data: {
      platformId,
      userId,
      productType,
      taskType,
      description: description || null,
      promptTemplate,
      isActive: true,
    },
    select: {
      id: true,
      platformId: true,
      userId: true,
      productType: true,
      taskType: true,
      description: true,
      promptTemplate: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ success: true, prompt: created })
}
