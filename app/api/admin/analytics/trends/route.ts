/**
 * Analytics 趋势 — 改为查 DailyAnalytics 预计算小表
 *
 * 查 N 行（日期范围内），内存中做日/月聚合。
 * 不再直接查 Generation / Order / User 大表。
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/check-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BEIJING_OFFSET = 8 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get("period") || "30d"

    // 北京时间日期
    const beijingNow = new Date(Date.now() + BEIJING_OFFSET)
    const todayStr = beijingNow.toISOString().split("T")[0]
    const isMonthly = period === "12m"

    // 计算起始日期
    let startDateStr: string
    if (isMonthly) {
      const year = beijingNow.getFullYear() - 1
      const month = beijingNow.getMonth() + 1
      startDateStr = `${year}-${String(month).padStart(2, "0")}-01`
    } else {
      const days = Math.min(parseInt(period) || 30, 90)
      const startDate = new Date(
        beijingNow.getTime() - (days - 1) * 24 * 60 * 60 * 1000
      )
      startDateStr = startDate.toISOString().split("T")[0]
    }

    // 查预计算数据（轻量：最多 90 行）
    const rows = await prisma.dailyAnalytics.findMany({
      where: { date: { gte: startDateStr, lte: todayStr } },
      orderBy: { date: "asc" },
    })

    if (isMonthly) {
      // 按月聚合
      const monthMap = new Map<
        string,
        {
          revenue: number
          orderCount: number
          newUsers: number
          activeUsers: number
          genByStatus: Record<string, number>
        }
      >()

      for (const row of rows) {
        const month = row.date.slice(0, 7) // YYYY-MM
        const existing = monthMap.get(month) || {
          revenue: 0,
          orderCount: 0,
          newUsers: 0,
          activeUsers: 0,
          genByStatus: {},
        }
        existing.revenue += row.revenue
        existing.orderCount += row.orderCount
        existing.newUsers += row.newUsers
        existing.activeUsers += row.activeUsers
        for (const [status, count] of Object.entries(
          row.genByStatus as Record<string, number>
        )) {
          existing.genByStatus[status] =
            (existing.genByStatus[status] || 0) + count
        }
        monthMap.set(month, existing)
      }

      const entries = Array.from(monthMap.entries()).sort(([a], [b]) =>
        a.localeCompare(b)
      )

      return NextResponse.json({
        success: true,
        data: {
          revenue: entries.map(([date, d]) => ({
            date,
            revenue: d.revenue,
            order_count: d.orderCount,
          })),
          userGrowth: entries.map(([date, d]) => ({
            date,
            new_users: d.newUsers,
          })),
          activeUsers: entries.map(([date, d]) => ({
            date,
            active_users: d.activeUsers,
          })),
          generations: entries.flatMap(([date, d]) =>
            Object.entries(d.genByStatus).map(([status, count]) => ({
              date,
              status,
              count,
            }))
          ),
        },
      })
    }

    // 日粒度：直接转换
    return NextResponse.json({
      success: true,
      data: {
        revenue: rows.map((r) => ({
          date: r.date,
          revenue: r.revenue,
          order_count: r.orderCount,
        })),
        userGrowth: rows.map((r) => ({
          date: r.date,
          new_users: r.newUsers,
        })),
        activeUsers: rows.map((r) => ({
          date: r.date,
          active_users: r.activeUsers,
        })),
        generations: rows.flatMap((r) => {
          const byStatus = r.genByStatus as Record<string, number>
          return Object.entries(byStatus).map(([status, count]) => ({
            date: r.date,
            status,
            count,
          }))
        }),
      },
    })
  } catch (error) {
    console.error("[Analytics Trends] Error:", error)
    return NextResponse.json({ error: "获取数据失败" }, { status: 500 })
  }
}
