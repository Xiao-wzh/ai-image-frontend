import { NextRequest, NextResponse } from "next/server"
import { requireReviewerOrAdmin } from "@/lib/check-admin"
import prisma from "@/lib/prisma"

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
        console.log(`[Admin 申诉工作流] 已触发 n8n 审核: appealId=${payload.appealId}`)
    } catch (error) {
        console.error(`[Admin 申诉工作流] 触发 n8n 失败:`, error)
    }
}

/**
 * POST /api/admin/appeals/trigger-ai
 * 管理员手动触发 AI 申诉审核
 *
 * Body: { appealId: string }
 */
export async function POST(req: NextRequest) {
    // 1. 权限校验
    const authResult = await requireReviewerOrAdmin()
    if (!authResult.ok) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    try {
        const body = await req.json()
        const { appealId } = body

        if (!appealId || typeof appealId !== "string") {
            return NextResponse.json({ error: "缺少 appealId" }, { status: 400 })
        }

        // 2. 查询申诉记录及其关联的生成记录
        const appeal = await prisma.appeal.findUnique({
            where: { id: appealId },
            include: {
                generation: {
                    select: {
                        productName: true,
                        mode: true,
                        originalImage: true,
                        generatedImages: true,
                        refImages: true,  // 克隆模式参考图
                    },
                },
            },
        })

        if (!appeal) {
            return NextResponse.json({ error: "申诉记录不存在" }, { status: 404 })
        }

        // 3. 更新状态为 PROCESSING
        await prisma.appeal.update({
            where: { id: appealId },
            data: {
                status: "PROCESSING",
                // 清空之前的 AI 判定结果
                aiConfidence: null,
                aiAnalysis: null,
            },
        })

        // 4. 异步触发 n8n 工作流（Fire and forget）
        triggerAppealWorkflow({
            appealId: appeal.id,
            productName: appeal.generation.productName,
            generationMode: appeal.generation.mode,
            userReason: appeal.reason,
            images: appeal.appealedImages,
            originalImages: appeal.generation.originalImage,
            cloneRefImages: appeal.generation.refImages || [],  // 克隆参考图
            callbackToken: N8N_CALLBACK_SECRET,
        })

        // 5. 立即返回成功
        return NextResponse.json({
            success: true,
            message: "AI 审核已触发，请稍候查看结果",
            appealId,
        })
    } catch (err: any) {
        console.error("[Admin 触发 AI 审核] 失败:", err?.message || err)
        return NextResponse.json({ error: "操作失败", message: err?.message }, { status: 500 })
    }
}
