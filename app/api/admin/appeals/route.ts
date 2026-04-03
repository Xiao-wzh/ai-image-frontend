import { NextRequest, NextResponse } from "next/server"
import { requireReviewerOrAdmin } from "@/lib/check-admin"
import prisma from "@/lib/prisma"
import { transformGenerationUrls } from "@/lib/cdnUrl"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/appeals
 * Get all appeals for admin review
 */
export async function GET(req: NextRequest) {
    const guard = await requireReviewerOrAdmin()
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    try {
        const { searchParams } = new URL(req.url)
        const status = searchParams.get("status") // Optional filter: PENDING, APPROVED, REJECTED
        const limit = Math.min(Number(searchParams.get("limit") || 10), 100)
        const offset = Math.max(Number(searchParams.get("offset") || 0), 0)
        const search = searchParams.get("search")?.trim() // 搜索关键词（用户名/邮箱/商品名）

        // 构建查询条件
        const where: any = {}
        if (status) {
            where.status = status
        }
        if (search) {
            where.OR = [
                { user: { name: { contains: search, mode: "insensitive" } } },
                { user: { username: { contains: search, mode: "insensitive" } } },
                { user: { email: { contains: search, mode: "insensitive" } } },
                { generation: { productName: { contains: search, mode: "insensitive" } } },
            ]
        }

        const [appeals, total] = await Promise.all([
            prisma.appeal.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            email: true,
                        },
                    },
                    generation: {
                        select: {
                            id: true,
                            productName: true,
                            productType: true,
                            outputLanguage: true,
                            qualityMode: true,       // PRO / STANDARD
                            mode: true,              // CREATIVE / CLONE
                            imageCount: true,        // PRO: 期望张数
                            costPerImage: true,      // PRO: 单张成本快照
                            totalCost: true,         // 总费用
                            generatedImages: true,
                            generatedImage: true,
                            originalImage: true,
                            refImages: true,
                            hasUsedDiscountedRetry: true,
                            createdAt: true,
                        },
                    },

                },
            }),
            prisma.appeal.count({ where }),
        ])

        // Get unique productTypes from appeals
        const productTypes = [...new Set(appeals.map(a => a.generation.productType).filter(Boolean))] as string[]

        // Fetch descriptions from ProductTypePrompt table
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

        // Enrich appeals with productType description and transform image URLs
        const enrichedAppeals = appeals.map(appeal => ({
            ...appeal,
            generation: transformGenerationUrls({
                ...appeal.generation,
                productTypeDescription: descriptionMap.get(appeal.generation.productType) || null,
            }),
        }))

        // Get counts by status for dashboard
        const [pendingCount, processingCount, manualReviewCount, approvedCount, rejectedCount] = await Promise.all([
            prisma.appeal.count({ where: { status: "PENDING" } }),
            prisma.appeal.count({ where: { status: "PROCESSING" } }),
            prisma.appeal.count({ where: { status: "PENDING_MANUAL_REVIEW" } }),
            prisma.appeal.count({ where: { status: "APPROVED" } }),
            prisma.appeal.count({ where: { status: "REJECTED" } }),
        ])

        // 今日统计（东八区）
        const now = new Date()
        const utc8Offset = 8 * 60 * 60 * 1000
        const utc8Now = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + utc8Offset)
        const todayStart = new Date(utc8Now)
        todayStart.setHours(0, 0, 0, 0)
        const todayStartUTC = new Date(todayStart.getTime() - utc8Offset)

        const [todayTotal, todayApproved, todayRejected, todayApprovedRefund] = await Promise.all([
            prisma.appeal.count({ where: { createdAt: { gte: todayStartUTC } } }),
            prisma.appeal.count({ where: { status: "APPROVED", createdAt: { gte: todayStartUTC } } }),
            prisma.appeal.count({ where: { status: "REJECTED", createdAt: { gte: todayStartUTC } } }),
            prisma.appeal.aggregate({
                where: { status: "APPROVED", createdAt: { gte: todayStartUTC } },
                _sum: { refundAmount: true },
            }),
        ])

        return NextResponse.json({
            success: true,
            appeals: enrichedAppeals,
            stats: {
                pending: pendingCount + processingCount + manualReviewCount,
                processing: processingCount,
                manualReview: manualReviewCount,
                approved: approvedCount,
                rejected: rejectedCount,
                total: pendingCount + processingCount + manualReviewCount + approvedCount + rejectedCount,
            },
            todayStats: {
                total: todayTotal,
                approved: todayApproved,
                rejected: todayRejected,
                approvedRefund: todayApprovedRefund._sum.refundAmount || 0,
            },
            page: {
                limit,
                offset,
                total,
                hasMore: offset + appeals.length < total,
            },
        })
    } catch (err: any) {
        console.error("❌ 获取申诉列表失败:", err?.message || err)
        return NextResponse.json({ error: "获取申诉列表失败" }, { status: 500 })
    }
}
