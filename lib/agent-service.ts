import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

// 从 agent-constants 导入并重新导出（保持其他 API routes 的兼容性）
export { AGENT_LEVEL, COMMISSION_RATES, L1_INITIAL_QUOTA } from "@/lib/agent-constants"
import { AGENT_LEVEL, COMMISSION_RATES } from "@/lib/agent-constants"

// Prisma 事务客户端类型
type TransactionClient = Omit<
    typeof prisma,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

type CommissionResult = {
    success: boolean
    skipped?: boolean  // 幂等跳过标记
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
 * ================================================================================
 * 三级分润算法 - 级差补齐模型 (Winner Takes All)
 * ================================================================================
 * 
 * 【核心规则】
 * - 总拨比：20%（按实付金额计算，不含赠送积分）
 * - L0 普通用户作为邀请人时：不参与现金分润（只获得积分奖励，在注册时已处理）
 * 
 * 【分润层级】
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ 层级              │ 比例  │ 领取条件                                        │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Level 1 (直推)    │ 12%   │ 直接上级必拿（必须是代理 L1/L2/L3）              │
 * │ Level 2 (管理)    │ 5%    │ 向上找最近的 L1/L2；若 Parent 是 L1/L2 则补齐    │
 * │ Level 3 (顶级)    │ 3%    │ 向上找最近的 L1；若 Parent 是 L1 则补齐          │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * 【场景分润示例】（假设充值 100 元）
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ 场景                       │ L3 获得  │ L2 获得  │ L1 获得  │ 合计        │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ L0 直推用户充值            │ -        │ -        │ -        │ 0（无分润） │
 * │ L3 直推用户充值            │ 10%      │ 5%       │ 5%       │ 20%        │
 * │ L2 直推用户充值            │ -        │ 15%      │ 5%       │ 20%        │
 * │ L1 直推用户充值            │ -        │ -        │ 20%      │ 20%        │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * 【级差补齐说明】
 * - 如果 Parent 本身就是 L1/L2，则 Parent 直接获得 10% + 5% = 15%
 * - 如果 Parent 本身就是 L1，则 Parent 直接获得 15% + 5% = 20%
 * - 未发放的佣金归平台所有（如上级链中找不到 L1）
 * 
 * @param userId - 充值用户 ID
 * @param amount - 实付金额（分），不含赠送积分
 * @param orderType - 订单类型：CDK / ALIPAY / WECHAT
 * @param orderId - 订单 ID（可选）
 * @returns CommissionResult - 分润结果，包含各级分润详情
 */
export async function distributeCommission(
    userId: string,
    amount: number,
    orderType: string,
    orderId?: string
): Promise<CommissionResult> {
    const distributed: CommissionResult["distributed"] = []

    try {
        console.log(`[Commission] 开始处理分润 - 用户: ${userId}, 金额: ${amount}分, 订单: ${orderId}`)

        // 获取充值用户的直接上级
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, invitedById: true },
        })

        if (!user) {
            console.log(`[Commission] 用户不存在: ${userId}`)
            return { success: true, distributed }
        }

        if (!user.invitedById) {
            console.log(`[Commission] 用户 ${userId} 无邀请人，跳过分润`)
            return { success: true, distributed } // 无邀请人，正常返回
        }

        console.log(`[Commission] 用户 ${userId} 的邀请人: ${user.invitedById}`)

        // 获取五级上级链（足够找到各级别代理）
        const ancestors = await getAncestorChain(user.invitedById, 5)
        console.log(`[Commission] 上级链: ${JSON.stringify(ancestors.map(a => ({ id: a.id, level: a.agentLevel })))}`)

        if (ancestors.length === 0) {
            console.log(`[Commission] 上级链为空，跳过分润`)
            return { success: true, distributed }
        }

        // 计算各级佣金
        const directCommission = Math.floor(amount * COMMISSION_RATES.DIRECT / 100)      // 10%
        const managementCommission = Math.floor(amount * COMMISSION_RATES.MANAGEMENT / 100) // 5%
        const topCommission = Math.floor(amount * COMMISSION_RATES.TOP / 100)             // 5%

        // 使用事务处理分润
        await prisma.$transaction(async (tx) => {
            const parent = ancestors[0]
            if (!parent) return

            // ============= Level 1: 直推奖励 (10%) =============
            // 只有代理（L1/L2/L3）才能获得直推奖励，L0 普通用户不参与分润
            if (parent.agentLevel > 0 && directCommission > 0) {
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
                console.log(`💰 直推奖励: ${parent.id} (L${parent.agentLevel}) 获得 ${directCommission} (10%)`)
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

            // ============= Level 3: 顶级奖励 (5%) =============
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
                console.log(`💰 顶级奖励: ${topEarner.id} (L${topEarner.agentLevel}) 获得 ${topCommission} (5%)`)
            }
        })

        return { success: true, distributed }
    } catch (error: any) {
        console.error("❌ 分润失败:", error)
        return { success: false, distributed, error: error?.message || "分润处理失败" }
    }
}

