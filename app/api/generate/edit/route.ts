import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getSystemCost } from "@/lib/system-config"
import "dotenv/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/generate/edit
 * 异步编辑：扣费 → 标记编辑中 → 触发 N8N（不等待）→ 立即返回
 * N8N 完成后回调 /api/webhook/edit 更新图片
 */
export async function POST(req: NextRequest) {
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

        if (!generationId) {
            return NextResponse.json({ error: "缺少 generationId" }, { status: 400 })
        }
        if (typeof imageIndex !== "number" || imageIndex < 0) {
            return NextResponse.json({ error: "无效的 imageIndex" }, { status: 400 })
        }
        if (!prompt?.trim()) {
            return NextResponse.json({ error: "请输入修改提示词" }, { status: 400 })
        }
        if (!originalImageUrl) {
            return NextResponse.json({ error: "缺少原始图片 URL" }, { status: 400 })
        }

        editGenerationId = generationId
        editImageIndex = imageIndex

        // ── 1. 验证所有权 ──
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

        // ── 2. 原子扣费 ──
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

            return { ok: true as const, deductBonus, deductPaid }
        })

        if (!deductResult.ok) {
            return NextResponse.json({ error: deductResult.error }, { status: deductResult.status })
        }

        preDeducted = true
        deductedBonus = deductResult.deductBonus
        deductedPaid = deductResult.deductPaid

        // ── 3. 标记编辑中 ──
        const currentEditingIndexes = generation.editingImageIndexes || []
        if (!currentEditingIndexes.includes(imageIndex)) {
            await prisma.generation.update({
                where: { id: generationId },
                data: { editingImageIndexes: [...currentEditingIndexes, imageIndex] },
            })
        }

        // ── 4. 异步触发 N8N（不等待结果） ──
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

        console.log(`[EDIT_API] ▶  ${generationId.slice(0, 8)}... 图片#${imageIndex + 1} 触发 N8N`)

        // fire-and-forget：N8N 完成后回调 /api/webhook/edit
        fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(n8nPayload),
        })
            .then(async (res) => {
                if (!res.ok) {
                    console.error(`[EDIT_API] ❌ N8N HTTP error: ${res.status} | ${generationId.slice(0, 8)}...`)
                    await handleEditFailure(generationId, imageIndex, userId, deductedBonus, deductedPaid)
                } else {
                    console.log(`[EDIT_API] ✅ N8N 已接收 ${generationId.slice(0, 8)}... 图片#${imageIndex + 1}`)
                }
            })
            .catch(async (err) => {
                console.error(`[EDIT_API] ❌ 网络错误: ${err.message} | ${generationId.slice(0, 8)}...`)
                await handleEditFailure(generationId, imageIndex, userId, deductedBonus, deductedPaid)
            })

        // ── 5. 立即返回给前端 ──
        const updatedUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { credits: true, bonusCredits: true },
        })

        return NextResponse.json({
            success: true,
            generationId,
            imageIndex,
            status: "EDITING",
            credits: updatedUser?.credits ?? 0,
            bonusCredits: updatedUser?.bonusCredits ?? 0,
            totalCredits: (updatedUser?.credits ?? 0) + (updatedUser?.bonusCredits ?? 0),
        })

    } catch (err: any) {
        const message = err?.message || String(err)
        console.error("[EDIT_API] ❌ 错误:", message)

        // 失败退款
        if (preDeducted && userId) {
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
                            amount: await getSystemCost("IMAGE_EDIT_COST"),
                            type: "REFUND",
                            description: "图片编辑失败退款",
                        },
                    })
                })
                console.log(`[EDIT_API] 已退款: bonus=${deductedBonus}, paid=${deductedPaid}`)
            } catch (refundErr) {
                console.error("[EDIT_API] ❌ 退款失败:", refundErr)
            }

            // 清除编辑状态
            if (editGenerationId && typeof editImageIndex === "number") {
                try {
                    const currentGen = await prisma.generation.findUnique({
                        where: { id: editGenerationId },
                        select: { editingImageIndexes: true },
                    })
                    if (currentGen) {
                        await prisma.generation.update({
                            where: { id: editGenerationId },
                            data: {
                                editingImageIndexes: (currentGen.editingImageIndexes || []).filter(
                                    (idx: number) => idx !== editImageIndex
                                ),
                            },
                        })
                    }
                } catch (cleanupErr) {
                    console.error("[EDIT_API] ❌ 清除编辑状态失败:", cleanupErr)
                }
            }
        }

        return NextResponse.json({ error: "编辑失败，积分已退回", message }, { status: 500 })
    }
}

/** N8N 请求失败时：退款 + 清除编辑状态 */
async function handleEditFailure(
    generationId: string,
    imageIndex: number,
    userId: string,
    deductedBonus: number,
    deductedPaid: number
) {
    const EDIT_COST = deductedBonus + deductedPaid
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

        const currentGen = await prisma.generation.findUnique({
            where: { id: generationId },
            select: { editingImageIndexes: true },
        })
        if (currentGen) {
            await prisma.generation.update({
                where: { id: generationId },
                data: {
                    editingImageIndexes: (currentGen.editingImageIndexes || []).filter(
                        (idx: number) => idx !== imageIndex
                    ),
                },
            })
        }
        console.log(`[EDIT_API] 已退款并清除编辑状态: ${generationId.slice(0, 8)}... 图片#${imageIndex + 1}`)
    } catch (err: any) {
        console.error(`[EDIT_API] ❌ 退款/清除失败: ${err.message}`)
    }
}
