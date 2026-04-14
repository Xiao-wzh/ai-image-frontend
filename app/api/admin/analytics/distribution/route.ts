/**
 * Analytics 分布 — 改为查 DailyAnalytics 预计算小表
 *
 * 查 N 行，从 JSON 字段聚合平台/商品类型/小时/套餐分布。
 * 不再直接查 Generation / Order 大表。
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

    // 日期范围
    const beijingNow = new Date(Date.now() + BEIJING_OFFSET)
    const todayStr = beijingNow.toISOString().split("T")[0]
    const days = Math.min(parseInt(period) || 30, 90)
    const startDateStr = new Date(
      beijingNow.getTime() - (days - 1) * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0]

    // 查预计算数据
    const rows = await prisma.dailyAnalytics.findMany({
      where: { date: { gte: startDateStr, lte: todayStr } },
      orderBy: { date: "asc" },
    })

    // 聚合 JSON 字段
    const platformMap = new Map<string, number>()
    const productTypeMap = new Map<string, number>()
    const planSalesMap = new Map<string, { count: number; revenue: number }>()
    const hourlyMap = new Map<number, number>()

    for (const row of rows) {
      // 平台分布
      const byPlatform = row.genByPlatform as Record<string, number>
      for (const [key, val] of Object.entries(byPlatform)) {
        platformMap.set(key, (platformMap.get(key) || 0) + val)
      }

      // 商品类型分布
      const byType = row.genByType as Record<string, number>
      for (const [key, val] of Object.entries(byType)) {
        productTypeMap.set(key, (productTypeMap.get(key) || 0) + val)
      }

      // 套餐销售分布
      const sales = row.planSales as Record<string, { count: number; revenue: number }>
      for (const [name, data] of Object.entries(sales)) {
        const existing = planSalesMap.get(name) || { count: 0, revenue: 0 }
        existing.count += data.count
        existing.revenue += data.revenue
        planSalesMap.set(name, existing)
      }

      // 24小时分布
      const byHour = row.genByHour as Record<string, number>
      for (const [hourStr, val] of Object.entries(byHour)) {
        const hour = Number(hourStr)
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + val)
      }
    }

    // 排序输出（与原 API 格式一致）
    const platform = Array.from(platformMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const productType = Array.from(productTypeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const planSales = Array.from(planSalesMap.entries())
      .map(([plan_name, data]) => ({
        plan_name,
        count: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    const hourly = Array.from(hourlyMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour)

    return NextResponse.json({
      success: true,
      data: { platform, productType, planSales, hourly },
    })
  } catch (error) {
    console.error("[Analytics Distribution] Error:", error)
    return NextResponse.json({ error: "获取数据失败" }, { status: 500 })
  }
}
