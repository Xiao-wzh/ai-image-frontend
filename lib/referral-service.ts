import prisma from "@/lib/prisma"
import { REFERRAL_COMMISSION_RATE } from "@/lib/constants"

type ReferralRewardResult = {
    success: boolean
    commission?: number
    inviterId?: string
    error?: string
}

/**
 * 处理推广返佣
 * 当用户充值时，给邀请人发放佣金
 * 
 * @param userId - 充值用户ID
 * @param rechargeAmount - 充值金额（积分）
 * @param sourceType - 来源类型: CDK / ALIPAY / WECHAT
 * @param sourceId - 关联的订单ID或CDK码（可选）
 * @returns 处理结果
 */
export async function processReferralReward(
    userId: string,
    rechargeAmount: number,
    sourceType: string,
    sourceId?: string
): Promise<ReferralRewardResult> {
    try {
        // 1. 获取充值用户信息
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                invitedById: true,
                email: true,
                username: true,
            },
        })

        if (!user) {
            return { success: false, error: "用户不存在" }
        }

        // 2. 检查是否有邀请人
        if (!user.invitedById) {
            return { success: true } // 无邀请人，正常返回
        }

        // 3. 计算佣金（向下取整）
        const commission = Math.floor(rechargeAmount * REFERRAL_COMMISSION_RATE)

        if (commission <= 0) {
            return { success: true } // 佣金太少，不处理
        }

        // 4. 使用事务处理佣金发放
        await prisma.$transaction(async (tx) => {
            // 4.1 给邀请人增加积分
            await tx.user.update({
                where: { id: user.invitedById! },
                data: {
                    credits: { increment: commission },
                },
            })

            // 4.2 创建推广记录
            await tx.referralRecord.create({
                data: {
                    inviterId: user.invitedById!,
                    inviteeId: userId,
                    amount: commission,
                    sourceType,
                    sourceId: sourceId || null,
                },
            })

            // 4.3 创建积分记录
            const userIdentifier = user.username || user.email || userId
            await tx.creditRecord.create({
                data: {
                    userId: user.invitedById!,
                    amount: commission,
                    type: "REFERRAL_REWARD",
                    description: `邀请奖励 (来自用户 ${userIdentifier} 充值)`,
                },
            })
        })

        console.log(`✅ 推广返佣成功: 邀请人 ${user.invitedById} 获得 ${commission} 积分 (来自 ${userId})`)

        return {
            success: true,
            commission,
            inviterId: user.invitedById,
        }

    } catch (error: any) {
        console.error("❌ 推广返佣失败:", error)
        return {
            success: false,
            error: error?.message || "处理失败",
        }
    }
}

/**
 * 获取用户的推广统计
 * 
 * @param userId - 用户ID
 * @returns 推广统计数据
 */
export async function getReferralStats(userId: string) {
    try {
        const [inviteCount, totalRewards, recentRecords] = await Promise.all([
            // 邀请人数
            prisma.user.count({
                where: { invitedById: userId },
            }),
            // 总佣金
            prisma.referralRecord.aggregate({
                where: { inviterId: userId },
                _sum: { amount: true },
            }),
            // 最近佣金记录
            prisma.referralRecord.findMany({
                where: { inviterId: userId },
                orderBy: { createdAt: "desc" },
                take: 10,
                include: {
                    invitee: {
                        select: { username: true, email: true },
                    },
                },
            }),
        ])

        return {
            inviteCount,
            totalRewards: totalRewards._sum.amount || 0,
            recentRecords,
        }
    } catch (error) {
        console.error("获取推广统计失败:", error)
        return {
            inviteCount: 0,
            totalRewards: 0,
            recentRecords: [],
        }
    }
}
