import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/check-admin"
import { prisma } from "@/lib/prisma"

// ============================================================
// 管理员：单个 ActivityTier 操作
// PUT    /api/admin/activity/[id]/tiers/[tierId]    更新阶梯（支持灵活 JSON 配置）
// DELETE /api/admin/activity/[id]/tiers/[tierId]    删除阶梯
// ============================================================

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  const check = await requireAdmin()
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { tierId } = await params
  const body = await req.json()
  const { tierLevel, conditions, rewards } = body

  const updated = await prisma.activityTier.update({
    where: { id: tierId },
    data: {
      ...(typeof tierLevel === "number" && { tierLevel }),
      ...(conditions !== undefined && { conditions }),
      ...(rewards !== undefined && { rewards }),
    },
  })

  return NextResponse.json({ tier: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  const check = await requireAdmin()
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { tierId } = await params
  await prisma.activityTier.delete({ where: { id: tierId } })

  return NextResponse.json({ success: true })
}
