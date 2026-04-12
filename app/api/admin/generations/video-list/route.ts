import { NextRequest, NextResponse } from "next/server"
import { requireReviewerOrAdminForUsers } from "@/lib/check-admin"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    const guard = await requireReviewerOrAdminForUsers()
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    try {
        const { searchParams } = new URL(req.url)

        // 分页参数
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")))
        const offset = (page - 1) * limit

        // 筛选参数
        const userId = searchParams.get("userId")?.trim() || null
        const status = searchParams.get("status")?.trim() || null
        const model = searchParams.get("model")?.trim() || null
        const hasRefund = searchParams.get("hasRefund")
        const startDate = searchParams.get("startDate") || null
        const endDate = searchParams.get("endDate") || null
        const prompt = searchParams.get("prompt")?.trim() || null

        // 构建 where 条件
        const whereConditions: any[] = []

        if (userId) {
            whereConditions.push({ userId })
        }

        if (status) {
            whereConditions.push({ status })
        }

        if (model) {
            whereConditions.push({ model })
        }

        if (hasRefund === "true") {
            whereConditions.push({ hasRefunded: true })
        } else if (hasRefund === "false") {
            whereConditions.push({ hasRefunded: false })
        }

        if (startDate) {
            whereConditions.push({ createdAt: { gte: new Date(startDate) } })
        }
        if (endDate) {
            const endOfDay = new Date(endDate)
            endOfDay.setHours(23, 59, 59, 999)
            whereConditions.push({ createdAt: { lte: endOfDay } })
        }

        // 提示词模糊搜索
        if (prompt) {
            whereConditions.push({
                prompt: { contains: prompt, mode: "insensitive" },
            })
        }

        const where = whereConditions.length > 0 ? { AND: whereConditions } : {}

        // 并行查询数据和总数
        const [data, total] = await Promise.all([
            prisma.videoGeneration.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: offset,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            email: true,
                            image: true,
                        },
                    },
                },
            }),
            prisma.videoGeneration.count({ where }),
        ])

        // 计算统计数据
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const [
            todayCount,
            totalCostSum,
            totalRefundCount,
            completedCount,
            allTotal,
        ] = await Promise.all([
            prisma.videoGeneration.count({
                where: { createdAt: { gte: today } }
            }),
            prisma.videoGeneration.aggregate({
                where,
                _sum: { cost: true },
            }),
            prisma.videoGeneration.count({
                where: { ...where, hasRefunded: true }
            }),
            prisma.videoGeneration.count({
                where: { ...where, status: "COMPLETED" }
            }),
            prisma.videoGeneration.count(),
        ])

        // 计算退款总积分
        const totalRefundSum = await prisma.videoGeneration.aggregate({
            where: { ...where, hasRefunded: true },
            _sum: { cost: true },
        })

        const totalPages = Math.ceil(total / limit)

        return NextResponse.json({
            data,
            total,
            totalPages,
            page,
            limit,
            stats: {
                todayCount,
                totalCost: totalCostSum._sum.cost || 0,
                totalRefund: totalRefundSum._sum.cost || 0,
                completedCount,
                successRate: total > 0 ? Math.round((completedCount / total) * 100) : 0,
                refundRate: total > 0 ? Math.round((totalRefundCount / total) * 100) : 0,
            },
        })
    } catch (error) {
        console.error("获取视频列表失败:", error)
        return NextResponse.json({ error: "获取失败" }, { status: 500 })
    }
}
