import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/check-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 分类分布数据
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get("period") || "30d"

    const now = new Date()
    const beijingOffset = 8 * 60 * 60 * 1000
    const beijingNow = new Date(now.getTime() + beijingOffset)
    const todayStr = beijingNow.toISOString().split("T")[0]

    const days = parseInt(period) || 30
    const startDate = new Date(todayStr + "T00:00:00+08:00")
    const startDateAdjusted = new Date(startDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
    const endDate = new Date(todayStr + "T23:59:59+08:00")

    const [platformDist, productTypeDist, planSales, hourlyDist] = await Promise.all([
      // 平台分布
      prisma.generation.groupBy({
        by: ["platformKey"],
        where: {
          createdAt: { gte: startDateAdjusted, lte: endDate },
          platformKey: { not: null },
        },
        _count: true,
        orderBy: { _count: { platformKey: "desc" } },
      }),
      // 商品类型分布
      prisma.generation.groupBy({
        by: ["productType"],
        where: { createdAt: { gte: startDateAdjusted, lte: endDate } },
        _count: true,
        orderBy: { _count: { productType: "desc" } },
        take: 10,
      }),
      // 套餐销售
      prisma.$queryRawUnsafe<Array<{ plan_name: string; count: bigint; revenue: bigint }>>(`
        SELECT COALESCE(p.name, '未知套餐') as plan_name,
               COUNT(*) as count,
               SUM(o.amount) as revenue
        FROM "Order" o
        LEFT JOIN "Plan" p ON p.id = o."planId"
        WHERE o.status = 'PAID'
          AND o."paidAt" >= '${startDateAdjusted.toISOString()}'
          AND o."paidAt" <= '${endDate.toISOString()}'
        GROUP BY p.name
        ORDER BY revenue DESC
      `),
      // 24小时高峰时段
      prisma.$queryRawUnsafe<Array<{ hour: number; count: bigint }>>(`
        SELECT EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE '+08:00'))::int as hour,
               COUNT(*) as count
        FROM "Generation"
        WHERE "createdAt" >= '${startDateAdjusted.toISOString()}'
          AND "createdAt" <= '${endDate.toISOString()}'
        GROUP BY hour ORDER BY hour
      `),
    ])

    const toNumber = <T extends Record<string, unknown>>(rows: T[], fields: string[]) =>
      rows.map((row) => {
        const converted = { ...row } as Record<string, unknown>
        for (const f of fields) {
          if (typeof converted[f] === "bigint") converted[f] = Number(converted[f])
        }
        return converted as T
      })

    return NextResponse.json({
      success: true,
      data: {
        platform: platformDist.map((p) => ({
          name: p.platformKey || "未知",
          value: p._count,
        })),
        productType: productTypeDist.map((p) => ({
          name: p.productType,
          value: p._count,
        })),
        planSales: toNumber(planSales, ["count", "revenue"]),
        hourly: toNumber(hourlyDist, ["hour", "count"]),
      },
    })
  } catch (error) {
    console.error("[Analytics Distribution] Error:", error)
    return NextResponse.json({ error: "获取数据失败" }, { status: 500 })
  }
}
