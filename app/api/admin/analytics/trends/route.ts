import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/check-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 按日/月聚合趋势数据
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get("period") || "30d"

    // 计算日期范围
    const now = new Date()
    const beijingOffset = 8 * 60 * 60 * 1000
    const beijingNow = new Date(now.getTime() + beijingOffset)
    const todayStr = beijingNow.toISOString().split("T")[0]

    let startDate: Date
    const isMonthly = period === "12m"

    if (isMonthly) {
      startDate = new Date(`${beijingNow.getFullYear() - 1}-${String(beijingNow.getMonth() + 1).padStart(2, "0")}-01T00:00:00+08:00`)
    } else {
      const days = parseInt(period) || 30
      startDate = new Date(todayStr + "T00:00:00+08:00")
      startDate = new Date(startDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
    }

    const endDate = new Date(todayStr + "T23:59:59+08:00")

    // 根据粒度选择分组方式
    const dateFormat = isMonthly ? "YYYY-MM" : "YYYY-MM-DD"

    // 并行查询：收入、用户增长、活跃用户、生成任务
    const [revenue, userGrowth, activeUsers, generations] = await Promise.all([
      // 收入趋势
      prisma.$queryRawUnsafe<Array<{ date: string; revenue: bigint; order_count: bigint }>>(`
        SELECT to_char(("paidAt" AT TIME ZONE '+08:00'), '${dateFormat}') as date,
               SUM(amount) as revenue,
               COUNT(*) as order_count
        FROM "Order"
        WHERE status = 'PAID' AND "paidAt" >= '${startDate.toISOString()}' AND "paidAt" <= '${endDate.toISOString()}'
        GROUP BY date ORDER BY date
      `),
      // 用户增长
      prisma.$queryRawUnsafe<Array<{ date: string; new_users: bigint }>>(`
        SELECT to_char(("createdAt" AT TIME ZONE '+08:00'), '${dateFormat}') as date,
               COUNT(*) as new_users
        FROM "User"
        WHERE role = 'USER' AND "createdAt" >= '${startDate.toISOString()}' AND "createdAt" <= '${endDate.toISOString()}'
        GROUP BY date ORDER BY date
      `),
      // 活跃用户（有 Generation 记录的去重用户，排除当天注册的）
      prisma.$queryRawUnsafe<Array<{ date: string; active_users: bigint }>>(`
        SELECT to_char((g."createdAt" AT TIME ZONE '+08:00'), '${dateFormat}') as date,
               COUNT(DISTINCT g."userId") as active_users
        FROM "Generation" g
        WHERE g."createdAt" >= '${startDate.toISOString()}' AND g."createdAt" <= '${endDate.toISOString()}'
          AND g."userId" IS NOT NULL
          AND g."userId" NOT IN (
            SELECT u.id FROM "User" u
            WHERE u."createdAt" >= (g."createdAt" AT TIME ZONE '+08:00')::date
          )
        GROUP BY date ORDER BY date
      `),
      // 生成任务状态分布
      prisma.$queryRawUnsafe<Array<{ date: string; status: string; count: bigint }>>(`
        SELECT to_char(("createdAt" AT TIME ZONE '+08:00'), '${dateFormat}') as date,
               status,
               COUNT(*) as count
        FROM "Generation"
        WHERE "createdAt" >= '${startDate.toISOString()}' AND "createdAt" <= '${endDate.toISOString()}'
        GROUP BY date, status ORDER BY date, status
      `),
    ])

    // 转换 bigint 为 number
    const convertBigint = <T extends Record<string, unknown>>(rows: T[], fields: string[]): T[] =>
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
        revenue: convertBigint(revenue, ["revenue", "order_count"]),
        userGrowth: convertBigint(userGrowth, ["new_users"]),
        activeUsers: convertBigint(activeUsers, ["active_users"]),
        generations: convertBigint(generations, ["count"]),
      },
    })
  } catch (error) {
    console.error("[Analytics Trends] Error:", error)
    return NextResponse.json({ error: "获取数据失败" }, { status: 500 })
  }
}
