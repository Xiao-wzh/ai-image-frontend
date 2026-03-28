import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { refundCredits } from "@/lib/credit-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 回调安全密钥（复用已有的 N8N_WEBHOOK_SECRET）
const N8N_CALLBACK_SECRET = process.env.N8N_WEBHOOK_SECRET || ""

/**
 * POST /api/webhook/appeal-callback
 * n8n 申诉审核结果回调接口
 *
 * Body: {
 *   appealId: string,
 *   callbackToken: string,
 *   isValid: boolean,
 *   confidence: number,
 *   analysis: string,
 *   userMessage?: string  // 给用户的简短提示（不超过20字）
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { appealId, callbackToken, isValid, confidence, analysis, userMessage } = body

        // 1. 安全鉴权：校验 callbackToken
        if (!callbackToken || callbackToken !== N8N_CALLBACK_SECRET) {
            console.error("[申诉回调] ❌ 鉴权失败：callbackToken 不匹配")
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // 2. 参数校验
        if (!appealId || typeof isValid !== "boolean" || typeof confidence !== "number") {
            console.error("[申诉回调] ❌ 参数校验失败", { appealId, isValid, confidence })
            return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
        }

        // 3. 查询申诉记录
        const appeal = await prisma.appeal.findUnique({
            where: { id: appealId },
            include: {
                generation: true,
                user: true,
            },
        })

        if (!appeal) {
            console.error(`[申诉回调] ❌ 申诉记录不存在: ${appealId}`)
            return NextResponse.json({ error: "Appeal not found" }, { status: 404 })
        }

        // 4. 幂等性处理：如果状态不是 PROCESSING，丢弃重复请求
        if (appeal.status !== "PROCESSING") {
            console.log(`[申诉回调] ⚠️ 申诉已处理，丢弃重复请求: ${appealId}, 当前状态: ${appeal.status}`)
            return NextResponse.json({ success: true, message: "Already processed" })
        }

        // 5. 状态路由逻辑
        let newStatus: string
        let shouldRefund = false

        if (isValid === true && confidence > 0.85) {
            // 申诉合理 + 高置信度 → 自动通过 + 退款
            newStatus = "APPROVED"
            shouldRefund = true
            console.log(`[申诉回调] ✅ 申诉通过: ${appealId}, 置信度: ${confidence}`)
        } else if (isValid === false && confidence > 0.85) {
            // 申诉不合理 + 高置信度 → 自动拒绝
            newStatus = "REJECTED"
            console.log(`[申诉回调] ❌ 申诉拒绝: ${appealId}, 置信度: ${confidence}`)
        } else {
            // 其他情况（置信度低、报错、超时）→ 转人工
            newStatus = "PENDING_MANUAL_REVIEW"
            console.log(`[申诉回调] ⏳ 转人工审核: ${appealId}, isValid: ${isValid}, 置信度: ${confidence}`)
        }

        // 6. 使用事务更新申诉记录 + (可选)退款
        await prisma.$transaction(async (tx) => {
            // 更新申诉记录
            await tx.appeal.update({
                where: { id: appealId },
                data: {
                    status: newStatus,
                    aiConfidence: confidence,
                    aiAnalysis: analysis || null,
                    userMessage: userMessage || null,
                    reviewedBy: "AI",
                },
            })

            // 如果需要退款，执行退款逻辑
            if (shouldRefund && appeal.refundAmount > 0) {
                await refundCredits(
                    tx,
                    appeal.userId,
                    appeal.refundAmount,
                    `申诉通过退款: ${appeal.generation.productName}`
                )
            }
        })

        console.log(`[申诉回调] 🎉 处理完成: ${appealId} → ${newStatus}`)

        return NextResponse.json({
            success: true,
            appealId,
            newStatus,
            refunded: shouldRefund,
        })
    } catch (err: any) {
        console.error("[申诉回调] ❌ 处理失败:", err?.message || err)
        return NextResponse.json({ error: "Internal server error", message: err?.message }, { status: 500 })
    }
}
