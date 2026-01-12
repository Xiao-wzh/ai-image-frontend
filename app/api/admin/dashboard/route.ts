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

        // 解析日期参数
        const { searchParams } = new URL(req.url)
        const startStr = searchParams.get("start")
        const endStr = searchParams.get("end")

        // 默认最近7天
        const now = new Date()
        const end = endStr ? new Date(endStr + "T23:59:59") : now
        const start = startStr ? new Date(startStr + "T00:00:00") : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        // 查询消费记录
        const records = await prisma.creditRecord.findMany({
            where: {
                type: { in: ["CONSUME", "SERVICE_UNLOCK"] },
                createdAt: { gte: start, lte: end },
            },
            select: {
                amount: true,
                description: true,
                createdAt: true,
            },
            orderBy: { createdAt: "asc" },
        })

        // 分类统计
        let aiGeneration = 0
        let removeWatermark = 0
        let addWatermark = 0

        const dailyStats: Record<string, { aiGeneration: number; removeWatermark: number; addWatermark: number }> = {}

        for (const record of records) {
            const cost = Math.abs(record.amount)
            const desc = record.description || ""
            const date = record.createdAt.toISOString().split("T")[0]

            if (!dailyStats[date]) {
                dailyStats[date] = { aiGeneration: 0, removeWatermark: 0, addWatermark: 0 }
            }

            if (desc.startsWith("生成图片") || desc.startsWith("折扣重试")) {
                aiGeneration += cost
                dailyStats[date].aiGeneration += cost
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
                aiGeneration,
                removeWatermark,
                addWatermark,
                total: aiGeneration + removeWatermark + addWatermark,
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
