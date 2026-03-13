import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ============================================================
// 阶梯条件与奖励的 TypeScript 类型定义
// 采用 JSON 驱动设计，未来可扩展任意字段而无需修改数据库结构
// ============================================================

interface TierConditions {
  minAmount: number  // 最低拉新充值金额（分）
  minInvites?: number // 最低有效拉新人数（可选，默认 0）
  [key: string]: unknown // 保留扩展字段（如：活跃天数等）
}

interface TierRewards {
  credits?: number  // 赠送积分
  vipDays?: number  // 赠送会员天数（预留扩展）
  [key: string]: unknown
}

interface ActivityTierWithParsed {
  id: string
  tierLevel: number
  conditions: TierConditions
  rewards: TierRewards
}

// ============================================================
// 核心：JSON 规则引擎 —— 校验用户是否满足指定阶梯条件
// ============================================================
function checkTierCondition(
  conditions: TierConditions,
  userStats: { totalAmount: number; validInviteCount: number }
): boolean {
  const { minAmount, minInvites = 0 } = conditions
  return (
    userStats.totalAmount >= minAmount &&
    userStats.validInviteCount >= minInvites
  )
}

// ============================================================
// 解析用户阶梯进度
// 找出已满足的最高阶梯（currentTier）和下一个未满足的阶梯（nextTier）
// ============================================================
function resolveUserProgress(
  tiers: ActivityTierWithParsed[],
  userStats: { totalAmount: number; validInviteCount: number }
) {
  // 按 tierLevel 升序排列
  const sorted = [...tiers].sort((a, b) => a.tierLevel - b.tierLevel)

  let currentTier: ActivityTierWithParsed | null = null
  let nextTier: ActivityTierWithParsed | null = null

  for (const tier of sorted) {
    if (checkTierCondition(tier.conditions, userStats)) {
      currentTier = tier
    } else {
      // 第一个未满足的阶梯就是 nextTier
      if (nextTier === null) {
        nextTier = tier
      }
    }
  }

  // 计算距离解锁下一阶梯还差多少
  let gapToNext: { amountGap: number; inviteGap: number } | null = null
  if (nextTier) {
    const { minAmount, minInvites = 0 } = nextTier.conditions
    gapToNext = {
      amountGap: Math.max(0, minAmount - userStats.totalAmount),
      inviteGap: Math.max(0, minInvites - userStats.validInviteCount),
    }
  }

  return { currentTier, nextTier, gapToNext }
}

export async function GET(req: NextRequest) {
  try {
    // 1. 查找当前进行中的活动（取最新的一个）
    const now = new Date()
    const activity = await prisma.activity.findFirst({
      where: {
        isActive: true,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      include: {
        tiers: {
          orderBy: { tierLevel: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!activity) {
      return NextResponse.json({
        activity: null,
        leaderboard: [],
        userProgress: null,
      })
    }

    // 2. 聚合真实拉新充值数据（按邀请人分组求和）
    const realStats = await prisma.activityReferral.groupBy({
      by: ["inviterId"],
      where: { activityId: activity.id },
      _sum: { rechargeAmount: true },
      _count: { inviteeId: true },
    })

    // 获取邀请人用户信息（用于排行榜展示）
    const inviterIds = realStats.map((s) => s.inviterId)
    const users = await prisma.user.findMany({
      where: { id: { in: inviterIds } },
      select: { id: true, name: true, username: true, image: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    // 3. 获取虚拟排行榜数据
    const virtualEntries = await prisma.virtualLeaderboard.findMany({
      where: { activityId: activity.id },
    })

    // 4. 合并真实 + 虚拟数据，按金额降序，取 Top 10
    type LeaderboardEntry = {
      type: "real" | "virtual"
      userId?: string
      name: string
      avatar: string | null
      totalAmount: number
    }

    const realEntries: LeaderboardEntry[] = realStats.map((s) => {
      const user = userMap.get(s.inviterId)
      return {
        type: "real",
        userId: s.inviterId,
        name: user?.name ?? user?.username ?? "匿名用户",
        avatar: user?.image ?? null,
        totalAmount: s._sum.rechargeAmount ?? 0,
      }
    })

    const virtualList: LeaderboardEntry[] = virtualEntries.map((v) => ({
      type: "virtual",
      name: v.fakeName,
      avatar: v.fakeAvatar ?? null,
      totalAmount: v.fakeAmount,
    }))

    const merged = [...realEntries, ...virtualList]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10)

    // 5. 如果用户已登录，计算其个人阶梯进度
    const session = await auth()
    let userProgress = null

    if (session?.user?.id) {
      const userId = session.user.id

      // 统计该用户在活动期间的总拉新充值金额和有效拉新人数
      const userStat = await prisma.activityReferral.aggregate({
        where: { activityId: activity.id, inviterId: userId },
        _sum: { rechargeAmount: true },
      })

      // 有效拉新人数 = 产生过充值记录的不重复被邀请人数
      const distinctInvitees = await prisma.activityReferral.groupBy({
        by: ["inviteeId"],
        where: { activityId: activity.id, inviterId: userId },
      })

      const userStats = {
        totalAmount: userStat._sum.rechargeAmount ?? 0,
        validInviteCount: distinctInvitees.length,
      }

      // 解析阶梯 JSON，类型安全转换
      const parsedTiers: ActivityTierWithParsed[] = activity.tiers.map((t) => ({
        id: t.id,
        tierLevel: t.tierLevel,
        conditions: t.conditions as TierConditions,
        rewards: t.rewards as TierRewards,
      }))

      const { currentTier, nextTier, gapToNext } = resolveUserProgress(
        parsedTiers,
        userStats
      )

      userProgress = {
        totalAmount: userStats.totalAmount,
        validInviteCount: userStats.validInviteCount,
        currentTierLevel: currentTier?.tierLevel ?? 0,
        currentRewards: currentTier?.rewards ?? null,
        nextTierLevel: nextTier?.tierLevel ?? null,
        nextConditions: nextTier?.conditions ?? null,
        nextRewards: nextTier?.rewards ?? null,
        gapToNext, // { amountGap, inviteGap }，动态计算差值
      }
    }

    return NextResponse.json({
      activity: {
        id: activity.id,
        name: activity.name,
        startTime: activity.startTime,
        endTime: activity.endTime,
        tiers: activity.tiers.map((t) => ({
          id: t.id,
          tierLevel: t.tierLevel,
          conditions: t.conditions,
          rewards: t.rewards,
        })),
      },
      leaderboard: merged,
      userProgress,
    })
  } catch (error) {
    console.error("排行榜 API 错误:", error)
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
