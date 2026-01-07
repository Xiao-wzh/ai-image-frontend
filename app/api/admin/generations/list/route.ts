import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    try {
        // 验证管理员权限
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "未登录" }, { status: 401 })
        }
        if (session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "无权限" }, { status: 403 })
        }

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

        const totalPages = Math.ceil(total / limit)

        return NextResponse.json({
            data,
            total,
            totalPages,
            page,
            limit,
        })
    } catch (error) {
        console.error("获取生成列表失败:", error)
        return NextResponse.json({ error: "获取失败" }, { status: 500 })
    }
}
