import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/check-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await req.json().catch(() => null)
  const id = String(body?.id ?? "").trim()
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 })

  const exists = await prisma.productTypePrompt.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!exists) {
    return NextResponse.json({ error: "未找到该 Prompt" }, { status: 404 })
  }

  await prisma.productTypePrompt.delete({ where: { id } })
  return NextResponse.json({ success: true })
}



