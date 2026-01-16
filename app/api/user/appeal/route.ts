import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { transformGenerationUrls } from "@/lib/cdnUrl"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/user/appeal
 * Create an appeal for a generation result
 * Body: { generationId, reason }
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { generationId, reason } = body

        if (!generationId || typeof generationId !== "string") {
            return NextResponse.json({ error: "缺少 generationId" }, { status: 400 })
        }

        // Reason is now optional
        const reasonText = reason && typeof reason === "string" ? reason.trim() : null

        // Check if generation exists and belongs to user
        const generation = await prisma.generation.findUnique({
            where: { id: generationId },
            include: { appeal: true },
        })

        if (!generation) {
            return NextResponse.json({ error: "生成记录不存在" }, { status: 404 })
        }

        if (generation.userId !== userId) {
            return NextResponse.json({ error: "无权对此记录发起申诉" }, { status: 403 })
        }

        // Check if generation is completed
        if (generation.status !== "COMPLETED") {
            return NextResponse.json({ error: "只能对已完成的生成发起申诉" }, { status: 400 })
        }

        // Check if appeal already exists
        if (generation.appeal) {
            return NextResponse.json({ error: "该记录已发起过申诉，无法重复申诉" }, { status: 400 })
        }

        // Determine refund amount based on whether discounted retry was used
        const refundAmount = generation.hasUsedDiscountedRetry ? 99 : 199

        // Create appeal with proper relation connections
        const appeal = await prisma.appeal.create({
            data: {
                user: { connect: { id: userId } },
                generation: { connect: { id: generationId } },
                reason: reasonText,
                refundAmount,
                status: "PENDING",
            },
        })

        return NextResponse.json({
            success: true,
            message: "申诉已提交，请等待审核",
            appeal: {
                id: appeal.id,
                status: appeal.status,
                refundAmount: appeal.refundAmount,
                createdAt: appeal.createdAt,
            },
        })
    } catch (err: any) {
        console.error("❌ 申诉创建失败:", err?.message || err)
        return NextResponse.json({ error: "申诉提交失败", message: err?.message }, { status: 500 })
    }
}

/**
 * GET /api/user/appeal
 * Get appeals - users see only their own, admins see all
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id
    const userRole = (session?.user as any)?.role

    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const status = searchParams.get("status") // Optional filter

        // Admin can see all, users can only see their own
        const isAdmin = userRole === "ADMIN"
        const where = {
            ...(isAdmin ? {} : { userId }),
            ...(status ? { status } : {}),
        }

        const appeals = await prisma.appeal.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                user: isAdmin ? {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        email: true,
                    },
                } : false,
                generation: {
                    select: {
                        id: true,
                        productName: true,
                        productType: true,
                        originalImage: true,
                        generatedImages: true,
                        hasUsedDiscountedRetry: true,
                        createdAt: true,
                    },
                },
            },
        })

        // Transform image URLs to CDN
        const transformedAppeals = appeals.map(appeal => ({
            ...appeal,
            generation: transformGenerationUrls(appeal.generation),
        }))

        return NextResponse.json({
            success: true,
            appeals: transformedAppeals,
            isAdmin,
        })
    } catch (err: any) {
        console.error("❌ 获取申诉列表失败:", err?.message || err)
        return NextResponse.json({ error: "获取申诉失败" }, { status: 500 })
    }
}
