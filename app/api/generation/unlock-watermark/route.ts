import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSystemCost } from "@/lib/system-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    // Fetch cost from database
    const UNLOCK_COST = await getSystemCost("WATERMARK_UNLOCK_COST")

    try {

        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "请先登录" }, { status: 401 })
        }

        const { generationId } = await req.json()

        if (!generationId) {
            return NextResponse.json({ error: "缺少 generationId 参数" }, { status: 400 })
        }

        // 1. 查找生成记录并验证归属
        const generation = await prisma.generation.findUnique({
            where: { id: generationId },
        })

        if (!generation) {
            return NextResponse.json({ error: "生成记录不存在" }, { status: 404 })
        }

        if (generation.userId !== session.user.id) {
            return NextResponse.json({ error: "无权操作此记录" }, { status: 403 })
        }

        // 2. 幂等性检查：如果已解锁，直接返回成功
        if (generation.isWatermarkUnlocked) {
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { credits: true, bonusCredits: true },
            })
            return NextResponse.json({
                success: true,
                alreadyUnlocked: true,
                remainingCredits: (user?.credits || 0) + (user?.bonusCredits || 0),
            })
        }

        // 3. 检查用户余额
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { credits: true, bonusCredits: true },
        })

        if (!user) {
            return NextResponse.json({ error: "用户不存在" }, { status: 404 })
        }

        const totalCredits = user.credits + user.bonusCredits
        if (totalCredits < UNLOCK_COST) {
            return NextResponse.json({
                error: "积分不足",
                required: UNLOCK_COST,
                current: totalCredits,
            }, { status: 400 })
        }

        // 4. 事务：扣费 + 解锁 + 记录流水
        // 优先扣除赠送积分
        let bonusDeduct = Math.min(user.bonusCredits, UNLOCK_COST)
        let creditsDeduct = UNLOCK_COST - bonusDeduct

        const result = await prisma.$transaction(async (tx) => {
            // 扣除积分
            const updatedUser = await tx.user.update({
                where: { id: session.user.id },
                data: {
                    bonusCredits: { decrement: bonusDeduct },
                    credits: { decrement: creditsDeduct },
                },
                select: { credits: true, bonusCredits: true },
            })

            // 解锁水印功能
            await tx.generation.update({
                where: { id: generationId },
                data: { isWatermarkUnlocked: true },
            })

            // 创建积分流水记录
            await tx.creditRecord.create({
                data: {
                    userId: session.user.id,
                    amount: -UNLOCK_COST,
                    type: "SERVICE_UNLOCK",
                    description: "解锁水印功能",
                },
            })

            return updatedUser
        })

        return NextResponse.json({
            success: true,
            alreadyUnlocked: false,
            remainingCredits: result.credits + result.bonusCredits,
        })
    } catch (error) {
        console.error("解锁水印功能失败:", error)
        return NextResponse.json({ error: "解锁失败，请重试" }, { status: 500 })
    }
}
