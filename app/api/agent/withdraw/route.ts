import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { AGENT_LEVEL } from "@/lib/agent-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 最低提现金额
const MIN_WITHDRAW_AMOUNT = 100

/**
 * POST /api/agent/withdraw
 * 代理申请提现
 * 
 * Body: { amount: number, bankInfo: { type: string, account: string, name: string } }
 */
export async function POST(req: NextRequest) {
    // 暂时关闭提现功能
    return NextResponse.json(
        { error: "提现功能暂时关闭，请联系负责人" },
        { status: 503 }
    )

    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    try {
        const body = await req.json().catch(() => null)
        const amount = Number(body?.amount)
        const bankInfo = body?.bankInfo

        // 验证金额
        if (!amount || amount < MIN_WITHDRAW_AMOUNT) {
            return NextResponse.json(
                { error: `最低提现金额为 ${MIN_WITHDRAW_AMOUNT} 积分` },
                { status: 400 }
            )
        }

        // 验证收款信息
        if (!bankInfo || !bankInfo.type || !bankInfo.account || !bankInfo.name) {
            return NextResponse.json({ error: "请填写完整的收款信息" }, { status: 400 })
        }

        // 使用事务处理提现
        const result = await prisma.$transaction(async (tx) => {
            // 获取用户信息
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { agentLevel: true, agentBalance: true },
            })

            if (!user) {
                return { ok: false as const, error: "用户不存在" }
            }

            // 检查是否为代理
            if (user.agentLevel < AGENT_LEVEL.L3) {
                return { ok: false as const, error: "只有代理才能提现" }
            }

            // 检查余额
            if (user.agentBalance < amount) {
                return { ok: false as const, error: "佣金余额不足" }
            }

            // 扣减余额
            await tx.user.update({
                where: { id: userId },
                data: { agentBalance: { decrement: amount } },
            })

            // 创建提现记录
            const withdrawal = await tx.withdrawal.create({
                data: {
                    user: { connect: { id: userId } },
                    amount,
                    bankInfo: JSON.stringify(bankInfo),
                    status: "PENDING",
                },
            })

            return { ok: true as const, withdrawalId: withdrawal.id }
        })

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            message: "提现申请已提交，请等待审核",
            withdrawalId: result.withdrawalId,
        })
    } catch (e: any) {
        console.error("❌ 提现申请失败:", e)
        return NextResponse.json({ error: "提现申请失败，请稍后重试" }, { status: 500 })
    }
}

/**
 * GET /api/agent/withdraw
 * 获取提现记录
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    try {
        const withdrawals = await prisma.withdrawal.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 50,
        })

        return NextResponse.json({
            success: true,
            withdrawals,
        })
    } catch (e: any) {
        console.error("❌ 获取提现记录失败:", e)
        return NextResponse.json({ error: "获取提现记录失败" }, { status: 500 })
    }
}
