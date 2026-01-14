import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getSystemCost } from "@/lib/system-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/copywriting/generate
 * Generate product description using AI
 * Body: { platform, productName }
 */
export async function POST(req: NextRequest) {
    const COST = await getSystemCost("COPYWRITING_COST")

    let preDeducted = false
    let deductedBonus = 0
    let deductedPaid = 0

    const session = await auth()
    const userId = session?.user?.id || null
    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    try {
        const body = await req.json().catch(() => null)
        const platform = body?.platform as string | undefined
        const productName = body?.productName as string | undefined

        // Validate inputs
        if (!platform?.trim()) {
            return NextResponse.json({ error: "请选择平台" }, { status: 400 })
        }
        if (!productName?.trim()) {
            return NextResponse.json({ error: "请输入商品名称" }, { status: 400 })
        }

        // Deduct credits atomically
        const deductResult = await prisma.$transaction(async (tx) => {
            const userRow = await tx.user.findUnique({
                where: { id: userId },
                select: { credits: true, bonusCredits: true },
            })
            if (!userRow) {
                return { ok: false as const, status: 404, error: "用户不存在" }
            }

            const totalCredits = (userRow.credits ?? 0) + (userRow.bonusCredits ?? 0)
            if (totalCredits < COST) {
                return {
                    ok: false as const,
                    status: 402,
                    error: `余额不足 (需要 ${COST} 积分，当前 ${totalCredits})`,
                }
            }

            const deductBonus = Math.min(userRow.bonusCredits || 0, COST)
            const deductPaid = COST - deductBonus

            await tx.user.update({
                where: { id: userId },
                data: {
                    bonusCredits: { decrement: deductBonus },
                    credits: { decrement: deductPaid },
                },
            })

            await tx.creditRecord.create({
                data: {
                    userId,
                    amount: -COST,
                    type: "CONSUME",
                    description: `智能文案: ${productName}`,
                },
            })

            return { ok: true as const, deductBonus, deductPaid }
        })

        if (!deductResult.ok) {
            return NextResponse.json({ error: deductResult.error }, { status: deductResult.status })
        }

        preDeducted = true
        deductedBonus = deductResult.deductBonus
        deductedPaid = deductResult.deductPaid

        // Call N8N for copywriting generation
        const webhookUrl = process.env.N8N_COPYWRITING_WEBHOOK_URL
        if (!webhookUrl) {
            throw new Error("N8N_COPYWRITING_WEBHOOK_URL 未配置")
        }

        const n8nPayload = {
            platform: platform.trim(),
            productName: productName.trim(),
            userId,
        }

        console.log(`[COPYWRITING_API] Calling N8N:`, JSON.stringify(n8nPayload))

        // 5 minute timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 300_000)

        let n8nRes: Response
        try {
            n8nRes = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(n8nPayload),
                signal: controller.signal,
            })
        } finally {
            clearTimeout(timeoutId)
        }

        if (!n8nRes.ok) {
            const errorText = await n8nRes.text().catch(() => "")
            console.error(`[COPYWRITING_API] N8N error: ${n8nRes.status}`, errorText)
            throw new Error(`N8N 调用失败: ${n8nRes.status}`)
        }

        const rawText = await n8nRes.text().catch(() => "")
        if (!rawText) {
            throw new Error("N8N 响应为空")
        }

        let n8nJson: any
        try {
            n8nJson = JSON.parse(rawText)
        } catch {
            throw new Error(`N8N 响应不是有效 JSON: ${rawText.slice(0, 200)}`)
        }

        // N8N returns { success: true, edit_image: "markdown content" }
        const content = n8nJson.edit_image || n8nJson.content || ""
        if (!content || typeof content !== "string") {
            console.error("[COPYWRITING_API] N8N response:", JSON.stringify(n8nJson))
            throw new Error("N8N 未返回有效的文案内容")
        }

        // Save to database
        const copywriting = await prisma.copywriting.create({
            data: {
                userId,
                platform: platform.trim(),
                productName: productName.trim(),
                content,
                cost: COST,
            },
        })

        console.log(`[COPYWRITING_API] Success - Created copywriting ${copywriting.id}`)

        // Get updated user credits
        const updatedUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { credits: true, bonusCredits: true },
        })

        return NextResponse.json({
            success: true,
            id: copywriting.id,
            content,
            credits: updatedUser?.credits ?? 0,
            bonusCredits: updatedUser?.bonusCredits ?? 0,
            totalCredits: (updatedUser?.credits ?? 0) + (updatedUser?.bonusCredits ?? 0),
        })
    } catch (err: any) {
        const message = err?.message || String(err)
        console.error("[COPYWRITING_API] Error:", message)

        // Refund on failure
        if (preDeducted && userId) {
            console.log("[COPYWRITING_API] Refunding credits...")
            try {
                await prisma.$transaction(async (tx) => {
                    await tx.user.update({
                        where: { id: userId },
                        data: {
                            bonusCredits: { increment: deductedBonus },
                            credits: { increment: deductedPaid },
                        },
                    })
                    await tx.creditRecord.create({
                        data: {
                            userId,
                            amount: COST,
                            type: "REFUND",
                            description: "智能文案生成失败退款",
                        },
                    })
                })
                console.log(`[COPYWRITING_API] Refunded: bonus=${deductedBonus}, paid=${deductedPaid}`)
            } catch (refundErr) {
                console.error("[COPYWRITING_API] Refund failed:", refundErr)
            }
        }

        return NextResponse.json({ error: "生成失败，积分已退回", message }, { status: 500 })
    }
}
