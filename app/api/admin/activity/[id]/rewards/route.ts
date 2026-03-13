import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/check-admin"
import { prisma } from "@/lib/prisma"

// ============================================================
// 管理员：活动奖励结算
// GET  /api/admin/activity/[id]/rewards   查询各邀请人结算结果
// POST /api/admin/activity/[id]/rewards   发放积分给指定邀请人
// ============================================================

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id: activityId } = await params

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { tiers: { orderBy: { tierLevel: "asc" } } },
  })

  if (!activity) {
    return NextResponse.json({ error: "活动不存在" }, { status: 404 })
  }

  // 按邀请人聚合：累计拉新充值金额 + 有效人数
  const stats = await prisma.activityReferral.groupBy({
    by: ["inviterId"],
    where: { activityId },
    _sum: { rechargeAmount: true },
    _count: { inviteeId: true },
  })

  if (stats.length === 0) {
    return NextResponse.json({ rewards: [] })
  }

  const inviterIds = stats.map((s) => s.inviterId)

  // 获取邀请人用户信息
  const users = await prisma.user.findMany({
    where: { id: { in: inviterIds } },
    select: { id: true, name: true, username: true, email: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  // 查询已发放记录（以 ActivityRewardLog 为准）
  const rewardLogs = await prisma.activityRewardLog.findMany({
    where: { activityId, userId: { in: inviterIds } },
    select: { userId: true, tierId: true, rewardCredits: true },
  })
  // userId -> { tierId, rewardCredits }
  const rewardLogMap = new Map(rewardLogs.map((r) => [r.userId, r]))

  // 按 minAmount 降序，方便找最高满足档
  const tiersDesc = [...activity.tiers].sort(
    (a, b) =>
      ((b.conditions as { minAmount?: number })?.minAmount ?? 0) -
      ((a.conditions as { minAmount?: number })?.minAmount ?? 0)
  )

  const rewards = stats.map((s) => {
    const totalAmount = s._sum.rechargeAmount ?? 0
    const inviteCount = s._count.inviteeId

    const qualifiedTier = tiersDesc.find((t) => {
      const cond = t.conditions as { minAmount?: number; minInvites?: number }
      return (
        totalAmount >= (cond.minAmount ?? 0) &&
        inviteCount >= (cond.minInvites ?? 0)
      )
    })

    const creditsToGrant =
      (qualifiedTier?.rewards as { credits?: number } | null)?.credits ?? 0
    const user = userMap.get(s.inviterId)
    const log = rewardLogMap.get(s.inviterId)

    return {
      inviterId: s.inviterId,
      inviterName:
        user?.name ?? user?.username ?? user?.email ?? "未知用户",
      totalAmount,
      inviteCount,
      tierLevel: qualifiedTier?.tierLevel ?? null,
      tierId: qualifiedTier?.id ?? null,
      creditsToGrant,
      distributed: !!log,
      distributedAmount: log?.rewardCredits ?? 0,
    }
  })

  rewards.sort((a, b) => b.creditsToGrant - a.creditsToGrant)

  return NextResponse.json({
    activity: { id: activity.id, name: activity.name },
    rewards,
  })
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
  // inviterIds: 目标邀请人列表；传 ["__ALL__"] 表示全部
  const { inviterIds }: { inviterIds: string[] } = body

  if (!Array.isArray(inviterIds) || inviterIds.length === 0) {
    return NextResponse.json({ error: "请传入 inviterIds 数组" }, { status: 400 })
  }

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { tiers: { orderBy: { tierLevel: "asc" } } },
  })

  if (!activity) {
    return NextResponse.json({ error: "活动不存在" }, { status: 404 })
  }

  const isAll = inviterIds[0] === "__ALL__"
  const whereInviter = isAll
    ? { activityId }
    : { activityId, inviterId: { in: inviterIds } }

  const stats = await prisma.activityReferral.groupBy({
    by: ["inviterId"],
    where: whereInviter,
    _sum: { rechargeAmount: true },
    _count: { inviteeId: true },
  })

  const tiersDesc = [...activity.tiers].sort(
    (a, b) =>
      ((b.conditions as { minAmount?: number })?.minAmount ?? 0) -
      ((a.conditions as { minAmount?: number })?.minAmount ?? 0)
  )

  const results: { inviterId: string; credits: number; skipped: boolean }[] = []

  for (const s of stats) {
    const inviterId = s.inviterId
    const totalAmount = s._sum.rechargeAmount ?? 0
    const inviteCount = s._count.inviteeId

    const qualifiedTier = tiersDesc.find((t) => {
      const cond = t.conditions as { minAmount?: number; minInvites?: number }
      return (
        totalAmount >= (cond.minAmount ?? 0) &&
        inviteCount >= (cond.minInvites ?? 0)
      )
    })

    const credits =
      (qualifiedTier?.rewards as { credits?: number } | null)?.credits ?? 0

    // 未达任何档，跳过
    if (!qualifiedTier || credits <= 0) {
      results.push({ inviterId, credits: 0, skipped: true })
      continue
    }

    // 事务：写 ActivityRewardLog（@@unique 触发唯一冲突即幂等跳过）
    //       + 给用户加积分 + 写 CreditRecord 流水
    try {
      await prisma.$transaction([
        // 幂等锁：createMany skipDuplicates 不满足原子性，改用 create 让唯一约束抛异常
        prisma.activityRewardLog.create({
          data: {
            userId: inviterId,
            activityId,
            tierId: qualifiedTier.id,
            rewardCredits: credits,
          },
        }),
        prisma.user.update({
          where: { id: inviterId },
          data: { credits: { increment: credits } },
        }),
        prisma.creditRecord.create({
          data: {
            userId: inviterId,
            amount: credits,
            type: "RECHARGE",
            description: `活动奖励：${activity.name}（第 ${qualifiedTier.tierLevel} 档）`,
          },
        }),
      ])

      results.push({ inviterId, credits, skipped: false })
      console.log(
        `🎁 活动奖励发放: 用户 ${inviterId} 获得 ${credits} 积分 (活动: ${activityId}, 阶梯: ${qualifiedTier.tierLevel})`
      )
    } catch (e: unknown) {
      // Prisma P2002 = 唯一约束冲突 → 已发放，幂等跳过
      if ((e as { code?: string })?.code === "P2002") {
        results.push({ inviterId, credits: 0, skipped: true })
      } else {
        throw e
      }
    }
  }

  const granted = results.filter((r) => !r.skipped)
  const skipped = results.filter((r) => r.skipped)

  return NextResponse.json({
    success: true,
    granted: granted.length,
    skipped: skipped.length,
    details: results,
  })
}
