import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { transformGenerationUrls, extractObjectKey, keyToCdnUrl } from "@/lib/cdnUrl"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// n8n 申诉审核 webhook URL
const N8N_APPEAL_WEBHOOK_URL = process.env.N8N_APPEAL_WEBHOOK_URL || "http://localhost:5678/webhook/appeal-judge"
// 复用已有的 N8N_WEBHOOK_SECRET 作为回调安全密钥
const N8N_CALLBACK_SECRET = process.env.N8N_WEBHOOK_SECRET || ""

/**
 * 异步触发 n8n 申诉审核工作流（Fire and forget）
 */
async function triggerAppealWorkflow(payload: {
    appealId: string
    productName: string
    generationMode: string
    userReason: string | null
    images: string[]
    originalImages: string[]
    cloneRefImages: string[]  // 克隆模式参考图
    callbackToken: string
}) {
    try {
        await fetch(N8N_APPEAL_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
        console.log(`[申诉工作流] ✅ 已触发 n8n 审核: appealId=${payload.appealId}`)
    } catch (error) {
        console.error(`[申诉工作流] ❌ 触发 n8n 失败:`, error)
        // 注意：这里不抛出异常，因为是 fire-and-forget
    }
}

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
        const { generationId, reason, appealedImages } = body

        if (!generationId || typeof generationId !== "string") {
            return NextResponse.json({ error: "缺少 generationId" }, { status: 400 })
        }

        // 验证 appealedImages
        if (!Array.isArray(appealedImages) || appealedImages.length === 0) {
            return NextResponse.json(
                { error: "请至少选择一张要申诉的图片" },
                { status: 400 }
            )
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

        // Check if generation is completed (COMPLETED or PARTIAL_SUCCESS)
        if (generation.status !== "COMPLETED" && generation.status !== "PARTIAL_SUCCESS") {
            return NextResponse.json({ error: "只能对已完成的生成发起申诉" }, { status: 400 })
        }

        // Check if appeal already exists
        if (generation.appeal) {
            return NextResponse.json({ error: "该记录已发起过申诉，无法重复申诉" }, { status: 400 })
        }

        // 验证图片 URL 是否属于该生成记录
        // 兼容多种格式：CDN URL、源站 URL、纯 key
        // 统一转换为 CDN 格式后对比
        const normalizeUrl = (url: string): string => {
            // 如果是源站 URL，提取 key 后转为 CDN URL
            if (url.includes('sexyspecies-ai-image.tos-cn-beijing.volces.com')) {
                const key = extractObjectKey(url)
                return keyToCdnUrl(key) as string
            }
            // 如果是 CDN URL，直接返回
            if (url.includes('img.wzhdjy.xin')) {
                return url
            }
            // 如果是纯 key，转为 CDN URL
            if (!url.startsWith('http')) {
                return keyToCdnUrl(url) as string
            }
            // 其他情况直接返回
            return url
        }

        const normalizedAppealedImages = appealedImages.map(normalizeUrl)
        const normalizedDbImages = generation.generatedImages.map(normalizeUrl)

        const validImages = normalizedDbImages.filter(img =>
            normalizedAppealedImages.includes(img)
        )
        if (validImages.length !== normalizedAppealedImages.length) {
            return NextResponse.json(
                { error: "选择的图片不属于该生成记录" },
                { status: 400 }
            )
        }

        // Determine refund amount based on whether discounted retry was used
        const refundAmount = generation.hasUsedDiscountedRetry ? 99 : 199

        // Create appeal with proper relation connections
        // 状态初始为 PROCESSING，等待 AI 审核结果
        const appeal = await prisma.appeal.create({
            data: {
                user: { connect: { id: userId } },
                generation: { connect: { id: generationId } },
                reason: reasonText,
                refundAmount,
                status: "PROCESSING",
                appealedImages: validImages,  // 存储验证后的图片 URL
            },
        })

        // 异步触发 n8n 申诉审核工作流（Fire and forget）
        // 不阻塞响应，无论 n8n 是否成功，都立即返回
        triggerAppealWorkflow({
            appealId: appeal.id,
            productName: generation.productName,
            generationMode: generation.mode, // CREATIVE / CLONE
            userReason: reasonText,
            images: validImages, // 申诉的生成图
            originalImages: generation.originalImage, // 原始上传图
            cloneRefImages: generation.refImages || [], // 克隆参考图（如果有）
            callbackToken: N8N_CALLBACK_SECRET,
        })

        return NextResponse.json({
            success: true,
            message: "申诉已提交，AI 正在审核中...",
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
