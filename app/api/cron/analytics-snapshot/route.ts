/**
 * Analytics 预计算快照
 *
 * GET /api/cron/analytics-snapshot
 * - 默认：计算今天（北京时间）的数据，upsert 到 DailyAnalytics 表
 * - ?backfill=90：补算最近 90 天（最多 365 天）
 * - ?date=2026-04-01：计算指定日期
 *
 * 鉴权：CRON_SECRET（与 daily-report 一致）
 *
 * 设计要点：
 * - 每次只查 1 天的业务数据（几千行），不会影响正常服务
 * - upsert 语义：同一日期重复跑不会重复插入
 * - 可通过 Vercel Cron 每 5-10 分钟调用，保持"今天"数据新鲜
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UTC8_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** 获取北京时间今天的 YYYY-MM-DD */
function getBeijingTodayStr(): string {
  return new Date(Date.now() + UTC8_MS).toISOString().split("T")[0]
}

/** 将北京时间日期字符串转为 UTC Date 范围 [dayStart, nextDayStart) */
function getUTC8DayRange(dateStr: string): [Date, Date] {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dayStart = new Date(Date.UTC(y, m - 1, d) - UTC8_MS)
  const nextDayStart = new Date(dayStart.getTime() + DAY_MS)
  return [dayStart, nextDayStart]
}

/** 计算某一天的 analytics 数据 */
async function computeDayAnalytics(dateStr: string) {
  const [dayStart, nextDayStart] = getUTC8DayRange(dateStr)

  const [
    newUsers,
    activeUsersRaw,
    genByStatusGroups,
    genByPlatformGroups,
    genByTypeGroups,
    genByHourRaw,
    orderAgg,
    paidUsersRaw,
    planSalesRaw,
    videoAgg,
    videoCompletedCount,
  ] = await Promise.all([
    // 新注册用户数
    prisma.user.count({
      where: { role: "USER", createdAt: { gte: dayStart, lt: nextDayStart } },
    }),

    // 活跃用户数（有 Generation 记录的去重用户）
    prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(DISTINCT "userId") as cnt FROM "Generation"
      WHERE "createdAt" >= ${dayStart} AND "createdAt" < ${nextDayStart}
        AND "userId" IS NOT NULL
    `,

    // 按状态分组
    prisma.generation.groupBy({
      by: ["status"],
      where: { createdAt: { gte: dayStart, lt: nextDayStart } },
      _count: true,
    }),

    // 按平台分组
    prisma.generation.groupBy({
      by: ["platformKey"],
      where: {
        createdAt: { gte: dayStart, lt: nextDayStart },
        platformKey: { not: null },
      },
      _count: true,
    }),

    // 按商品类型分组
    prisma.generation.groupBy({
      by: ["productType"],
      where: { createdAt: { gte: dayStart, lt: nextDayStart } },
      _count: true,
    }),

    // 按小时分组（北京时间）
    prisma.$queryRaw<Array<{ hour: number; cnt: bigint }>>`
      SELECT EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE '+08:00'))::int as hour,
             COUNT(*) as cnt
      FROM "Generation"
      WHERE "createdAt" >= ${dayStart} AND "createdAt" < ${nextDayStart}
      GROUP BY hour ORDER BY hour
    `,

    // 订单汇总
    prisma.order.aggregate({
      where: { status: "PAID", paidAt: { gte: dayStart, lt: nextDayStart } },
      _sum: { amount: true },
      _count: true,
    }),

    // 付费用户数（去重）
    prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(DISTINCT "userId") as cnt FROM "Order"
      WHERE status = 'PAID' AND "paidAt" >= ${dayStart} AND "paidAt" < ${nextDayStart}
        AND "userId" IS NOT NULL
    `,

    // 按套餐销售分布
    prisma.$queryRaw<
      Array<{ plan_name: string; order_count: bigint; total_revenue: bigint }>
    >`
      SELECT COALESCE(p.name, '未知套餐') as plan_name,
             COUNT(*) as order_count,
             SUM(o.amount) as total_revenue
      FROM "Order" o
      LEFT JOIN "Plan" p ON p.id = o."planId"
      WHERE o.status = 'PAID'
        AND o."paidAt" >= ${dayStart}
        AND o."paidAt" < ${nextDayStart}
      GROUP BY p.name
      ORDER BY total_revenue DESC
    `,

    // 视频生成总量 + 成本
    prisma.videoGeneration.aggregate({
      where: { createdAt: { gte: dayStart, lt: nextDayStart } },
      _count: true,
      _sum: { cost: true },
    }),

    // 视频完成数
    prisma.videoGeneration.count({
      where: {
        status: "COMPLETED",
        createdAt: { gte: dayStart, lt: nextDayStart },
      },
    }),
  ])

  const activeUsers = Number(activeUsersRaw[0]?.cnt ?? 0)

  // genByStatus + 拆分到独立字段
  const genByStatus: Record<string, number> = {}
  let genCompleted = 0
  let genFailed = 0
  let genPartial = 0
  let genPending = 0
  for (const g of genByStatusGroups) {
    const count = g._count
    genByStatus[g.status] = count
    if (g.status === "COMPLETED") genCompleted = count
    else if (g.status === "FAILED") genFailed = count
    else if (g.status === "PARTIAL_SUCCESS") genPartial = count
    else if (g.status === "PENDING" || g.status === "PROCESSING") genPending += count
  }

  // genByPlatform
  const genByPlatform: Record<string, number> = {}
  for (const g of genByPlatformGroups) {
    genByPlatform[g.platformKey || "未知"] = g._count
  }

  // genByType
  const genByType: Record<string, number> = {}
  for (const g of genByTypeGroups) {
    genByType[g.productType] = g._count
  }

  // genByHour
  const genByHour: Record<string, number> = {}
  for (const h of genByHourRaw) {
    genByHour[String(h.hour)] = Number(h.cnt)
  }

  // planSales
  const planSales: Record<string, { count: number; revenue: number }> = {}
  for (const p of planSalesRaw) {
    planSales[p.plan_name] = {
      count: Number(p.order_count),
      revenue: Number(p.total_revenue),
    }
  }

  return {
    date: dateStr,
    newUsers,
    activeUsers,
    genCompleted,
    genFailed,
    genPartial,
    genPending,
    revenue: orderAgg._sum.amount || 0,
    orderCount: orderAgg._count,
    paidUsers: Number(paidUsersRaw[0]?.cnt ?? 0),
    videoCount: videoAgg._count,
    videoCompleted: videoCompletedCount,
    videoCost: videoAgg._sum.cost || 0,
    genByStatus,
    genByPlatform,
    genByType,
    genByHour,
    planSales,
  }
}

