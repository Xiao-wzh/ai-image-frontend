import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/check-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    try {
        // 管理员权限校验
        const guard = await requireAdmin()
        if (!guard.ok) {
            return NextResponse.json({ error: guard.error }, { status: guard.status })
        }

        // 解析日期参数 (使用 UTC+8 北京时间)
        const { searchParams } = new URL(req.url)
        const startStr = searchParams.get("start")
        const endStr = searchParams.get("end")

        // 默认最近7天
        const now = new Date()
        // 使用明确的时区偏移 (+08:00)
        const end = endStr ? new Date(endStr + "T23:59:59+08:00") : now
        const start = startStr ? new Date(startStr + "T00:00:00+08:00") : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        // 查询消费记录
        const records = await prisma.creditRecord.findMany({
            where: {
                type: { in: ["CONSUME", "SERVICE_UNLOCK", "REFUND"] },
                createdAt: { gte: start, lte: end },
            },
            select: {
                amount: true,
                description: true,
                type: true,
                createdAt: true,
            },
            orderBy: { createdAt: "asc" },
        })

        // 分类统计
        let mainImage = 0           // 主图正常生成
        let mainImageRetry = 0      // 主图优惠重试
        let detailPage = 0          // 详情页正常生成
        let detailPageRetry = 0     // 详情页优惠重试
        let copywriting = 0         // 智能商品描述
        let removeWatermark = 0     // 去水印
        let addWatermark = 0        // 加水印
        let appealRefund = 0        // 申诉退款
        let failureRefund = 0       // 失败退款

        type DailyStats = {
            mainImage: number
            mainImageRetry: number
            detailPage: number
            detailPageRetry: number
            copywriting: number
            removeWatermark: number
            addWatermark: number
            appealRefund: number
            failureRefund: number
        }
        const dailyStats: Record<string, DailyStats> = {}

        // 辅助函数：将 UTC 时间转换为北京时间日期字符串
        const toBeijingDateString = (date: Date) => {
            const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
            return beijingTime.toISOString().split("T")[0]
        }

        const initDailyStats = (): DailyStats => ({
            mainImage: 0,
            mainImageRetry: 0,
            detailPage: 0,
            detailPageRetry: 0,
            copywriting: 0,
            removeWatermark: 0,
            addWatermark: 0,
            appealRefund: 0,
            failureRefund: 0,
        })

        for (const record of records) {
            const cost = Math.abs(record.amount)
            const desc = record.description || ""
            const date = toBeijingDateString(record.createdAt)

            if (!dailyStats[date]) {
                dailyStats[date] = initDailyStats()
            }

            if (record.type === "REFUND") {
                // 区分申诉退款和失败退款
                if (desc.startsWith("申诉退款")) {
                    appealRefund += cost
                    dailyStats[date].appealRefund += cost
                } else {
                    // 其他退款都是失败退款 (生成失败退款、折扣重试失败退款、图片编辑失败退款、智能文案生成失败退款等)
                    failureRefund += cost
                    dailyStats[date].failureRefund += cost
                }
            } else if (desc.startsWith("套餐生成")) {
                // 套餐生成包含主图和详情页，按比例分配 (假设各占50%)
                const mainCost = Math.floor(cost / 2)
                const detailCost = cost - mainCost
                mainImage += mainCost
                dailyStats[date].mainImage += mainCost
                detailPage += detailCost
                dailyStats[date].detailPage += detailCost
            } else if (desc.startsWith("生成图片")) {
                // 正常生成 - 需要判断是主图还是详情页
                // 由于 description 中包含产品名，需要查询 Generation 表确认
                // 简化处理：默认为主图（大部分是主图）
                mainImage += cost
                dailyStats[date].mainImage += cost
            } else if (desc.startsWith("折扣重试")) {
                // 优惠重试 - 默认为主图优惠重试
                mainImageRetry += cost
                dailyStats[date].mainImageRetry += cost
            } else if (desc.startsWith("详情页生成")) {
                // 详情页正常生成
                detailPage += cost
                dailyStats[date].detailPage += cost
            } else if (desc.startsWith("详情页重试") || desc.includes("详情页") && desc.includes("重试")) {
                // 详情页优惠重试
                detailPageRetry += cost
                dailyStats[date].detailPageRetry += cost
            } else if (desc.startsWith("智能文案")) {
                // 智能商品描述
                copywriting += cost
                dailyStats[date].copywriting += cost
            } else if (desc.startsWith("去水印")) {
                removeWatermark += cost
                dailyStats[date].removeWatermark += cost
            } else if (desc === "解锁水印功能") {
                addWatermark += cost
                dailyStats[date].addWatermark += cost
            }
        }

        // 转换为数组格式
        const dailyData = Object.entries(dailyStats)
            .map(([date, stats]) => ({ date, ...stats }))
            .sort((a, b) => a.date.localeCompare(b.date))

        return NextResponse.json({
            success: true,
            summary: {
                // 主图相关
                mainImage,          // 主图正常生成
                mainImageRetry,     // 主图优惠重试
                mainImageTotal: mainImage + mainImageRetry,
                // 详情页相关
                detailPage,         // 详情页正常生成
                detailPageRetry,    // 详情页优惠重试
                detailPageTotal: detailPage + detailPageRetry,
                // 其他服务
                copywriting,        // 智能商品描述
                removeWatermark,    // 去水印
                addWatermark,       // 加水印
                appealRefund,       // 申诉退款
                failureRefund,      // 失败退款
                refundTotal: appealRefund + failureRefund,
                // 总计
                total: mainImage + mainImageRetry + detailPage + detailPageRetry + copywriting + removeWatermark + addWatermark - appealRefund - failureRefund,
                totalRevenue: mainImage + mainImageRetry + detailPage + detailPageRetry + copywriting + removeWatermark + addWatermark,
            },

            dailyData,
            dateRange: {
                start: start.toISOString().split("T")[0],
                end: end.toISOString().split("T")[0],
            },
        })
    } catch (error) {
        console.error("[Admin Dashboard] Error:", error)
        return NextResponse.json({ error: "获取数据失败" }, { status: 500 })
    }
}
