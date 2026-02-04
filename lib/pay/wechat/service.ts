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
 * 
 * 安全设计：
 * 1. 仅接收 planId，从数据库查询价格
 * 2. 严禁信任前端传来的价格
 * 3. 保存商品快照用于对账
 */
export async function createNativeOrder(
    request: CreateOrderRequest
): Promise<CreateOrderResponse> {
    const { planId, merchantKey, userId } = request;

    // 1. 校验 planId
    if (!planId || typeof planId !== 'string') {
        throw new BadRequestError('套餐ID不能为空');
    }

    // 2. 从数据库查询套餐（必须上架）
    const plan = await prisma.plan.findUnique({
        where: { id: planId },
    });

    if (!plan) {
        throw new NotFoundError('套餐不存在');
    }

    if (!plan.isActive) {
        throw new BadRequestError('该套餐已下架');
    }

    // 3. 使用数据库中的价格（核心安全点！）
    const amount = plan.price;
    const title = plan.name;

    // 基础校验：金额不能超过 10 万元（1000 万分）
    if (amount > 10000000) {
        throw new BadRequestError('订单金额超出限制');
    }

    // 4. 获取商户配置
    const mchKey = merchantKey ?? getDefaultMerchantKey();
    const config = getMerchantConfig(mchKey);
    const client = getWechatPayClient(mchKey);

    // 5. 生成订单号（带渠道前缀）
    const outTradeNo = generateOutTradeNo();
    const notifyUrl = getNotifyUrl();

    // 订单过期时间：2小时后
    const expiredAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    // 6. 创建商品快照（用于对账和历史记录）
    const snapshot = {
        planId: plan.id,
        name: plan.name,
        description: plan.description,
        type: plan.type,
        price: plan.price,
        credits: plan.credits,
        giftCredits: plan.giftCredits,
        duration: plan.duration,
        features: plan.features,
    };

    console.log(`[WechatPay] 创建订单: ${outTradeNo}, 套餐: ${plan.name}, 金额: ${amount}分, 商户: ${mchKey}`);

    // 7. 创建数据库订单记录
    const order = await prisma.order.create({
        data: {
            outTradeNo,
            channel: PayChannel.WECHAT,
            merchantKey: mchKey,
            mchid: config.mchid,
            userId,
            amount,
            currency: 'CNY',
            title,
            status: OrderStatus.PAYING,
            expiredAt,
            planId: plan.id,
            snapshot,
        },
    });

    try {
        // 8. 调用微信 Native 下单 API
        const result = await client.transactions_native({
            description: title.substring(0, 127),
            out_trade_no: outTradeNo,
            notify_url: notifyUrl,
            amount: {
                total: amount,
                currency: 'CNY',
            },
        });

        if (result.status !== 200 || !result.data?.code_url) {
            console.error('[WechatPay] 下单失败:', result);
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
 * 处理支付成功
 * 
 * 回调特有的安全校验后，调用原子结算服务
 */
async function processPaymentSuccess(
    plainResource: NotifyPlainResource,
    rawNotify: string
): Promise<NotifyHandleResult> {
    const outTradeNo = plainResource.out_trade_no;
    const transactionId = plainResource.transaction_id;
    const paidAmount = plainResource.amount.total;

    // 1. 查询订单（回调特有的安全校验）
    const order = await prisma.order.findUnique({
        where: { outTradeNo },
        select: {
            id: true,
            userId: true,
            merchantKey: true,
            mchid: true,
            amount: true,
            status: true,
            notifyProcessedAt: true,
        },
    });

    if (!order) {
        console.error(`[WechatPay] 订单不存在: ${outTradeNo}`);
        throw new NotFoundError(`订单不存在: ${outTradeNo}`);
    }

    // 2. 幂等检查：已处理过则跳过（但返回成功，告诉微信不要重试）
    if (order.notifyProcessedAt !== null || order.status === OrderStatus.PAID) {
        console.log(`[WechatPay] 订单已处理，跳过: ${outTradeNo}`);
        return {
            success: true,
            code: 'SUCCESS' as const,
            message: 'OK (已处理)',
            orderId: order.id,
        };
    }

    // 3. 校验商户匹配
    if (order.mchid !== plainResource.mchid) {
        console.error(`[WechatPay] 商户号不匹配: 订单=${order.mchid}, 回调=${plainResource.mchid}`);
        throw new BadRequestError('商户号不匹配');
    }

    // 4. 校验金额一致（核心安全检查！）
    if (order.amount !== paidAmount) {
        console.error(`[WechatPay] 金额不匹配: 订单=${order.amount}, 回调=${paidAmount}`);
        throw new BadRequestError(`金额不匹配: 订单金额=${order.amount}, 支付金额=${paidAmount}`);
    }

    // 5. 调用原子结算服务（CAS + 事务内分润）
    const { settleOrder } = await import('@/lib/order-service');

    const result = await settleOrder(order.id, {
        transactionId,
        rawNotify,
        source: 'NOTIFY',
    });

    // ALREADY_PROCESSED 也算成功（被其他请求抢先处理了）
    if (result.status === 'SUCCESS' || result.status === 'ALREADY_PROCESSED') {
        console.log(`[WechatPay] 订单支付成功: ${outTradeNo}, transactionId: ${transactionId}`);
        return {
            success: true,
            code: 'SUCCESS' as const,
            message: 'OK',
            orderId: order.id,
        };
    }

    throw new Error(result.error || '订单处理失败');
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
