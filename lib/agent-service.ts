import prisma from "@/lib/prisma"

// 从 agent-constants 导入并重新导出（保持其他 API routes 的兼容性）
export { AGENT_LEVEL, COMMISSION_RATES, L1_INITIAL_QUOTA } from "@/lib/agent-constants"
import { AGENT_LEVEL, COMMISSION_RATES } from "@/lib/agent-constants"

type CommissionResult = {
    success: boolean
    distributed: {
        level: number
        earnerId: string
        amount: number
        rate: number
    }[]
    error?: string
}

/**
 * 绑定代理关系 - 在用户注册时调用
 * 根据邀请人的等级，设置新用户的代理等级
 * 
 * @param newUserId - 新注册用户ID
 * @param inviterId - 邀请人ID (可选)
 */
export async function bindAgentRelationship(
    newUserId: string,
    inviterId: string | null
): Promise<void> {
    if (!inviterId) return

    try {
        // 获取邀请人信息
        const inviter = await prisma.user.findUnique({
            where: { id: inviterId },
            select: { agentLevel: true },
        })

        if (!inviter) return

        // 分级处理：
        // - L1/L2 邀请 → 新用户成为 L3（发展下线代理）
        // - L3 邀请 → 新用户保持 L0（普通客户，L3 通过用户充值赚取 12% 佣金）
        // - L0 邀请 → 新用户保持 L0（普通用户互推）
        const isL1OrL2 = inviter.agentLevel === AGENT_LEVEL.L1 || inviter.agentLevel === AGENT_LEVEL.L2

        if (isL1OrL2) {
            await prisma.user.update({
                where: { id: newUserId },
                data: { agentLevel: AGENT_LEVEL.L3 },
            })
            console.log(`✅ 新用户 ${newUserId} 成为 L3 推广大使 (邀请人等级: L${inviter.agentLevel})`)
        } else if (inviter.agentLevel === AGENT_LEVEL.L3) {
            // L3 邀请的用户保持 L0，L3 通过佣金赚钱
            console.log(`✅ L3 代理邀请新客户 ${newUserId}，保持 L0，等待充值佣金`)
        }
        // L0 邀请的用户也保持 L0（不做修改）
    } catch (error) {
        console.error("❌ 绑定代理关系失败:", error)
    }
}

/**
 * 三级分润算法 - 在用户充值成功后调用
 * 分润比例: 12%(直推) + 5%(管理) + 3%(顶级) = 20%
 * 
 * @param userId - 充值用户ID
 * @param amount - 充值金额(积分)
 * @param orderType - 订单类型: CDK / ALIPAY / WECHAT
 * @param orderId - 订单ID(可选)
 */
