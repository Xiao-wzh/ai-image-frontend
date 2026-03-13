import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/check-admin"
import { prisma } from "@/lib/prisma"

// ============================================================
// 管理员：Activity 活动列表与创建
// GET  /api/admin/activity           查询所有活动（含阶梯）
// POST /api/admin/activity           创建活动（可同时传入 tiers 数组）
// ============================================================

export async function GET() {
  const check = await requireAdmin()
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const activities = await prisma.activity.findMany({
    include: {
      tiers: { orderBy: { tierLevel: "asc" } },
      _count: {
        select: {
          activityReferrals: true,
          virtualLeaderboard: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ activities })
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await req.json()
  const { name, startTime, endTime, isActive = true, tiers = [] } = body

  if (!name || !startTime || !endTime) {
    return NextResponse.json(
      { error: "缺少必填字段：name, startTime, endTime" },
      { status: 400 }
    )
  }

  // 验证 tiers 格式
  for (const tier of tiers) {
    if (typeof tier.tierLevel !== "number") {
      return NextResponse.json(
        { error: "每个阶梯必须包含 tierLevel（数字）" },
        { status: 400 }
      )
    }
    if (!tier.conditions || typeof tier.conditions !== "object") {
      return NextResponse.json(
        { error: "每个阶梯必须包含 conditions 对象" },
        { status: 400 }
      )
    }
    if (!tier.rewards || typeof tier.rewards !== "object") {
      return NextResponse.json(
        { error: "每个阶梯必须包含 rewards 对象" },
        { status: 400 }
      )
    }
  }

  // 使用事务原子创建活动 + 阶梯
  const activity = await prisma.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: {
        name,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        isActive,
      },
    })

    if (tiers.length > 0) {
      await tx.activityTier.createMany({
        data: tiers.map(
          (t: { tierLevel: number; conditions: object; rewards: object }) => ({
            activityId: created.id,
            tierLevel: t.tierLevel,
            conditions: t.conditions,
            rewards: t.rewards,
          })
        ),
      })
    }

    return tx.activity.findUnique({
      where: { id: created.id },
      include: { tiers: { orderBy: { tierLevel: "asc" } } },
    })
  })

  return NextResponse.json({ activity }, { status: 201 })
}
