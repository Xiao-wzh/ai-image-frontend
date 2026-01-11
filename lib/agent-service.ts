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
 * 
 * @param newUserId - 新注册用户ID
 * @param inviterId - 邀请人ID
 * @param registerType - 注册类型: USER(拉客户) / AGENT(招代理)
 */
export async function bindAgentRelationship(
    newUserId: string,
    inviterId: string | null,
    registerType: "USER" | "AGENT" = "USER"
): Promise<void> {
    if (!inviterId) return

    try {
        // 获取邀请人信息
        const inviter = await prisma.user.findUnique({
            where: { id: inviterId },
            select: { agentLevel: true },
        })

        if (!inviter) return

        // 双向邀请机制：
        // - 只有当邀请人是 L1/L2 且 registerType === 'AGENT' 时，新用户才成为 L3
        // - 其他情况（包括 L3 邀请，或 L1/L2 发出的普通邀请），新用户默认为 L0
        const isL1OrL2 = inviter.agentLevel === AGENT_LEVEL.L1 || inviter.agentLevel === AGENT_LEVEL.L2
        const shouldBeAgent = isL1OrL2 && registerType === "AGENT"

        if (shouldBeAgent) {
            await prisma.user.update({
                where: { id: newUserId },
                data: { agentLevel: AGENT_LEVEL.L3 },
            })
            console.log(`✅ 新用户 ${newUserId} 成为 L3 推广大使 (邀请人等级: L${inviter.agentLevel}, 类型: 招募代理)`)
        } else if (inviter.agentLevel > 0) {
            // 代理邀请的普通客户，保持 L0
            console.log(`✅ 代理邀请新客户 ${newUserId}，保持 L0 (邀请人等级: L${inviter.agentLevel}, 类型: ${registerType})`)
        }
        // L0 邀请的用户也保持 L0（不做修改）
    } catch (error) {
        console.error("❌ 绑定代理关系失败:", error)
    }
}
/**
 * 三级分润算法 - 级差补齐模型 (Winner Takes All)
 * 
 * 总拨比 20%，按照"向上归集"策略分配：
 * - Level 1 (12%): 直接上级 (Parent) 必拿
 * - Level 2 (5%): 向上找最近的 L1/L2，如果 Parent 就是 L1/L2，则 Parent 兼得
 * - Level 3 (3%): 向上找最近的 L1，如果 Parent/GrandParent 就是 L1，则他兼得
 * 
 * 场景举例：
 * - L1 直推用户充值: L1 拿 20% (12+5+3)
 * - L2 直推用户充值: L2 拿 17% (12+5); L1 拿 3%
 * - L3 直推用户充值: L3 拿 12%; L2 拿 5%; L1 拿 3%
 * 
 * @param userId - 充值用户ID
 * @param amount - 充值金额(分)
 * @param orderType - 订单类型
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
        // 获取充值用户的直接上级
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, invitedById: true },
        })

        if (!user || !user.invitedById) {
            return { success: true, distributed } // 无邀请人，正常返回
        }

        // 获取五级上级链（足够找到各级别代理）
        const ancestors = await getAncestorChain(user.invitedById, 5)

        if (ancestors.length === 0) {
            return { success: true, distributed }
        }

        // 计算各级佣金
        const directCommission = Math.floor(amount * COMMISSION_RATES.DIRECT / 100)      // 12%
        const managementCommission = Math.floor(amount * COMMISSION_RATES.MANAGEMENT / 100) // 5%
        const topCommission = Math.floor(amount * COMMISSION_RATES.TOP / 100)             // 3%

        // 使用事务处理分润
        await prisma.$transaction(async (tx) => {
            // Level 1: 直推奖励 (12%) - 给直接上级
            // 只有代理（L3+）才能获得直推奖励，L0普通用户不参与分润
            const parent = ancestors[0]
            if (parent && parent.agentLevel >= AGENT_LEVEL.L3) {
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
            if (!parent) return

            // ============= Level 1: 直推奖励 (12%) =============
            // 直接上级必拿 12%
            if (directCommission > 0) {
                await tx.user.update({
                    where: { id: parent.id },
                    data: { agentBalance: { increment: directCommission } },
                })
                await tx.commissionRecord.create({
                    data: {
                        earnerId: parent.id,
                        sourceUserId: userId,
                        amount: directCommission,
                        rate: COMMISSION_RATES.DIRECT,
                        level: 1,
                        orderId: orderId || null,
                        orderType,
                    },
                })
                distributed.push({ level: 1, earnerId: parent.id, amount: directCommission, rate: COMMISSION_RATES.DIRECT })
                console.log(`💰 直推奖励: ${parent.id} (L${parent.agentLevel}) 获得 ${directCommission} (12%)`)
            }

            // ============= Level 2: 管理奖励 (5%) =============
            // 找最近的 L1 或 L2（可能是 Parent 自己，也可能是上级）
            let managementEarner: typeof parent | null = null
            if (parent.agentLevel === AGENT_LEVEL.L1 || parent.agentLevel === AGENT_LEVEL.L2) {
                // Parent 本身就是 L1/L2，级差补齐：Parent 兼得 5%
                managementEarner = parent
            } else {
                // 往上找最近的 L1/L2
                for (let i = 1; i < ancestors.length; i++) {
                    const ancestor = ancestors[i]
                    if (ancestor.agentLevel === AGENT_LEVEL.L1 || ancestor.agentLevel === AGENT_LEVEL.L2) {
                        managementEarner = ancestor
                        break
                    }
                }
            }

            if (managementEarner && managementCommission > 0) {
                await tx.user.update({
                    where: { id: managementEarner.id },
                    data: { agentBalance: { increment: managementCommission } },
                })
                await tx.commissionRecord.create({
                    data: {
                        earnerId: managementEarner.id,
                        sourceUserId: userId,
                        amount: managementCommission,
                        rate: COMMISSION_RATES.MANAGEMENT,
                        level: 2,
                        orderId: orderId || null,
                        orderType,
                    },
                })
                distributed.push({ level: 2, earnerId: managementEarner.id, amount: managementCommission, rate: COMMISSION_RATES.MANAGEMENT })
                console.log(`💰 管理奖励: ${managementEarner.id} (L${managementEarner.agentLevel}) 获得 ${managementCommission} (5%)`)
            }

            // ============= Level 3: 顶级奖励 (3%) =============
            // 找最近的 L1（可能是 Parent/GrandParent/更上级）
            let topEarner: typeof parent | null = null
            for (let i = 0; i < ancestors.length; i++) {
                const ancestor = ancestors[i]
                if (ancestor.agentLevel === AGENT_LEVEL.L1) {
                    topEarner = ancestor
                    break
                }
            }

            if (topEarner && topCommission > 0) {
                await tx.user.update({
                    where: { id: topEarner.id },
                    data: { agentBalance: { increment: topCommission } },
                })
                await tx.commissionRecord.create({
                    data: {
                        earnerId: topEarner.id,
                        sourceUserId: userId,
                        amount: topCommission,
                        rate: COMMISSION_RATES.TOP,
                        level: 3,
                        orderId: orderId || null,
                        orderType,
                    },
                })
                distributed.push({ level: 3, earnerId: topEarner.id, amount: topCommission, rate: COMMISSION_RATES.TOP })
                console.log(`💰 顶级奖励: ${topEarner.id} (L${topEarner.agentLevel}) 获得 ${topCommission} (3%)`)
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
        const user: { id: string; agentLevel: number; invitedById: string | null } | null = await prisma.user.findUnique({
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
