import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getSystemCost } from "@/lib/system-config"
import "dotenv/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/generate/edit
 * In-place edit: Replace a single image in an existing Generation record
 * Body: { generationId, imageIndex, prompt, originalImageUrl }
 */
export async function POST(req: NextRequest) {
    // Fetch edit cost from database
    const EDIT_COST = await getSystemCost("IMAGE_EDIT_COST")

    let preDeducted = false
    let deductedBonus = 0
    let deductedPaid = 0
    let editGenerationId: string | undefined
    let editImageIndex: number | undefined


    const session = await auth()
    const userId = session?.user?.id || null
    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    try {
        const body = await req.json().catch(() => null)

        const generationId = body?.generationId as string | undefined
        const imageIndex = body?.imageIndex as number | undefined
        const prompt = body?.prompt as string | undefined
        const originalImageUrl = body?.originalImageUrl as string | undefined

        // Validate inputs
        if (!generationId) {
            return NextResponse.json({ error: "缺少 generationId" }, { status: 400 })
        }
        if (typeof imageIndex !== "number" || imageIndex < 0) {
            return NextResponse.json({ error: "无效的 imageIndex" }, { status: 400 })
        }

        // Track for cleanup on failure
        editGenerationId = generationId
        editImageIndex = imageIndex

        if (!prompt?.trim()) {
            return NextResponse.json({ error: "请输入修改提示词" }, { status: 400 })
        }
        if (!originalImageUrl) {
            return NextResponse.json({ error: "缺少原始图片 URL" }, { status: 400 })
        }

        // Verify ownership
        const generation = await prisma.generation.findUnique({
            where: { id: generationId },
            select: { userId: true, generatedImages: true, productName: true, editingImageIndexes: true },
        })

        if (!generation) {
            return NextResponse.json({ error: "记录不存在" }, { status: 404 })
        }
        if (generation.userId !== userId) {
            return NextResponse.json({ error: "无权编辑此记录" }, { status: 403 })
        }
        if (imageIndex >= generation.generatedImages.length) {
            return NextResponse.json({ error: "图片索引超出范围" }, { status: 400 })
        }

        // Deduct credits atomically
        const deductResult = await prisma.$transaction(async (tx) => {
            const userRow = await tx.user.findUnique({
                where: { id: userId },
                select: { credits: true, bonusCredits: true },
            })
            if (!userRow) {
                return { ok: false as const, status: 404 as const, error: "用户不存在" }
            }

            const totalCredits = (userRow.credits ?? 0) + (userRow.bonusCredits ?? 0)
            if (totalCredits < EDIT_COST) {
                return {
                    ok: false as const,
                    status: 402 as const,
                    error: `余额不足 (需要 ${EDIT_COST} 积分，当前 ${totalCredits})`,
                }
            }

            const deductBonus = Math.min(userRow.bonusCredits || 0, EDIT_COST)
            const deductPaid = EDIT_COST - deductBonus

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
                    amount: -EDIT_COST,
                    type: "CONSUME",
                    description: `编辑图片: ${generation.productName} #${imageIndex + 1}`,
                },
            })

            console.log(`[EDIT_API] Deducted ${EDIT_COST} credits (bonus: ${deductBonus}, paid: ${deductPaid})`)
            return { ok: true as const, deductBonus, deductPaid }
        })

        if (!deductResult.ok) {
            return NextResponse.json({ error: deductResult.error }, { status: deductResult.status })
        }

        preDeducted = true
        deductedBonus = deductResult.deductBonus
        deductedPaid = deductResult.deductPaid

        // Mark image as editing in database (persist across page refresh)
        const currentEditingIndexes = generation.editingImageIndexes || []
        if (!currentEditingIndexes.includes(imageIndex)) {
            await prisma.generation.update({
                where: { id: generationId },
                data: {
                    editingImageIndexes: [...currentEditingIndexes, imageIndex],
                },
            })
        }

        // Call N8N for image editing
        const webhookUrl = process.env.N8N_EDIT_WEBHOOK_URL
        if (!webhookUrl) {
            throw new Error("N8N_EDIT_WEBHOOK_URL 未配置")
        }

        const n8nPayload = {
            image: originalImageUrl,
            content: prompt.trim(),
            userId,
            username: (session?.user as any)?.username ?? (session?.user as any)?.name ?? null,
            generationId,
            imageIndex,
        }

        console.log(`[EDIT_API] Calling N8N:`, JSON.stringify(n8nPayload, null, 2))

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
            console.error(`[EDIT_API] N8N error: ${n8nRes.status}`, errorText)
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

        // Expect N8N to return { success: true, edit_image: "url" }
        const newImageUrl = n8nJson.edit_image || n8nJson.image || n8nJson.images?.[0]
        if (!newImageUrl || typeof newImageUrl !== "string") {
            console.error("[EDIT_API] N8N response:", JSON.stringify(n8nJson))
            throw new Error("N8N 未返回有效的图片 URL")
        }


        // Update the Generation record - replace image at index and clear editing state
        const updatedImages = [...generation.generatedImages]
        updatedImages[imageIndex] = newImageUrl

        // Remove this index from editingImageIndexes
        const updatedEditingIndexes = (generation.editingImageIndexes || []).filter(
            (idx: number) => idx !== imageIndex
        )

        await prisma.generation.update({
            where: { id: generationId },
            data: {
                generatedImages: updatedImages,
                editingImageIndexes: updatedEditingIndexes,
            },
        })


        console.log(`[EDIT_API] Success - Updated image at index ${imageIndex}`)

        // Get updated user credits
        const updatedUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { credits: true, bonusCredits: true },
        })

        return NextResponse.json({
            success: true,
            newImageUrl,
            imageIndex,
            credits: updatedUser?.credits ?? 0,
            bonusCredits: updatedUser?.bonusCredits ?? 0,
            totalCredits: (updatedUser?.credits ?? 0) + (updatedUser?.bonusCredits ?? 0),
        })
    } catch (err: any) {
        const message = err?.message || String(err)
        const errName = err?.name

        if (errName === "AbortError" || errName === "TimeoutError") {
            console.error("[EDIT_API] Request timeout")
        }

        console.error("[EDIT_API] Error:", message)

        // Refund on failure
        if (preDeducted && userId) {
            console.log("[EDIT_API] Refunding credits...")
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
                            amount: EDIT_COST,
                            type: "REFUND",
                            description: "图片编辑失败退款",
                        },
                    })
                })
                console.log(`[EDIT_API] Refunded: bonus=${deductedBonus}, paid=${deductedPaid}`)
            } catch (refundErr) {
                console.error("[EDIT_API] Refund failed:", refundErr)
            }

            // Also clear editing state on failure
            try {
                if (editGenerationId && typeof editImageIndex === "number") {
                    const currentGen = await prisma.generation.findUnique({
                        where: { id: editGenerationId },
                        select: { editingImageIndexes: true },
                    })
                    if (currentGen) {
                        const cleanedIndexes = (currentGen.editingImageIndexes || []).filter(
                            (idx: number) => idx !== editImageIndex
                        )
                        await prisma.generation.update({
                            where: { id: editGenerationId },
                            data: { editingImageIndexes: cleanedIndexes },
                        })
                    }
                }
            } catch (cleanupErr) {
                console.error("[EDIT_API] Cleanup editing state failed:", cleanupErr)
            }
        }


        return NextResponse.json({ error: "编辑失败，积分已退回", message }, { status: 500 })
    }
}
