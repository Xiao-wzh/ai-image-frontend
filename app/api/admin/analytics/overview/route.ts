import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/check-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 今日/昨日概览指标
export async function GET() {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    // 北京时间今天 00:00:00
    const now = new Date()
    const beijingOffset = 8 * 60 * 60 * 1000
    const beijingNow = new Date(now.getTime() + beijingOffset)
    const todayStr = beijingNow.toISOString().split("T")[0]
    const todayStart = new Date(todayStr + "T00:00:00+08:00")
    const todayEnd = new Date(todayStr + "T23:59:59+08:00")

    // 昨天
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayEnd = new Date(todayEnd.getTime() - 24 * 60 * 60 * 1000)

    // 当月开始
    const monthStart = new Date(`${beijingNow.toISOString().slice(0, 7)}-01T00:00:00+08:00`)

    // 并行查询
    const [
      todayOrders,
      yesterdayOrders,
      monthOrders,
      todayNewUsers,
      yesterdayNewUsers,
      monthNewUsers,
      todayActiveUsers,
      yesterdayActiveUsers,
      todayGenerations,
      yesterdayGenerations,
    ] = await Promise.all([
      // 今日/昨日/当月 订单
      prisma.order.findMany({
        where: { status: "PAID", paidAt: { gte: todayStart, lte: todayEnd } },
        select: { amount: true },
      }),
      prisma.order.findMany({
        where: { status: "PAID", paidAt: { gte: yesterdayStart, lte: yesterdayEnd } },
        select: { amount: true },
      }),
      prisma.order.findMany({
        where: { status: "PAID", paidAt: { gte: monthStart } },
        select: { amount: true, userId: true },
      }),
      // 今日/昨日/当月 新用户
      prisma.user.count({ where: { role: "USER", createdAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.user.count({ where: { role: "USER", createdAt: { gte: yesterdayStart, lte: yesterdayEnd } } }),
      prisma.user.count({ where: { role: "USER", createdAt: { gte: monthStart } } }),
      // 今日/昨日 活跃用户（注册日期早于当日的 Generation 去重用户）
      prisma.$queryRaw<Array<{ cnt: bigint }>>`
        SELECT COUNT(DISTINCT "userId") as cnt FROM "Generation"
        WHERE "createdAt" >= ${todayStart} AND "createdAt" <= ${todayEnd}
          AND "userId" IS NOT NULL
          AND "userId" NOT IN (
            SELECT id FROM "User" WHERE "createdAt" >= ${todayStart}
          )
      `,
      prisma.$queryRaw<Array<{ cnt: bigint }>>`
        SELECT COUNT(DISTINCT "userId") as cnt FROM "Generation"
        WHERE "createdAt" >= ${yesterdayStart} AND "createdAt" <= ${yesterdayEnd}
          AND "userId" IS NOT NULL
          AND "userId" NOT IN (
            SELECT id FROM "User" WHERE "createdAt" >= ${yesterdayStart} AND "createdAt" <= ${yesterdayEnd}
          )
      `,
      // 今日/昨日 生成任务
      prisma.generation.groupBy({
        by: ["status"],
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
        _count: true,
      }),
      prisma.generation.groupBy({
        by: ["status"],
        where: { createdAt: { gte: yesterdayStart, lte: yesterdayEnd } },
        _count: true,
      }),
    ])

    const sumAmount = (orders: { amount: number }[]) =>
      orders.reduce((s, o) => s + o.amount, 0)

    const todayRevenue = sumAmount(todayOrders)
    const yesterdayRevenue = sumAmount(yesterdayOrders)
    const monthRevenue = sumAmount(monthOrders)

    const todayActive = Number(todayActiveUsers[0]?.cnt ?? 0)
    const yesterdayActive = Number(yesterdayActiveUsers[0]?.cnt ?? 0)

    // 成功率
    const todayTotal = todayGenerations.reduce((s, g) => s + g._count, 0)
    const todaySuccess = todayGenerations
      .filter((g) => g.status === "COMPLETED" || g.status === "PARTIAL_SUCCESS")
      .reduce((s, g) => s + g._count, 0)
    const yesterdayTotal = yesterdayGenerations.reduce((s, g) => s + g._count, 0)
    const yesterdaySuccess = yesterdayGenerations
      .filter((g) => g.status === "COMPLETED" || g.status === "PARTIAL_SUCCESS")
      .reduce((s, g) => s + g._count, 0)

    const successRate = todayTotal > 0 ? Math.round((todaySuccess / todayTotal) * 100) : 0
    const yesterdaySuccessRate = yesterdayTotal > 0 ? Math.round((yesterdaySuccess / yesterdayTotal) * 100) : 0

    // ARPU（当月收入/当月活跃用户数，简化为当月付费用户数）
    const monthPaidUsers = new Set(monthOrders.map((o) => o.userId).filter(Boolean)).size
    const arpu = monthPaidUsers > 0 ? (monthRevenue / 100 / monthPaidUsers) : 0

    return NextResponse.json({
      success: true,
      data: {
        todayRevenue,
        yesterdayRevenue,
        revenueChange: yesterdayRevenue > 0
          ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
          : (todayRevenue > 0 ? 100 : 0),
        monthRevenue,

        todayOrders: todayOrders.length,
        yesterdayOrders: yesterdayOrders.length,
        ordersChange: yesterdayOrders.length > 0
          ? Math.round(((todayOrders.length - yesterdayOrders.length) / yesterdayOrders.length) * 100)
          : (todayOrders.length > 0 ? 100 : 0),

        todayNewUsers,
        yesterdayNewUsers,
        newUsersChange: yesterdayNewUsers > 0
          ? Math.round(((todayNewUsers - yesterdayNewUsers) / yesterdayNewUsers) * 100)
          : (todayNewUsers > 0 ? 100 : 0),
        monthNewUsers,

        todayActive,
        yesterdayActive,
        activeChange: yesterdayActive > 0
          ? Math.round(((todayActive - yesterdayActive) / yesterdayActive) * 100)
          : (todayActive > 0 ? 100 : 0),

        successRate,
        yesterdaySuccessRate,

        arpu: Math.round(arpu * 100) / 100,
      },
    })
  } catch (error) {
    console.error("[Analytics Overview] Error:", error)
    return NextResponse.json({ error: "获取数据失败" }, { status: 500 })
  }
}
