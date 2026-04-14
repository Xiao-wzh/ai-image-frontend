/**
 * Analytics 概览 — 改为查 DailyAnalytics 预计算小表
 *
 * 只查 2-3 行（今天 + 昨天 + 月累计聚合），毫秒级响应。
 * 不再直接查 Generation / Order 等业务大表。
 */
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/check-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BEIJING_OFFSET = 8 * 60 * 60 * 1000

export async function GET() {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    // 北京时间日期
    const beijingNow = new Date(Date.now() + BEIJING_OFFSET)
    const todayStr = beijingNow.toISOString().split("T")[0]
    const yesterdayStr = new Date(
      beijingNow.getTime() - 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0]
    const monthStartStr = beijingNow.toISOString().slice(0, 7) + "-01"

    // 查今天 + 昨天的预计算行
    const [todayRow, yesterdayRow] = await Promise.all([
      prisma.dailyAnalytics.findUnique({ where: { date: todayStr } }),
      prisma.dailyAnalytics.findUnique({ where: { date: yesterdayStr } }),
    ])

    // 月累计聚合
    const monthAgg = await prisma.dailyAnalytics.aggregate({
      _sum: { revenue: true, newUsers: true, orderCount: true, paidUsers: true },
      where: { date: { gte: monthStartStr, lte: todayStr } },
    })

    const todayRevenue = todayRow?.revenue || 0
    const yesterdayRevenue = yesterdayRow?.revenue || 0
    const monthRevenue = monthAgg._sum.revenue || 0

    const todayOrders = todayRow?.orderCount || 0
    const yesterdayOrders = yesterdayRow?.orderCount || 0

    const todayNewUsers = todayRow?.newUsers || 0
    const yesterdayNewUsers = yesterdayRow?.newUsers || 0
    const monthNewUsers = monthAgg._sum.newUsers || 0

    const todayActive = todayRow?.activeUsers || 0
    const yesterdayActive = yesterdayRow?.activeUsers || 0

    // 成功率
    const todayTotal =
      (todayRow?.genCompleted || 0) +
      (todayRow?.genFailed || 0) +
      (todayRow?.genPartial || 0) +
      (todayRow?.genPending || 0)
    const todaySuccess =
      (todayRow?.genCompleted || 0) + (todayRow?.genPartial || 0)
    const yesterdayTotal =
      (yesterdayRow?.genCompleted || 0) +
      (yesterdayRow?.genFailed || 0) +
      (yesterdayRow?.genPartial || 0) +
      (yesterdayRow?.genPending || 0)
    const yesterdaySuccess =
      (yesterdayRow?.genCompleted || 0) + (yesterdayRow?.genPartial || 0)

    const successRate =
      todayTotal > 0 ? Math.round((todaySuccess / todayTotal) * 100) : 0
    const yesterdaySuccessRate =
      yesterdayTotal > 0
        ? Math.round((yesterdaySuccess / yesterdayTotal) * 100)
        : 0

    // ARPU（近似值：用日付费用户之和 ÷ 月收入）
    const monthPaidUsers = monthAgg._sum.paidUsers || 0
    const arpu = monthPaidUsers > 0 ? monthRevenue / 100 / monthPaidUsers : 0

    return NextResponse.json({
      success: true,
      data: {
        todayRevenue,
        yesterdayRevenue,
        revenueChange:
          yesterdayRevenue > 0
            ? Math.round(
                ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
              )
            : todayRevenue > 0
              ? 100
              : 0,
        monthRevenue,
        todayOrders,
        yesterdayOrders,
        ordersChange:
          yesterdayOrders > 0
            ? Math.round(
                ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100
              )
            : todayOrders > 0
              ? 100
              : 0,
        todayNewUsers,
        yesterdayNewUsers,
        newUsersChange:
          yesterdayNewUsers > 0
            ? Math.round(
                ((todayNewUsers - yesterdayNewUsers) / yesterdayNewUsers) * 100
              )
            : todayNewUsers > 0
              ? 100
              : 0,
        monthNewUsers,
        todayActive,
        yesterdayActive,
        activeChange:
          yesterdayActive > 0
            ? Math.round(
                ((todayActive - yesterdayActive) / yesterdayActive) * 100
              )
            : todayActive > 0
              ? 100
              : 0,
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