export async function distributeCommission(
    userId: string,
    amount: number,
    orderType: string,
    orderId?: string
): Promise<CommissionResult> {
    const distributed: CommissionResult["distributed"] = []

    try {
        // 获取充值用户及其上级链
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                invitedById: true,
            },
        })

        if (!user || !user.invitedById) {
            return { success: true, distributed } // 无邀请人，正常返回
        }

        // 获取三级上级
        const ancestors = await getAncestorChain(user.invitedById, 3)

        if (ancestors.length === 0) {
            return { success: true, distributed }
        }

        // 使用事务处理分润
        await prisma.$transaction(async (tx) => {
            // Level 1: 直推奖励 (12%) - 给直接上级
            const parent = ancestors[0]
            if (parent) {
                const commission = Math.floor(amount * COMMISSION_RATES.DIRECT / 100)
                if (commission > 0) {
                    await tx.user.update({
                        where: { id: parent.id },
                        data: { agentBalance: { increment: commission } },
                    })
                    await tx.commissionRecord.create({
                        data: {
                            earnerId: parent.id,
                            sourceUserId: userId,
                            amount: commission,
                            rate: COMMISSION_RATES.DIRECT,
                            level: 1,
                            orderId: orderId || null,
                            orderType,
                        },
                    })
                    distributed.push({
                        level: 1,
                        earnerId: parent.id,
                        amount: commission,
                        rate: COMMISSION_RATES.DIRECT,
                    })
                    console.log(`💰 直推奖励: ${parent.id} 获得 ${commission} (12% of ${amount})`)
                }
            }

            // Level 2: 管理奖励 (5%) - 给上上级，需要L2+（即 L1 或 L2）
            const grandParent = ancestors[1]
            if (grandParent && grandParent.agentLevel >= AGENT_LEVEL.L1 && grandParent.agentLevel <= AGENT_LEVEL.L2) {
                const commission = Math.floor(amount * COMMISSION_RATES.MANAGEMENT / 100)
                if (commission > 0) {
                    await tx.user.update({
                        where: { id: grandParent.id },
                        data: { agentBalance: { increment: commission } },
                    })
                    await tx.commissionRecord.create({
                        data: {
                            earnerId: grandParent.id,
                            sourceUserId: userId,
                            amount: commission,
                            rate: COMMISSION_RATES.MANAGEMENT,
                            level: 2,
                            orderId: orderId || null,
                            orderType,
                        },
                    })
                    distributed.push({
                        level: 2,
                        earnerId: grandParent.id,
                        amount: commission,
                        rate: COMMISSION_RATES.MANAGEMENT,
                    })
                    console.log(`💰 管理奖励: ${grandParent.id} 获得 ${commission} (5% of ${amount})`)
                }
            }

            // Level 3: 顶级奖励 (3%) - 给上上上级，需要L1
            const greatGrandParent = ancestors[2]
            if (greatGrandParent && greatGrandParent.agentLevel === AGENT_LEVEL.L1) {
                const commission = Math.floor(amount * COMMISSION_RATES.TOP / 100)
                if (commission > 0) {
                    await tx.user.update({
                        where: { id: greatGrandParent.id },
                        data: { agentBalance: { increment: commission } },
                    })
                    await tx.commissionRecord.create({
                        data: {
                            earnerId: greatGrandParent.id,
                            sourceUserId: userId,
                            amount: commission,
                            rate: COMMISSION_RATES.TOP,
                            level: 3,
                            orderId: orderId || null,
                            orderType,
                        },
                    })
                    distributed.push({
                        level: 3,
                        earnerId: greatGrandParent.id,
                        amount: commission,
                        rate: COMMISSION_RATES.TOP,
                    })
                    console.log(`💰 顶级奖励: ${greatGrandParent.id} 获得 ${commission} (3% of ${amount})`)
                }
            }
        })

        return { success: true, distributed }
    } catch (error: any) {
        console.error("❌ 分润失败:", error)
        return { success: false, distributed, error: error?.message || "分润处理失败" }
    }
}

/**
 * L1 升级下级为 L2
 * 消耗 1 个授权名额
 * 
 * @param l1UserId - L1 用户ID
 * @param targetUserId - 目标用户ID
 */
