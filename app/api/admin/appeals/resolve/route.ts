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
            include: { user: true },
        })

        if (!appeal) {
            return NextResponse.json({ error: "申诉记录不存在" }, { status: 404 })
        }

        if (appeal.status !== "PENDING") {
            return NextResponse.json({ error: "该申诉已处理过，无法重复操作" }, { status: 400 })
        }

        if (action === "APPROVE") {
            // Use transaction to update appeal, refund user, and create credit record
            const result = await prisma.$transaction(async (tx) => {
                // 1. Update appeal status
                const updatedAppeal = await tx.appeal.update({
                    where: { id: appealId },
                    data: {
                        status: "APPROVED",
                        adminNote: adminNote?.trim() || "申诉通过，积分已退还",
                    },
                })

                // 2. Refund user credits
                await tx.user.update({
                    where: { id: appeal.userId },
                    data: {
                        credits: { increment: appeal.refundAmount },
                    },
                })

                // 3. Create credit record
                await tx.creditRecord.create({
                    data: {
                        userId: appeal.userId,
                        amount: appeal.refundAmount,
                        type: "REFUND",
                        description: `申诉退款 - ${appeal.refundAmount} 积分`,
                    },
                })

                return updatedAppeal
            })

            return NextResponse.json({
                success: true,
                message: `申诉已通过，已退还 ${appeal.refundAmount} 积分`,
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
