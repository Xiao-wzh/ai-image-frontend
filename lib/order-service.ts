/**
 * 订单结算服务 - 原子结算 + 幂等
 * 
 * 核心功能：
 * 1. CAS 锁定：使用 updateMany + status='PENDING' 确保只有一个请求能结算
 * 2. 事务传播：分润逻辑在同一事务中执行
 * 3. 幂等检查：分润服务内部二次检查
 */

import prisma from '@/lib/prisma';
import { distributeCommissionTx } from '@/lib/agent-service';

// 结算结果类型
export type SettleResult = {
    status: 'SUCCESS' | 'ALREADY_PROCESSED' | 'NOT_FOUND' | 'ERROR';
    orderId?: string;
    userId?: string;
    credits?: number;
    error?: string;
};

interface SettleOptions {
    /** 微信交易号 */
    transactionId?: string;
    /** 回调原始数据 */
    rawNotify?: string;
    /** 来源标识（便于日志区分） */
    source?: 'NOTIFY' | 'RECOVERY' | 'MANUAL';
}

/**
 * 订单结算（原子操作）
 * 
 * 使用 CAS (Compare-and-Swap) 机制确保高并发安全：
 * - 只有 status='PENDING' 的订单能被结算
 * - updateMany 返回 count=0 表示订单已被其他请求抢先处理
 * 
 * @param orderId - 订单 ID
 * @param options - 可选参数
 */
export async function settleOrder(
    orderId: string,
    options: SettleOptions = {}
): Promise<SettleResult> {
    const { transactionId, rawNotify, source = 'RECOVERY' } = options;
    const logPrefix = `[Settle:${source}]`;

    console.log(`${logPrefix} 开始结算订单: ${orderId}`);

    try {
        return await prisma.$transaction(async (tx) => {
            // ============= Step 1: CAS 原子锁定 =============
            // 订单状态可能是 PENDING（刚创建）或 PAYING（扫码中），都可以结算
            const updateResult = await tx.order.updateMany({
                where: {
                    id: orderId,
                    status: { in: ['PENDING', 'PAYING', 'CREATED'] },  // CAS 条件
                },
                data: {
                    status: 'PAID',
                    payPlatformTradeNo: transactionId || undefined,
                    paidAt: new Date(),
                    rawNotify: rawNotify ? JSON.parse(rawNotify) : undefined,
                    notifyProcessedAt: new Date(),
                },
            });

            // ============= Step 2: 检查是否抢到锁 =============
            if (updateResult.count === 0) {
                // 没抢到锁，检查订单是否存在
                const existingOrder = await tx.order.findUnique({
                    where: { id: orderId },
                    select: { status: true },
                });

                if (!existingOrder) {
                    console.log(`${logPrefix} 订单不存在: ${orderId}`);
                    return { status: 'NOT_FOUND', orderId };
                }

                // 订单已被其他请求处理
                console.log(`${logPrefix} 订单已处理，跳过: ${orderId} (当前状态: ${existingOrder.status})`);
                return { status: 'ALREADY_PROCESSED', orderId };
            }

            console.log(`${logPrefix} 抢到锁，开始处理业务逻辑: ${orderId}`);

            // ============= Step 3: 获取订单详情 =============
            const order = await tx.order.findUnique({
                where: { id: orderId },
                include: { plan: true },
            });

            if (!order) {
                // 理论上不可能，因为刚更新成功
                throw new Error('订单查询失败');
            }

            let totalCredits = 0;

            // ============= Step 4: 发放权益 =============
            if (order.userId && order.plan) {
                const plan = order.plan;

                if (plan.type === 'CREDIT') {
                    totalCredits = plan.credits + plan.giftCredits;

                    await tx.user.update({
                        where: { id: order.userId },
                        data: {
                            credits: { increment: totalCredits },
                        },
                    });

                    await tx.creditRecord.create({
                        data: {
                            userId: order.userId,
                            amount: totalCredits,
                            type: 'RECHARGE',
                            description: `购买${plan.name}：积分+${plan.credits}${plan.giftCredits > 0 ? `(赠送${plan.giftCredits})` : ''}`,
                        },
                    });

                    console.log(`${logPrefix} 用户 ${order.userId} 充值 ${totalCredits} 积分 (套餐: ${plan.name})`);
                } else if (plan.type === 'SUBSCRIPTION') {
                    // TODO: VIP 订阅逻辑
                    console.log(`${logPrefix} TODO: 处理VIP订阅 - 用户 ${order.userId}, 套餐: ${plan.name}`);
                }
            }

            // ============= Step 5: 分润（同一事务） =============
            if (order.userId) {
                const commissionResult = await distributeCommissionTx(
                    tx,
                    order.userId,
                    order.amount,
                    'WECHAT',
                    order.id  // orderId 作为幂等键
                );

                if (commissionResult.skipped) {
                    console.log(`${logPrefix} 佣金已发放，跳过（幂等）`);
                } else if (commissionResult.distributed.length > 0) {
                    console.log(`${logPrefix} 佣金分润完成: ${JSON.stringify(commissionResult.distributed)}`);
                }
            }

            console.log(`${logPrefix} 订单结算成功: ${orderId}`);

            return {
                status: 'SUCCESS',
                orderId: order.id,
                userId: order.userId || undefined,
                credits: totalCredits,
            };
        }, {
            // 事务配置：设置隔离级别确保一致性
            isolationLevel: 'Serializable',
            timeout: 10000,  // 10秒超时
        });
    } catch (error: any) {
        console.error(`${logPrefix} 结算失败:`, error);
        return {
            status: 'ERROR',
            orderId,
            error: error?.message || '结算处理失败',
        };
    }
}

/**
 * 根据 outTradeNo 结算订单
 */
export async function settleOrderByOutTradeNo(
    outTradeNo: string,
    options: SettleOptions = {}
): Promise<SettleResult> {
    const order = await prisma.order.findUnique({
        where: { outTradeNo },
        select: { id: true },
    });

    if (!order) {
        return { status: 'NOT_FOUND', error: '订单不存在' };
    }

    return settleOrder(order.id, options);
}
