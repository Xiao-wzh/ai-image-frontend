import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/check-admin"
import { cachedQuery } from "@/lib/analytics-cache"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 安全执行 raw query：在事务内设置 statement_timeout，超时自动终止
async function safeQuery<T>(sql: string, timeoutMs = 8000): Promise<T[]> {
  const result: unknown = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${timeoutMs}ms'`)
    return tx.$queryRawUnsafe(sql)
  })
  return result as T[]
}

// bigint → number
const toNumber = (rows: any[], fields: string[]) =>
  rows.map((row) => {
    const converted = { ...row }
    for (const f of fields) {
      if (typeof converted[f] === "bigint") converted[f] = Number(converted[f])
    }
    return converted
  })

// 留存分析 + 活跃分层 + 充值漏斗
export async function GET() {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const data = await cachedQuery("retention", async () => {
      // 留存分析：最近 8 周的 cohort
      const retentionData = await safeQuery<Array<{
        cohort_date: string
        cohort_size: bigint
        d1: bigint
        d3: bigint
        d7: bigint
        d14: bigint
        d30: bigint
      }>>(`
        WITH cohorts AS (
          SELECT DATE(u."createdAt" AT TIME ZONE '+08:00') as cohort_date,
                 u.id as user_id
          FROM "User" u
          WHERE u.role = 'USER'
            AND u."createdAt" >= (NOW() - INTERVAL '56 days') AT TIME ZONE '+08:00'
        ),
        cohort_sizes AS (
          SELECT cohort_date, COUNT(*) as cohort_size
          FROM cohorts GROUP BY cohort_date
        ),
        user_activity AS (
          SELECT DISTINCT g."userId", DATE(g."createdAt" AT TIME ZONE '+08:00') as activity_date
          FROM "Generation" g
          WHERE g."userId" IS NOT NULL
            AND g."createdAt" >= (NOW() - INTERVAL '86 days') AT TIME ZONE '+08:00'
        )
        SELECT
          cs.cohort_date::text,
          cs.cohort_size,
          COALESCE(SUM(CASE WHEN ua.activity_date = cs.cohort_date + INTERVAL '1 day' THEN 1 END), 0) as d1,
          COALESCE(SUM(CASE WHEN ua.activity_date <= cs.cohort_date + INTERVAL '3 days' AND ua.activity_date > cs.cohort_date THEN 1 END), 0) as d3,
          COALESCE(SUM(CASE WHEN ua.activity_date <= cs.cohort_date + INTERVAL '7 days' AND ua.activity_date > cs.cohort_date THEN 1 END), 0) as d7,
          COALESCE(SUM(CASE WHEN ua.activity_date <= cs.cohort_date + INTERVAL '14 days' AND ua.activity_date > cs.cohort_date THEN 1 END), 0) as d14,
          COALESCE(SUM(CASE WHEN ua.activity_date <= cs.cohort_date + INTERVAL '30 days' AND ua.activity_date > cs.cohort_date THEN 1 END), 0) as d30
        FROM cohort_sizes cs
        LEFT JOIN cohorts c ON c.cohort_date = cs.cohort_date
        LEFT JOIN user_activity ua ON ua."userId" = c.user_id
        GROUP BY cs.cohort_date, cs.cohort_size
        ORDER BY cs.cohort_date DESC
        LIMIT 8
      `)

      // 活跃用户分层（限制最近 90 天内的数据）
      const userSegments = await safeQuery<Array<{
        segment: string
        count: bigint
      }>>(`
        WITH user_stats AS (
          SELECT u.id,
                 u."createdAt",
                 COUNT(g.id) as total_gens,
                 COUNT(DISTINCT DATE(g."createdAt" AT TIME ZONE '+08:00')) as usage_days
          FROM "User" u
          LEFT JOIN "Generation" g ON g."userId" = u.id
            AND g."createdAt" >= (NOW() - INTERVAL '90 days') AT TIME ZONE '+08:00'
          WHERE u.role = 'USER'
          GROUP BY u.id, u."createdAt"
        )
        SELECT
          CASE
            WHEN total_gens = 0 THEN '从未使用'
            WHEN usage_days <= 1 AND "createdAt" < NOW() - INTERVAL '30 days' THEN '已流失'
            WHEN usage_days = 1 THEN '仅1天'
            WHEN total_gens <= 5 THEN '轻度'
            WHEN total_gens <= 20 THEN '中度'
            ELSE '重度'
          END as segment,
          COUNT(*) as count
        FROM user_stats
        GROUP BY segment
      `)

      // 充值转化漏斗
      const funnel = await safeQuery<Array<{
        step: string
        count: bigint
      }>>(`
        SELECT 'registered' as step, COUNT(*) as count FROM "User" WHERE role = 'USER'
        UNION ALL
        SELECT 'generated', COUNT(DISTINCT "userId") FROM "Generation" WHERE "userId" IS NOT NULL
        UNION ALL
        SELECT 'bonus_exhausted', COUNT(*) FROM "User" WHERE role = 'USER' AND "bonusCredits" <= 0
        UNION ALL
        SELECT 'first_paid', COUNT(DISTINCT "userId") FROM "Order" WHERE status = 'PAID' AND "userId" IS NOT NULL
        UNION ALL
        SELECT 'repeat_paid', COUNT(DISTINCT "userId") FROM "Order" WHERE status = 'PAID' AND "userId" IS NOT NULL GROUP BY "userId" HAVING COUNT(*) >= 2
      `)

      return {
        retention: toNumber(retentionData, ["cohort_size", "d1", "d3", "d7", "d14", "d30"]),
        segments: toNumber(userSegments, ["count"]),
        funnel: toNumber(funnel, ["count"]),
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[Analytics Retention] Error:", error)
    return NextResponse.json({ error: "获取数据失败" }, { status: 500 })
  }
}
