import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { AGENT_LEVEL } from "@/lib/agent-constants"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/agent/team
 * 获取当前用户的直推团队成员
 * L1/L2 可以看到 L3 成员的下属团队人数和团队累计收益
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    try {
        // 获取当前用户的代理等级
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { agentLevel: true },
        })

        const isManager = currentUser?.agentLevel === AGENT_LEVEL.L1 ||
            currentUser?.agentLevel === AGENT_LEVEL.L2

        // 获取直推下级
        const directMembers = await prisma.user.findMany({
            where: { invitedById: userId },
            select: {
                id: true,
                username: true,
                email: true,
                agentLevel: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        })

        // 计算每个成员的贡献收益
        const membersWithContribution = await Promise.all(
            directMembers.map(async (member) => {
                // 该成员直接贡献的佣金
                const contribution = await prisma.commissionRecord.aggregate({
                    where: {
                        earnerId: userId,
                        sourceUserId: member.id,
                    },
                    _sum: { amount: true },
                })

                // 对于 L1/L2，如果成员是 L3，还要计算其下属团队数据
                let subTeamCount = 0
                let teamEarnings = 0

                if (isManager && member.agentLevel === AGENT_LEVEL.L3) {
                    // L3 的下属客户数量（L3 直推的 L0）
                    subTeamCount = await prisma.user.count({
                        where: { invitedById: member.id },
                    })

                    // L3 团队带来的总佣金（包括 L3 客户的充值给当前用户带来的佣金）
                    const teamContribution = await prisma.commissionRecord.aggregate({
                        where: {
                            earnerId: userId,
                            sourceUser: {
                                invitedById: member.id,
                            },
                        },
                        _sum: { amount: true },
                    })
                    teamEarnings = teamContribution._sum.amount || 0
                }

                return {
                    ...member,
                    contribution: contribution._sum.amount || 0,
                    subTeamCount,  // L3 下属客户数量
                    teamEarnings,  // L3 团队带来的总佣金
                }
            })
        )

        return NextResponse.json({
            success: true,
            members: membersWithContribution,
        })
    } catch (e: any) {
        console.error("❌ 获取团队成员失败:", e)
        return NextResponse.json({ error: "获取团队成员失败" }, { status: 500 })
    }
}
