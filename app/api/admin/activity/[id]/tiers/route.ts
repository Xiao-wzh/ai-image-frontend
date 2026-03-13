import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/check-admin"
import { prisma } from "@/lib/prisma"

// ============================================================
// 管理员：ActivityTier 阶梯管理
// GET  /api/admin/activity/[id]/tiers       查询某活动的所有阶梯
// POST /api/admin/activity/[id]/tiers       新增阶梯
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
  const tiers = await prisma.activityTier.findMany({
    where: { activityId: id },
    orderBy: { tierLevel: "asc" },
  })

  return NextResponse.json({ tiers })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id: activityId } = await params
  const body = await req.json()
  const { tierLevel, conditions, rewards } = body

  if (typeof tierLevel !== "number") {
    return NextResponse.json({ error: "tierLevel 必须是数字" }, { status: 400 })
  }
  if (!conditions || typeof conditions !== "object") {
    return NextResponse.json(
      { error: "conditions 必须是 JSON 对象，例如 { minAmount: 1000 }" },
      { status: 400 }
    )
  }
  if (!rewards || typeof rewards !== "object") {
    return NextResponse.json(
      { error: "rewards 必须是 JSON 对象，例如 { credits: 500 }" },
      { status: 400 }
    )
  }

  // 验证活动是否存在
  const activity = await prisma.activity.findUnique({ where: { id: activityId } })
  if (!activity) {
    return NextResponse.json({ error: "活动不存在" }, { status: 404 })
  }

  const tier = await prisma.activityTier.create({
    data: { activityId, tierLevel, conditions, rewards },
  })

  return NextResponse.json({ tier }, { status: 201 })
}
