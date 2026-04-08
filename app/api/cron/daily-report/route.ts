/**
 * 每日营运数据汇总 & 邮件推送
 *
 * GET /api/cron/daily-report
 * - Vercel Cron 自动触发（通过 query ?secret=xxx 鉴权）
 * - 外部手动调用（通过 Authorization: Bearer xxx 鉴权）
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { createTransport } from "nodemailer"
import { buildDailyReportHtml, type DailyReportData } from "@/lib/daily-report-email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ========== UTC+8 时区工具 ==========

const UTC8_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** 获取东八区当前时间 */
function getUTC8Now(): Date {
  const now = new Date()
  return new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + UTC8_MS)
}

/** 获取东八区某天 00:00:00 对应的 UTC Date */
function getUTC8DayStart(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - UTC8_MS)
}

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]

export async function GET(req: NextRequest) {
  // 1. 鉴权：支持 Bearer Token 和 query 参数两种方式
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const querySecret = req.nextUrl.searchParams.get("secret")

  if (!cronSecret || (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(e => e.trim()).filter(Boolean) || []
  if (adminEmails.length === 0) {
    console.error("[daily-report] 缺少 ADMIN_EMAILS 环境变量")
    return NextResponse.json({ error: "ADMIN_EMAILS 未配置" }, { status: 500 })
  }

  try {
    // 2. 时区计算
    const utc8Now = getUTC8Now()
    const todayStart = getUTC8DayStart(utc8Now.getFullYear(), utc8Now.getMonth(), utc8Now.getDate())
    const tomorrowStart = new Date(todayStart.getTime() + DAY_MS)

    const dateStr = `${utc8Now.getFullYear()}-${String(utc8Now.getMonth() + 1).padStart(2, "0")}-${String(utc8Now.getDate()).padStart(2, "0")}`
    const weekday = WEEKDAYS[utc8Now.getDay()]

    // 3. 并发查询 6 个指标
    const [
      newUsersCount,
      generationGroups,
      newUsers,
      paidOrders,
      completedCount,
      approvedAppeals,
    ] = await Promise.all([
      // #1 今日新增注册用户数
      prisma.user.count({
        where: { createdAt: { gte: todayStart, lt: tomorrowStart } },
      }),

      // #2 今日活跃生图用户数（按 userId 去重）
      prisma.generation.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: todayStart, lt: tomorrowStart } },
        _count: { id: true },
      }),

      // #3 今日新增用户 ID 列表
      prisma.user.findMany({
        where: { createdAt: { gte: todayStart, lt: tomorrowStart } },
        select: { id: true },
      }),

      // #4 今日已付订单
      prisma.order.findMany({
        where: { status: "PAID", paidAt: { gte: todayStart, lt: tomorrowStart } },
        select: { userId: true, amount: true, snapshot: true },
      }),

      // #5 今日完成生成次数
      prisma.generation.count({
        where: { status: "COMPLETED", createdAt: { gte: todayStart, lt: tomorrowStart } },
      }),

      // #6 今日申诉退款
      prisma.appeal.findMany({
        where: { status: "APPROVED", createdAt: { gte: todayStart, lt: tomorrowStart } },
        select: { refundAmount: true },
      }),
    ])

    // 4. 内存聚合
    const newUserIds = new Set(newUsers.map(u => u.id))
    const activeUserCount = generationGroups.length

    // 新用户转化
    const newUserOrders = paidOrders.filter(o => o.userId && newUserIds.has(o.userId))
    const newConvertedUsers = new Set(newUserOrders.map(o => o.userId!)).size
    const newConvertedOrders = newUserOrders.length
    const newConvertedAmount = newUserOrders.reduce((sum, o) => sum + o.amount, 0)

    // 套餐分布（从新用户订单中提取）
    const planMap = new Map<string, number>()
    for (const o of newUserOrders) {
      const snap = o.snapshot as Record<string, any> | null
      const planName = snap?.name || "未知套餐"
      planMap.set(planName, (planMap.get(planName) || 0) + 1)
    }
    const planBreakdown = Array.from(planMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // 营收拆分
    const newUserRevenue = newUserOrders.reduce((sum, o) => sum + o.amount, 0)
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.amount, 0)
    const oldUserRevenue = totalRevenue - newUserRevenue

    // 退款
    const refundAmount = approvedAppeals.reduce((sum, a) => sum + a.refundAmount, 0)

    // 算力成本估算：完成次数 × 0.3 元
    const aiCost = completedCount * 0.3

    // 5. 组装数据
    const reportData: DailyReportData = {
      date: dateStr,
      weekday,
      newUsers: newUsersCount,
      activeUsers: activeUserCount,
      completedGenerations: completedCount,
      newConvertedUsers,
      newConvertedOrders,
      newConvertedAmount,
      planBreakdown,
      totalRevenue,
      newUserRevenue,
      oldUserRevenue,
      paidOrderCount: paidOrders.length,
      refundAmount,
      aiCost,
    }

    // 6. 发送邮件
    const transport = createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT),
      secure: Number(process.env.EMAIL_SERVER_PORT) === 465,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    })

    const html = buildDailyReportHtml(reportData)
    const subject = `【AI-Species】每日营运汇总 ${dateStr} ${weekday}`

    // 并发发送给所有管理员
    const results = await Promise.allSettled(
      adminEmails.map(email =>
        transport.sendMail({ from: process.env.EMAIL_FROM, to: email, subject, html })
      )
    )

    const succeeded = adminEmails.filter((_, i) => results[i].status === "fulfilled")
    const failed = adminEmails.filter((_, i) => results[i].status === "rejected")

    if (failed.length > 0) {
      console.warn(`[daily-report] ⚠️ 部分邮件发送失败: ${failed.join(", ")}`)
    }
    console.log(`[daily-report] ✅ 日报邮件已发送至 ${succeeded.join(", ")}，日期：${dateStr}`)

    return NextResponse.json({
      success: true,
      message: `日报已发送至 ${succeeded.join(", ")}`,
      sentTo: succeeded,
      failed: failed.length > 0 ? failed : undefined,
      data: reportData,
    })
  } catch (error: any) {
    console.error("[daily-report] ❌ 发送日报失败:", error)
    return NextResponse.json(
      { error: "发送失败", message: error?.message || "未知错误" },
      { status: 500 }
    )
  }
}