export async function GET(req: NextRequest) {
  // 鉴权：与 daily-report 一致
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const querySecret = req.nextUrl.searchParams.get("secret")
  if (
    !cronSecret ||
    (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const backfill = parseInt(
      req.nextUrl.searchParams.get("backfill") || "0"
    )
    const dateParam = req.nextUrl.searchParams.get("date")

    // 确定要计算的日期列表
    const dates: string[] = []
    if (dateParam) {
      // 指定日期
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return NextResponse.json(
          { error: "date 格式无效，应为 YYYY-MM-DD" },
          { status: 400 }
        )
      }
      dates.push(dateParam)
    } else if (backfill > 0) {
      // 补算最近 N 天（含今天）
      const maxDays = Math.min(backfill, 365)
      const todayMs = Date.now() + UTC8_MS
      for (let i = 0; i < maxDays; i++) {
        const ms = todayMs - i * DAY_MS
        dates.push(new Date(ms).toISOString().split("T")[0])
      }
    } else {
      // 默认：计算今天
      dates.push(getBeijingTodayStr())
    }

    const results: string[] = []
    const errors: string[] = []

    for (const dateStr of dates) {
      try {
        const data = await computeDayAnalytics(dateStr)
        const { date: _, ...updateData } = data

        await prisma.dailyAnalytics.upsert({
          where: { date: dateStr },
          create: data,
          update: updateData,
        })

        results.push(dateStr)
      } catch (err: any) {
        console.error(
          `[analytics-snapshot] 计算 ${dateStr} 失败:`,
          err?.message
        )
        errors.push(`${dateStr}: ${err?.message || "未知错误"}`)
      }
    }

    console.log(
      `[analytics-snapshot] 预计算完成: ${results.length}/${dates.length} 天成功`
    )

    return NextResponse.json({
      success: true,
      message: `已预计算 ${results.length}/${dates.length} 天数据`,
      dates: results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error("[analytics-snapshot] 预计算失败:", error)
    return NextResponse.json(
      { error: "预计算失败", message: error?.message || "未知错误" },
      { status: 500 }
    )
  }
}
