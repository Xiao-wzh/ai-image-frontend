import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/check-admin"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/admin/appeals/resolve
 * Approve or reject an appeal
 * Body: { appealId, action, adminNote }
 * action: "APPROVE" or "REJECT"
 */
export async function POST(req: NextRequest) {
    const guard = await requireAdmin()
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    try {
        const body = await req.json()
        const { appealId, action, adminNote } = body

        if (!appealId || typeof appealId !== "string") {
            return NextResponse.json({ error: "缺少 appealId" }, { status: 400 })
        }

        if (!action || !["APPROVE", "REJECT"].includes(action)) {
            return NextResponse.json({ error: "action 必须是 APPROVE 或 REJECT" }, { status: 400 })
        }

        // Fetch appeal
        const appeal = await prisma.appeal.findUnique({
            where: { id: appealId },
            include: {
                user: true,
                generation: true,
            },
        })

        if (!appeal) {
            return NextResponse.json({ error: "申诉记录不存在" }, { status: 404 })
        }

        if (appeal.status !== "PENDING") {
            return NextResponse.json({ error: "该申诉已处理过，无法重复操作" }, { status: 400 })
        }

        const generation = appeal.generation

        if (action === "APPROVE") {
            // 按张计算退款
            let refundAmount: number

            if (appeal.appealedImages && appeal.appealedImages.length > 0) {
                // 新申诉：按选中图片数量计算
                const totalImages = generation.qualityMode === "STANDARD"
                    ? Math.max(generation.generatedImages.length, 9)
                    : (generation.imageCount || 9)

                const perImageRefund = Math.floor(generation.totalCost / totalImages)
                refundAmount = perImageRefund * appeal.appealedImages.length

                console.log(`[Appeal] 按张退款计算: 总图片=${totalImages}, 单张=${perImageRefund}, 申诉${appeal.appealedImages.length}张, 退款=${refundAmount}`)
            } else {
                // 旧申诉兼容：按原逻辑退还剩余扣费
                refundAmount = generation.totalCost - (generation.refundAmount || 0)
                console.log(`[Appeal] 旧数据兼容: 总扣费=${generation.totalCost}, 已退=${generation.refundAmount}, 本次退=${refundAmount}`)
            }

            // 边界检查：退款不能超过剩余可退金额
            const maxRefund = generation.totalCost - (generation.refundAmount || 0)
            if (refundAmount > maxRefund) {
                refundAmount = maxRefund
                console.warn(`[Appeal] 退款金额超限，调整为剩余可退金额: ${refundAmount}`)
            }

            if (refundAmount <= 0) {
                return NextResponse.json(
                    { error: "该订单已无可退款金额" },
                    { status: 400 }
                )
            }

            // Use transaction to update appeal, refund user, and create credit record
            const result = await prisma.$transaction(async (tx) => {
                // 1. Update appeal status
                const updatedAppeal = await tx.appeal.update({
                    where: { id: appealId },
                    data: {
                        status: "APPROVED",
                        adminNote: adminNote?.trim() || "申诉通过，积分已退还",
                        refundAmount,  // 更新实际退款金额
                    },
                })

                // 2. Refund user credits
                await tx.user.update({
                    where: { id: appeal.userId },
                    data: {
                        credits: { increment: refundAmount },
                    },
                })

                // 3. Create credit record
                const imageCountText = appeal.appealedImages?.length > 0
                    ? `${appeal.appealedImages.length}张`
                    : "整单"

                await tx.creditRecord.create({
                    data: {
                        userId: appeal.userId,
                        amount: refundAmount,
                        type: "REFUND",
                        description: `申诉通过退款(${imageCountText}) - 任务ID: ${generation.id.slice(0, 8)}`,
                    },
                })

                // 4. 使用 increment 累加已退款金额
                await tx.generation.update({
                    where: { id: generation.id },
                    data: {
                        refundAmount: {
                            increment: refundAmount,
                        },
                    },
                })

                return updatedAppeal
            })

            return NextResponse.json({
                success: true,
                message: `申诉已通过，已退还 ${refundAmount} 积分`,
                refundAmount,
                appeal: {
                    id: result.id,
                    status: result.status,
                    refundAmount: result.refundAmount,
                    adminNote: result.adminNote,
                },
            })
        } else {
            // REJECT
            if (!adminNote || adminNote.trim().length < 5) {
                return NextResponse.json({ error: "拒绝申诉需要填写理由（至少5个字符）" }, { status: 400 })
            }

            const updatedAppeal = await prisma.appeal.update({
                where: { id: appealId },
                data: {
                    status: "REJECTED",
                    adminNote: adminNote.trim(),
                },
            })

            return NextResponse.json({
                success: true,
                message: "申诉已拒绝",
                appeal: {
                    id: updatedAppeal.id,
                    status: updatedAppeal.status,
                    adminNote: updatedAppeal.adminNote,
                },
            })
        }
    } catch (err: any) {
        console.error("❌ 处理申诉失败:", err?.message || err)
        return NextResponse.json({ error: "处理申诉失败", message: err?.message }, { status: 500 })
    }
}
