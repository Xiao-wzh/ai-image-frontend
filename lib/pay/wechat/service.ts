/**
 * WeChat Pay V3 核心业务服务
 * 
 * 包含：
 * - createNativeOrder: 创建 Native 扫码支付订单
 * - handleNotify: 处理微信支付回调（验签、解密、事务更新）
 * - queryOrder: 查询订单状态
 */

import prisma from '@/lib/prisma';
import { distributeCommission } from '@/lib/agent-service';
import { getWechatPayClient } from './client';
import {
    getMerchantConfig,
    getDefaultMerchantKey,
    getMerchantConfigBySerial,
    getAllMerchantConfigs,
    getNotifyUrl,
} from './config';
import {
    verifyWechatSignature,
    decryptWechatResource,
    generateOutTradeNo,
} from './crypto';
import {
    OrderStatus,
    PayChannel,
    type MerchantConfig,
    type CreateOrderRequest,
    type CreateOrderResponse,
    type QueryOrderResponse,
    type NotifyHandleResult,
    type NotifyPlainResource,
    type WechatNotifyBody,
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
    ConflictError,
} from './types';

// ============================================
// 创建 Native 订单
// ============================================

/**
 * 创建微信 Native 扫码支付订单
 */
export async function createNativeOrder(
    request: CreateOrderRequest
): Promise<CreateOrderResponse> {
    const { amount, title, merchantKey, userId } = request;

    // 参数校验
    if (!amount || amount <= 0) {
        throw new BadRequestError('订单金额必须大于 0');
    }
    if (!title || title.trim().length === 0) {
        throw new BadRequestError('订单标题不能为空');
    }
    // TODO: 金额应由服务端根据商品系统计算，此处暂用请求参数
    // 基础校验：金额不能超过 10 万元（1000 万分）
    if (amount > 10000000) {
        throw new BadRequestError('订单金额超出限制');
    }

    // 获取商户配置
    const mchKey = merchantKey ?? getDefaultMerchantKey();
    const config = getMerchantConfig(mchKey);
    const client = getWechatPayClient(mchKey);

    // 生成订单号（带渠道前缀）
    const outTradeNo = generateOutTradeNo();
    const notifyUrl = getNotifyUrl();

    // 订单过期时间：2小时后
    const expiredAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    console.log("创建订单参数", {
        outTradeNo,
        channel: PayChannel.WECHAT,
        merchantKey: mchKey,
        mchid: config.mchid,
        userId: userId ?? null,
        amount,
        currency: 'CNY',
        title: title.trim(),
        status: OrderStatus.PAYING,
        expiredAt,
    });

    // 创建数据库订单记录
    const order = await prisma.order.create({
        data: {
            outTradeNo,
            channel: PayChannel.WECHAT,
            merchantKey: mchKey,
            mchid: config.mchid,
            userId: userId ?? null,
            amount,
            currency: 'CNY',
            title: title.trim(),
            status: OrderStatus.PAYING, // 创建后直接进入待支付状态
            expiredAt,
        },
    });

    console.log(`[WechatPay] 创建订单: ${outTradeNo}, 金额: ${amount}分, 商户: ${mchKey}`);

    try {
        // 调用微信 Native 下单 API

        const result = await client.transactions_native({
            description: title.trim().substring(0, 127),
            out_trade_no: outTradeNo,
            notify_url: notifyUrl,
            amount: {
                total: amount,
                currency: 'CNY',
            },
            // time_expire 可选，微信默认 2 小时
        });

        if (result.status !== 200 || !result.data?.code_url) {
            console.error('[WechatPay] 下单失败:', result);
            // 更新订单状态为失败
            await prisma.order.update({
                where: { id: order.id },
                data: { status: OrderStatus.CLOSED },
            });
            throw new Error(`微信下单失败: ${JSON.stringify(result.data)}`);
        }

        const codeUrl = result.data.code_url;

        console.log(`[WechatPay] 下单成功: ${outTradeNo}, codeUrl: ${codeUrl}`);

        return {
            outTradeNo,
            codeUrl,
            merchantKey: mchKey,
            mchid: config.mchid,
        };
    } catch (error) {
        console.error('[WechatPay] 下单异常:', error);
        // 更新订单状态
        await prisma.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.CLOSED },
        });
        throw error;
    }
}

// ============================================
// 处理微信回调
// ============================================