export async function promoteToLevel2(
    l1UserId: string,
    targetUserId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // 使用事务确保原子性
        const result = await prisma.$transaction(async (tx) => {
            // 1. 验证 L1 用户
            const l1User = await tx.user.findUnique({
                where: { id: l1UserId },
                select: { agentLevel: true, agentQuota: true },
            })

            if (!l1User) {
                return { success: false, error: "用户不存在" }
            }

            if (l1User.agentLevel !== AGENT_LEVEL.L1) {
                return { success: false, error: "只有合伙人(L1)可以执行此操作" }
            }

            if (l1User.agentQuota <= 0) {
                return { success: false, error: "授权名额已用完" }
            }

            // 2. 验证目标用户
            const targetUser = await tx.user.findUnique({
                where: { id: targetUserId },
                select: { agentLevel: true, invitedById: true },
            })

            if (!targetUser) {
                return { success: false, error: "目标用户不存在" }
            }

            // 目标用户必须是 L1 的直推下级
            if (targetUser.invitedById !== l1UserId) {
                return { success: false, error: "只能升级自己的直推下级" }
            }
            // 只能将 L3 升级为 L2
            // L0 不能升级（不是代理），L1/L2 已经是高等级
            if (targetUser.agentLevel !== AGENT_LEVEL.L3) {
                if (targetUser.agentLevel === AGENT_LEVEL.USER) {
                    return { success: false, error: "该用户不是代理，无法升级" }
                }
                return { success: false, error: "该用户已是运营中心或更高等级" }
            }

            // 3. 执行升级: 扣减名额 + 更新等级
            await tx.user.update({
                where: { id: l1UserId },
                data: { agentQuota: { decrement: 1 } },
            })

            await tx.user.update({
                where: { id: targetUserId },
                data: { agentLevel: AGENT_LEVEL.L2 },
            })

            console.log(`✅ 用户 ${targetUserId} 已升级为 L2 (由 ${l1UserId} 授权)`)

            return { success: true }
        })

        return result
    } catch (error: any) {
        console.error("❌ 升级失败:", error)
        return { success: false, error: error?.message || "升级失败" }
    }
}

/**
 * 获取用户的上级链
 * 
 * @param userId - 起始用户ID
 * @param depth - 向上查找的层数
 */
async function getAncestorChain(
    userId: string,
    depth: number
): Promise<{ id: string; agentLevel: number }[]> {
    const ancestors: { id: string; agentLevel: number }[] = []
    let currentId: string | null = userId

    for (let i = 0; i < depth && currentId; i++) {
        const user = await prisma.user.findUnique({
            where: { id: currentId },
            select: { id: true, agentLevel: true, invitedById: true },
        })

        if (!user) break

        ancestors.push({ id: user.id, agentLevel: user.agentLevel })
        currentId = user.invitedById
    }

    return ancestors
}

/**
 * 获取代理统计数据
 * 
 * @param userId - 用户ID
 */
export async function getAgentStats(userId: string) {
    try {
        const [user, directCount, teamCount, todayCommission, totalCommission, recentRecords] = await Promise.all([
            // 用户信息
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    agentLevel: true,
                    agentBalance: true,
                    agentQuota: true,
                    referralCode: true,
                },
            }),
            // 直推人数
            prisma.user.count({
                where: { invitedById: userId },
            }),
            // 团队人数(三级)
            prisma.user.count({
                where: {
                    OR: [
                        { invitedById: userId },
                        { invitedBy: { invitedById: userId } },
                        { invitedBy: { invitedBy: { invitedById: userId } } },
                    ],
                },
            }),
            // 今日佣金
            prisma.commissionRecord.aggregate({
                where: {
                    earnerId: userId,
                    createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                },
                _sum: { amount: true },
            }),
            // 总佣金
            prisma.commissionRecord.aggregate({
                where: { earnerId: userId },
                _sum: { amount: true },
            }),
            // 最近佣金记录 - 包含来源用户及其邀请人信息
            prisma.commissionRecord.findMany({
                where: { earnerId: userId },
                orderBy: { createdAt: "desc" },
                take: 20,
                include: {
                    sourceUser: {
                        select: {
                            username: true,
                            email: true,
                            invitedBy: {
                                select: { username: true, email: true, id: true }
                            }
                        }
                    },
                },
            }),
        ])

        return {
            agentLevel: user?.agentLevel ?? 0,
            agentBalance: user?.agentBalance ?? 0,
            agentQuota: user?.agentQuota ?? 0,
            referralCode: user?.referralCode ?? null,
            directCount,
            teamCount,
            todayCommission: todayCommission._sum.amount ?? 0,
            totalCommission: totalCommission._sum.amount ?? 0,
            recentRecords,
        }
    } catch (error) {
        console.error("获取代理统计失败:", error)
        return null
    }
}
