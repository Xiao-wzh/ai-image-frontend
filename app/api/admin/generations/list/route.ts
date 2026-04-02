import { NextRequest, NextResponse } from "next/server"
import { requireReviewerOrAdminForUsers } from "@/lib/check-admin"
import prisma from "@/lib/prisma"
import { transformGenerationUrlsList } from "@/lib/cdnUrl"

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
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")))
        const offset = (page - 1) * limit

        // 筛选参数
        const userId = searchParams.get("userId")?.trim() || null
        const productSearch = searchParams.get("productSearch")?.trim() || null
        const productType = searchParams.get("productType")?.trim() || null
        const status = searchParams.get("status")?.trim() || null
        const startDate = searchParams.get("startDate") || null
        const endDate = searchParams.get("endDate") || null
        // 新增筛选参数
        const qualityMode = searchParams.get("qualityMode")?.trim() || null
        const taskType = searchParams.get("taskType")?.trim() || null
        const mode = searchParams.get("mode")?.trim() || null

        // 构建 where 条件
        const whereConditions: any[] = []

        // 用户筛选
        if (userId) {
            whereConditions.push({ userId })
        }

        // 产品名称搜索
        if (productSearch) {
            whereConditions.push({
                productName: { contains: productSearch, mode: "insensitive" },
            })
        }

        // 产品类型筛选
        if (productType) {
            whereConditions.push({ productType })
        }

        // 状态筛选
        if (status) {
            whereConditions.push({ status })
        }

        // 画质模式筛选
        if (qualityMode) {
            whereConditions.push({ qualityMode })
        }

        // 任务类型筛选
        if (taskType) {
            whereConditions.push({ taskType })
        }

        // 生成模式筛选
        if (mode) {
            whereConditions.push({ mode })
        }

        // 退款筛选
        const hasRefund = searchParams.get("hasRefund")
        if (hasRefund === "true") {
            whereConditions.push({ refundAmount: { gt: 0 } })
        } else if (hasRefund === "false") {
            whereConditions.push({ refundAmount: { equals: 0 } })
        }

        // 日期范围筛选
        if (startDate) {
            whereConditions.push({
                createdAt: { gte: new Date(startDate) },
            })
        }
        if (endDate) {
            // 结束日期包含当天整天
            const endOfDay = new Date(endDate)
            endOfDay.setHours(23, 59, 59, 999)
            whereConditions.push({
                createdAt: { lte: endOfDay },
            })
        }

        const where = whereConditions.length > 0 ? { AND: whereConditions } : {}

        // 并行查询数据和总数
        const [data, total] = await Promise.all([
            prisma.generation.findMany({
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
            prisma.generation.count({ where }),
        ])

        // Get unique productTypes and fetch their descriptions
        const productTypes = [...new Set(data.map(g => g.productType).filter(Boolean))] as string[]
        const productTypeDescriptions = await prisma.productTypePrompt.findMany({
            where: {
                productType: { in: productTypes },
                isActive: true,
            },
            select: {
                productType: true,
                description: true,
            },
            distinct: ['productType'],
        })

        // Create a map for quick lookup
        const descriptionMap = new Map(
            productTypeDescriptions.map(p => [p.productType, p.description])
        )

        // Enrich data with productTypeDescription
        const enrichedData = data.map(g => ({
            ...g,
            productTypeDescription: descriptionMap.get(g.productType) || null,
        }))

        // 计算统计数据
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // 并行查询统计数据
        const [
            todayCount,
            totalCostSum,
            totalRefundSum,
            proCount,
            completedCount,
            allTotal,
        ] = await Promise.all([
            // 今日生成数
            prisma.generation.count({
                where: { createdAt: { gte: today } }
            }),
            // 当前筛选条件下的总消耗积分
            prisma.generation.aggregate({
                where,
                _sum: { totalCost: true },
            }),
            // 当前筛选条件下的总退款积分
            prisma.generation.aggregate({
                where,
                _sum: { refundAmount: true },
            }),
            // 当前筛选条件下 PRO 模式数量
            prisma.generation.count({
                where: { ...where, qualityMode: "PRO" }
            }),
            // 当前筛选条件下成功数量
            prisma.generation.count({
                where: { ...where, status: "COMPLETED" }
            }),
            // 全部记录总数（用于计算全局统计）
            prisma.generation.count(),
        ])

        const totalPages = Math.ceil(total / limit)

        // Transform image keys to CDN URLs
        const transformedData = transformGenerationUrlsList(enrichedData)

        return NextResponse.json({
            data: transformedData,
            total,
            totalPages,
            page,
            limit,
            stats: {
                todayCount,
                totalCost: totalCostSum._sum.totalCost || 0,
                totalRefund: totalRefundSum._sum.refundAmount || 0,
                proCount,
                completedCount,
                successRate: total > 0 ? Math.round((completedCount / total) * 100) : 0,
                proRate: total > 0 ? Math.round((proCount / total) * 100) : 0,
                refundRate: (totalCostSum._sum.totalCost || 0) > 0
                    ? Math.round(((totalRefundSum._sum.refundAmount || 0) / (totalCostSum._sum.totalCost || 1)) * 100)
                    : 0,
            },
        })
    } catch (error) {
        console.error("获取生成列表失败:", error)
        return NextResponse.json({ error: "获取失败" }, { status: 500 })
    }
}
