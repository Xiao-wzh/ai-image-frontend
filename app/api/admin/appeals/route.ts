import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/check-admin"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/appeals
 * Get all appeals for admin review
 */
export async function GET(req: NextRequest) {
    const guard = await requireAdmin()
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    try {
        const { searchParams } = new URL(req.url)
        const status = searchParams.get("status") // Optional filter: PENDING, APPROVED, REJECTED
        const limit = Math.min(Number(searchParams.get("limit") || 50), 100)
        const offset = Math.max(Number(searchParams.get("offset") || 0), 0)

        const where = status ? { status } : {}

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
                            generatedImages: true,
                            generatedImage: true,
                            originalImage: true,
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

        // Enrich appeals with productType description
        const enrichedAppeals = appeals.map(appeal => ({
            ...appeal,
            generation: {
                ...appeal.generation,
                productTypeDescription: descriptionMap.get(appeal.generation.productType) || null,
            },
        }))

        // Get counts by status for dashboard
        const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
            prisma.appeal.count({ where: { status: "PENDING" } }),
            prisma.appeal.count({ where: { status: "APPROVED" } }),
            prisma.appeal.count({ where: { status: "REJECTED" } }),
        ])

        return NextResponse.json({
            success: true,
            appeals: enrichedAppeals,
            stats: {
                pending: pendingCount,
                approved: approvedCount,
                rejected: rejectedCount,
                total: pendingCount + approvedCount + rejectedCount,
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