interface NotifyHeaders {
    'wechatpay-timestamp': string;
    'wechatpay-nonce': string;
    'wechatpay-signature': string;
    'wechatpay-serial': string;
}

/**
 * 处理微信支付回调通知
 * 
 * 流程：
 * 1. 验证签名（优先根据 serial 匹配公钥）
 * 2. 解密回调数据
 * 3. 校验订单存在、金额一致
 * 4. 事务内更新订单状态、加积分、记录佣金
 */
export async function handleNotify(
    headers: NotifyHeaders,
    rawBody: string
): Promise<NotifyHandleResult> {
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const signature = headers['wechatpay-signature'];
    const serial = headers['wechatpay-serial'];

    // 1. 验证签名
    const config = await verifySignatureWithSerial(timestamp, nonce, rawBody, signature, serial);
    if (!config) {
        console.error('[WechatPay] 回调验签失败');
        return {
            success: false,
            code: 'FAIL',
            message: '签名验证失败',
        };
    }

    // 2. 解析回调 body
    let notifyBody: WechatNotifyBody;
    try {
        notifyBody = JSON.parse(rawBody);
    } catch {
        console.error('[WechatPay] 回调 body 解析失败');
        return {
            success: false,
            code: 'FAIL',
            message: '请求体格式错误',
        };
    }

    // 3. 解密 resource
    let plainResource: NotifyPlainResource;
    try {
        plainResource = decryptWechatResource<NotifyPlainResource>(
            notifyBody.resource.ciphertext,
            notifyBody.resource.associated_data,
            notifyBody.resource.nonce,
            config.apiV3Key
        );
    } catch (error) {
        console.error('[WechatPay] 回调数据解密失败:', error);
        return {
            success: false,
            code: 'FAIL',
            message: '数据解密失败',
        };
    }

    console.log(`[WechatPay] 收到回调: out_trade_no=${plainResource.out_trade_no}, trade_state=${plainResource.trade_state}`);

    // 仅处理支付成功
    if (plainResource.trade_state !== 'SUCCESS') {
        console.log(`[WechatPay] 忽略非成功状态: ${plainResource.trade_state}`);
        return {
            success: true,
            code: 'SUCCESS',
            message: 'OK',
        };
    }

    // 4. 在事务中处理订单状态更新
    try {
        const result = await processPaymentSuccess(plainResource, rawBody);
        return result;
    } catch (error) {
        console.error('[WechatPay] 处理支付成功回调失败:', error);
        if (error instanceof ConflictError) {
            // 幂等处理：订单已处理过
            return {
                success: true,
                code: 'SUCCESS',
                message: 'OK',
            };
        }
        if (error instanceof BadRequestError) {
            return {
                success: false,
                code: 'FAIL',
                message: error.message,
            };
        }
        return {
            success: false,
            code: 'FAIL',
            message: '系统错误',
        };
    }
}

/**
 * 验证签名（优先根据 serial 匹配公钥）
 */
async function verifySignatureWithSerial(
    timestamp: string,
    nonce: string,
    body: string,
    signature: string,
    serial: string
): Promise<MerchantConfig | null> {
    // 1. 优先根据 serial 匹配
    const configBySerial = getMerchantConfigBySerial(serial);
    if (configBySerial) {
        const valid = verifyWechatSignature(timestamp, nonce, body, signature, configBySerial.wechatpayPublicKey);
        if (valid) {
            console.log(`[WechatPay] 验签成功（serial 匹配）: ${configBySerial.merchantKey}`);
            return configBySerial;
        }
        console.warn(`[WechatPay] serial 匹配但验签失败: ${serial}`);
    }

    // 2. 遍历所有商户公钥尝试验签
    const allConfigs = getAllMerchantConfigs();
    for (const config of allConfigs) {
        const valid = verifyWechatSignature(timestamp, nonce, body, signature, config.wechatpayPublicKey);
        if (valid) {
            console.log(`[WechatPay] 验签成功（遍历匹配）: ${config.merchantKey}`);
            return config;
        }
    }

    return null;
}

/**
 * 处理支付成功（事务）
 * 
 * 在同一个事务中完成：
 * - 校验订单存在
 * - 校验金额一致
 * - 幂等检查（notifyProcessedAt）
 * - 更新订单状态
 * - 给用户加积分
 * - 记录佣金
 */
