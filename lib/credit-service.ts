import type { PrismaClient } from "@prisma/client"

/**
 * 通用积分退款服务
 *
 * 在事务（tx）上下文中执行退款操作：
 * 1. 增加用户积分
 * 2. 记录积分流水
 *
 * @param tx      Prisma 事务客户端
 * @param userId  用户ID
 * @param amount  退款金额（积分）
 * @param reason  退款原因（写入流水描述）
 */

// 事务客户端类型
type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

export async function refundCredits(
    tx: TxClient,
    userId: string,
    amount: number,
    reason: string
): Promise<void> {
    // 防御性判断：金额无效则跳过
    if (amount <= 0) return

    // 1. 退回到付费积分
    await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
    })

    // 2. 记录积分流水
    await tx.creditRecord.create({
        data: {
            userId,
            amount,
            type: "REFUND",
            description: reason,
        },
    })

    console.log(`[积分服务] 💸 已退还 ${amount} 积分给用户 ${userId}：${reason}`)
}
