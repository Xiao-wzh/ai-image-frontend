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

  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 })
  }
  if (!promptTemplate.trim()) {
    return NextResponse.json({ error: "promptTemplate 不能为空" }, { status: 400 })
  }

  const exists = await prisma.productTypePrompt.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!exists) {
    return NextResponse.json({ error: "未找到该 Prompt" }, { status: 404 })
  }

  const updated = await prisma.productTypePrompt.update({
    where: { id },
    data: { promptTemplate },
    select: {
      id: true,
      productType: true,
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