async function processPaymentSuccess(
    plainResource: NotifyPlainResource,
    rawNotify: string
): Promise<NotifyHandleResult> {
    const outTradeNo = plainResource.out_trade_no;
    const transactionId = plainResource.transaction_id;
    const paidAmount = plainResource.amount.total;

    return await prisma.$transaction(async (tx) => {
        // 1. 查询并锁定订单
        const orders = await tx.$queryRaw<
            Array<{
                id: string;
                userId: string | null;
                merchantKey: string;
                mchid: string;
                amount: number;
                status: string;
                notifyProcessedAt: Date | null;
            }>
        >`SELECT "id", "userId", "merchantKey", "mchid", "amount", "status", "notifyProcessedAt" 
      FROM "Order" 
      WHERE "outTradeNo" = ${outTradeNo} 
      FOR UPDATE`;

        if (orders.length === 0) {
            console.error(`[WechatPay] 订单不存在: ${outTradeNo}`);
            throw new NotFoundError(`订单不存在: ${outTradeNo}`);
        }

        const order = orders[0];

        // 2. 幂等检查：已处理过则跳过
        if (order.notifyProcessedAt !== null || order.status === OrderStatus.PAID) {
            console.log(`[WechatPay] 订单已处理，跳过: ${outTradeNo}`);
            throw new ConflictError('订单已处理');
        }

        // 3. 校验商户匹配
        if (order.mchid !== plainResource.mchid) {
            console.error(`[WechatPay] 商户号不匹配: 订单=${order.mchid}, 回调=${plainResource.mchid}`);
            throw new BadRequestError('商户号不匹配');
        }

        // 4. 校验金额一致（核心安全检查！）
        if (order.amount !== paidAmount) {
            console.error(`[WechatPay] 金额不匹配: 订单=${order.amount}, 回调=${paidAmount}`);
            // TODO: 发送报警通知
            throw new BadRequestError(`金额不匹配: 订单金额=${order.amount}, 支付金额=${paidAmount}`);
        }

        const now = new Date();

        // 5. 更新订单状态
        await tx.order.update({
            where: { id: order.id },
            data: {
                status: OrderStatus.PAID,
                payPlatformTradeNo: transactionId,
                paidAt: now,
                rawNotify: JSON.parse(rawNotify),
                notifyProcessedAt: now,
            },
        });

        // 6. 给用户加积分（如果有 userId）
        if (order.userId) {
            // 积分 = 金额（分），1分钱 = 1积分
            const credits = order.amount;

            await tx.user.update({
                where: { id: order.userId },
                data: {
                    credits: { increment: credits },
                },
            });

            // 写入积分流水
            await tx.creditRecord.create({
                data: {
                    userId: order.userId,
                    amount: credits,
                    type: 'RECHARGE',
                    description: `微信支付充值：积分+${credits}`,
                },
            });

            console.log(`[WechatPay] 用户 ${order.userId} 充值 ${credits} 积分`);
        }

        console.log(`[WechatPay] 订单支付成功: ${outTradeNo}, transactionId: ${transactionId}`);

        return {
            success: true,
            code: 'SUCCESS' as const,
            message: 'OK',
            orderId: order.id,
        };
    }).then(async (result) => {
        // 7. 事务外处理佣金分润（不影响主流程）
        if (result.orderId) {
            const order = await prisma.order.findUnique({
                where: { id: result.orderId },
                select: { userId: true, amount: true, outTradeNo: true },
            });

            if (order?.userId) {
                try {
                    await distributeCommission(order.userId, order.amount, 'WECHAT', order.outTradeNo);
                } catch (e) {
                    console.error('[WechatPay] 佣金分润失败（不影响订单）:', e);
                }
            }
        }

        return result;
    });
}

// ============================================
// 查询订单
// ============================================

/**
 * 查询订单状态
 */
export async function queryOrder(outTradeNo: string): Promise<QueryOrderResponse> {
    const order = await prisma.order.findUnique({
        where: { outTradeNo },
        select: {
            outTradeNo: true,
            status: true,
            amount: true,
            title: true,
            paidAt: true,
            createdAt: true,
        },
    });

    if (!order) {
        throw new NotFoundError(`订单不存在: ${outTradeNo}`);
    }

    return {
        outTradeNo: order.outTradeNo,
        status: order.status as QueryOrderResponse['status'],
        amount: order.amount,
        title: order.title,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
    };
}
