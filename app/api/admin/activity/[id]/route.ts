import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/check-admin"
import { prisma } from "@/lib/prisma"

// ============================================================
// 管理员：单个 Activity 操作
// GET    /api/admin/activity/[id]    获取活动详情
// PUT    /api/admin/activity/[id]    更新活动基本信息
// DELETE /api/admin/activity/[id]    删除活动（级联删除阶梯、虚拟排行榜）
// ============================================================

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id } = await params
  const activity = await prisma.activity.findUnique({
    where: { id },
    include: {
      tiers: { orderBy: { tierLevel: "asc" } },
      virtualLeaderboard: { orderBy: { fakeAmount: "desc" } },
      _count: { select: { activityReferrals: true } },
    },
  })

  if (!activity) {
    return NextResponse.json({ error: "活动不存在" }, { status: 404 })
  }

  return NextResponse.json({ activity })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id } = await params
  const body = await req.json()
  const { name, startTime, endTime, isActive } = body

  const updated = await prisma.activity.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(startTime !== undefined && { startTime: new Date(startTime) }),
      ...(endTime !== undefined && { endTime: new Date(endTime) }),
      ...(isActive !== undefined && { isActive }),
    },
    include: { tiers: { orderBy: { tierLevel: "asc" } } },
  })

  return NextResponse.json({ activity: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id } = await params
  await prisma.activity.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
