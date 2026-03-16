import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/check-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await req.json().catch(() => null)
  const id = String(body?.id ?? "").trim()
  const promptTemplate = String(body?.promptTemplate ?? "")
  const qualityModeRaw = body?.qualityMode

  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 })
  }
  if (!promptTemplate.trim()) {
    return NextResponse.json({ error: "promptTemplate 不能为空" }, { status: 400 })
  }

  // 查找当前记录
  const current = await prisma.productTypePrompt.findUnique({
    where: { id },
    select: {
      id: true,
      platformId: true,
      userId: true,
      productType: true,
      taskType: true,
      mode: true,
      qualityMode: true,
    },
  })

  if (!current) {
    return NextResponse.json({ error: "未找到该 Prompt" }, { status: 404 })
  }

  // 构建更新数据
  const updateData: Record<string, any> = { promptTemplate }

  // 处理参考图片数组
  if (Array.isArray(body?.referenceImages)) {
    updateData.referenceImages = body.referenceImages.filter(
      (url: any) => typeof url === "string" && url.trim()
    )
  }

  // 如果前端传了 qualityMode，校验 + 冲突检查
  if (qualityModeRaw !== undefined && qualityModeRaw !== null) {
    const qualityMode = String(qualityModeRaw).trim().toUpperCase()
    if (!["STANDARD", "PRO"].includes(qualityMode)) {
      return NextResponse.json({ error: "qualityMode 必须是 STANDARD 或 PRO" }, { status: 400 })
    }

    // 5D 唯一性冲突检查（排除自身）
    if (qualityMode !== current.qualityMode) {
      const conflict = await prisma.productTypePrompt.findFirst({
        where: {
          platformId: current.platformId,
          userId: current.userId,
          productType: current.productType,
          taskType: current.taskType,
          mode: current.mode,
          qualityMode,
          id: { not: id },
        },
        select: { id: true },
      })

      if (conflict) {
        return NextResponse.json(
          { error: `该维度的 ${qualityMode} 提示词已存在，无法切换` },
          { status: 409 },
        )
      }
    }

    updateData.qualityMode = qualityMode
  }

  const updated = await prisma.productTypePrompt.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      productType: true,
      taskType: true,
      mode: true,
      qualityMode: true,
      description: true,
      promptTemplate: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      platformId: true,
      userId: true,
    },
  })

  return NextResponse.json({ success: true, prompt: updated })
}
