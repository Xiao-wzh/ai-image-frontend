import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { triggerQueue } from "@/lib/watermark-queue"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 每张图片去水印费用
const WATERMARK_COST_PER_IMAGE = 50

export async function POST(req: NextRequest) {
    try {
        // Authenticate user
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "请先登录" },
                { status: 401 }
            )
        }

        const userId = session.user.id

        // Parse request body
        const body = await req.json()
        const { urls } = body

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json(
                { error: "请提供图片URL列表" },
                { status: 400 }
            )
        }

        // Validate URLs
        const validUrls = urls.filter((url: unknown) => {
            if (typeof url !== "string") return false
            try {
                new URL(url)
                return true
            } catch {
                return false
            }
        })

        if (validUrls.length === 0) {
            return NextResponse.json(
                { error: "请提供有效的图片URL" },
                { status: 400 }
            )
        }

        // 计算总费用
        const totalCost = validUrls.length * WATERMARK_COST_PER_IMAGE

        // 扣费 + 创建任务（事务）
        const result = await prisma.$transaction(async (tx) => {
            // 1. 检查用户余额
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { credits: true, bonusCredits: true }
            })

            if (!user) {
                throw new Error("用户不存在")
            }

            const totalCredits = (user.credits ?? 0) + (user.bonusCredits ?? 0)
            if (totalCredits < totalCost) {
                throw new Error(`余额不足 (需要 ${totalCost} 积分，当前 ${totalCredits})`)
            }

            // 2. 扣费：优先扣赠送积分
            const deductBonus = Math.min(user.bonusCredits ?? 0, totalCost)
            const deductPaid = totalCost - deductBonus

            await tx.user.update({
                where: { id: userId },
                data: {
                    bonusCredits: { decrement: deductBonus },
                    credits: { decrement: deductPaid }
                }
            })

            // 3. 记录消费
            await tx.creditRecord.create({
                data: {
                    userId,
                    amount: -totalCost,
                    type: "CONSUME",
                    description: `去水印: ${validUrls.length} 张图片`
                }
            })

            // 4. 创建任务，保存扣费信息用于失败退款
            const tasks = []
            for (const url of validUrls) {
                const task = await tx.watermarkTask.create({
                    data: {
                        userId,
                        originalUrl: url,
                        status: "PENDING"
                    }
                })
                tasks.push(task)
            }

            console.log(`[Watermark Submit] Charged ${totalCost} credits (bonus: ${deductBonus}, paid: ${deductPaid})`)

            return {
                tasks,
                deductBonus,
                deductPaid,
                totalCost
            }
        })

        const taskIds = result.tasks.map((task: { id: string }) => task.id)

        // Trigger queue processor (fire-and-forget)
        triggerQueue()

        console.log(`[Watermark Submit] Created ${taskIds.length} tasks for user ${userId}`)

        // 获取更新后的余额
        const updatedUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { credits: true, bonusCredits: true }
        })

        return NextResponse.json({
            success: true,
            taskIds,
            message: `已提交 ${taskIds.length} 个去水印任务，扣费 ${totalCost} 积分`,
            cost: totalCost,
            credits: updatedUser?.credits ?? 0,
            bonusCredits: updatedUser?.bonusCredits ?? 0,
            totalCredits: (updatedUser?.credits ?? 0) + (updatedUser?.bonusCredits ?? 0)
        })

    } catch (error: unknown) {
        console.error("[Watermark Submit] Error:", error)
        const message = error instanceof Error ? error.message : "提交失败"

        // 余额不足返回 402
        if (message.includes("余额不足")) {
            return NextResponse.json({ error: message }, { status: 402 })
        }

        return NextResponse.json(
            { error: message },
            { status: 500 }
        )
    }
}
