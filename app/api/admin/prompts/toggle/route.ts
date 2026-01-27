import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/check-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handleToggle(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await req.json().catch(() => null)
  const id = String(body?.id ?? "").trim()
  const isActive = Boolean(body?.isActive)

  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 })

  const updated = await prisma.productTypePrompt.update({
    where: { id },
    data: { isActive },
    select: {
      id: true,
      platformId: true,
      userId: true,
      productType: true,
      description: true,
      promptTemplate: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ success: true, prompt: updated })
}

// Support both PUT and POST methods
export async function PUT(req: NextRequest) {
  return handleToggle(req)
}

export async function POST(req: NextRequest) {
  return handleToggle(req)
}