/**
 * ================================================================================
 * 三级分润算法 - 事务版本（用于原子结算）
 * ================================================================================
 * 
 * 与 distributeCommission 相同的分润逻辑，但：
 * 1. 接收外部传入的事务客户端（tx），确保与订单结算在同一事务
 * 2. 内置幂等检查，防止重复分润
 * 
 * @param tx - Prisma 事务客户端（必须）
 * @param userId - 充值用户 ID
 * @param amount - 实付金额（分）
 * @param orderType - 订单类型
 * @param orderId - 订单 ID（必须，用于幂等检查）
 */
export async function distributeCommissionTx(
    tx: TransactionClient,
    userId: string,
    amount: number,
    orderType: string,
    orderId: string
): Promise<CommissionResult> {
    const distributed: CommissionResult["distributed"] = []

    try {
        console.log(`[CommissionTx] 开始处理分润 - 用户: ${userId}, 金额: ${amount}分, 订单: ${orderId}`)

        // ============= 幂等检查：是否已有该订单的佣金记录 =============
        const existingRecord = await tx.commissionRecord.findFirst({
            where: { orderId },
        })

        if (existingRecord) {
            console.log(`[CommissionTx] 订单 ${orderId} 已有佣金记录，跳过分润（幂等）`)
            return { success: true, skipped: true, distributed }
        }

        // 获取充值用户的邀请人
        const user = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true, invitedById: true },
        })

        if (!user) {
            console.log(`[CommissionTx] 用户不存在: ${userId}`)
            return { success: true, distributed }
        }

        if (!user.invitedById) {
            console.log(`[CommissionTx] 用户 ${userId} 无邀请人，跳过分润`)
            return { success: true, distributed }
        }

        // 获取上级链（使用事务客户端）
        const ancestors = await getAncestorChainTx(tx, user.invitedById, 5)
        console.log(`[CommissionTx] 上级链: ${JSON.stringify(ancestors.map(a => ({ id: a.id, level: a.agentLevel })))}`)

        if (ancestors.length === 0) {
            return { success: true, distributed }
        }

        // 计算各级佣金
        const directCommission = Math.floor(amount * COMMISSION_RATES.DIRECT / 100)
        const managementCommission = Math.floor(amount * COMMISSION_RATES.MANAGEMENT / 100)
        const topCommission = Math.floor(amount * COMMISSION_RATES.TOP / 100)

        const parent = ancestors[0]
        if (!parent) return { success: true, distributed }

        // Level 1: 直推奖励 (10%)
        if (parent.agentLevel > 0 && directCommission > 0) {
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
                    orderId,
                    orderType,
                },
            })
            distributed.push({ level: 1, earnerId: parent.id, amount: directCommission, rate: COMMISSION_RATES.DIRECT })
            console.log(`💰 直推奖励: ${parent.id} (L${parent.agentLevel}) 获得 ${directCommission} (10%)`)
        }

        // Level 2: 管理奖励 (5%)
        let managementEarner: typeof parent | null = null
        if (parent.agentLevel === AGENT_LEVEL.L1 || parent.agentLevel === AGENT_LEVEL.L2) {
            managementEarner = parent
        } else {
            for (let i = 1; i < ancestors.length; i++) {
                if (ancestors[i].agentLevel === AGENT_LEVEL.L1 || ancestors[i].agentLevel === AGENT_LEVEL.L2) {
                    managementEarner = ancestors[i]
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
                    orderId,
                    orderType,
                },
            })
            distributed.push({ level: 2, earnerId: managementEarner.id, amount: managementCommission, rate: COMMISSION_RATES.MANAGEMENT })
            console.log(`💰 管理奖励: ${managementEarner.id} (L${managementEarner.agentLevel}) 获得 ${managementCommission} (5%)`)
        }

        // Level 3: 顶级奖励 (5%)
        let topEarner: typeof parent | null = null
        for (const ancestor of ancestors) {
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
                    orderId,
                    orderType,
                },
            })
            distributed.push({ level: 3, earnerId: topEarner.id, amount: topCommission, rate: COMMISSION_RATES.TOP })
            console.log(`💰 顶级奖励: ${topEarner.id} (L${topEarner.agentLevel}) 获得 ${topCommission} (5%)`)
        }

        return { success: true, distributed }
    } catch (error: any) {
        console.error("❌ 分润失败(Tx):", error)
        return { success: false, distributed, error: error?.message || "分润处理失败" }
    }
}

/**
 * 获取上级链 - 事务版本
 */
async function getAncestorChainTx(
    tx: TransactionClient,
    userId: string,
    depth: number
): Promise<{ id: string; agentLevel: number }[]> {
    const ancestors: { id: string; agentLevel: number }[] = []
    let currentId: string | null = userId

    for (let i = 0; i < depth && currentId; i++) {
        const user: { id: string; agentLevel: number; invitedById: string | null } | null = await tx.user.findUnique({
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
