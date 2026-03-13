import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/check-admin"
import { prisma } from "@/lib/prisma"

// ============================================================
// 管理员：虚拟排行榜（气氛组）CRUD
// GET  /api/admin/activity/virtual-leaderboard?activityId=xxx    查询某活动的虚拟数据
// POST /api/admin/activity/virtual-leaderboard                   新增虚拟数据
// ============================================================

export async function GET(req: NextRequest) {
  const check = await requireAdmin()
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const activityId = req.nextUrl.searchParams.get("activityId")
  if (!activityId) {
    return NextResponse.json({ error: "缺少 activityId 参数" }, { status: 400 })
  }

  const entries = await prisma.virtualLeaderboard.findMany({
    where: { activityId },
    orderBy: { fakeAmount: "desc" },
  })

  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await req.json()
  const { activityId, fakeName, fakeAvatar, fakeAmount } = body

  if (!activityId || !fakeName || typeof fakeAmount !== "number") {
    return NextResponse.json(
      { error: "缺少必填字段：activityId, fakeName, fakeAmount（数字）" },
      { status: 400 }
    )
  }

  // 验证活动是否存在
  const activity = await prisma.activity.findUnique({ where: { id: activityId } })
  if (!activity) {
    return NextResponse.json({ error: "活动不存在" }, { status: 404 })
  }

  const entry = await prisma.virtualLeaderboard.create({
    data: {
      activityId,
      fakeName,
      fakeAvatar: fakeAvatar ?? null,
      fakeAmount,
    },
  })

  return NextResponse.json({ entry }, { status: 201 })
}
