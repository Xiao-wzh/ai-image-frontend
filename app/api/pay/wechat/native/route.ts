/**
 * 微信 Native 扫码支付 - 发起支付接口
 * 
 * POST /api/pay/wechat/native
 * 
 * 请求：{ orderId: string }
 * 响应：{ code_url: string, outTradeNo: string }
 * 
 * 说明：
 * - 必须先通过 /api/orders/create 创建订单
 * - 本接口仅负责调用微信支付
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getWechatPayClient } from '@/lib/pay/wechat/client';
import { getMerchantConfig, getDefaultMerchantKey, getNotifyUrl } from '@/lib/pay/wechat/config';
import { OrderStatus, PayChannel } from '@/lib/pay/wechat/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PaymentRequestBody {
    orderId: string;
}

export async function POST(req: NextRequest) {
    try {
        // 1. 必须登录
        const session = await auth();
        const userId = session?.user?.id;

        if (!userId) {
            return NextResponse.json(
                { error: '请先登录' },
                { status: 401 }
            );
        }

        // 2. 解析请求体
        const body = await req.json().catch(() => null) as PaymentRequestBody | null;

        if (!body || !body.orderId) {
            return NextResponse.json(
                { error: '订单ID不能为空' },
                { status: 400 }
            );
        }

        const { orderId } = body;

        // 3. 查询订单（必须属于当前用户）
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                userId: userId,
            },
        });

        if (!order) {
            return NextResponse.json(
                { error: '订单不存在' },
                { status: 404 }
            );
        }

        // 4. 检查订单状态
        if (order.status === OrderStatus.PAID) {
            return NextResponse.json(
                { error: '订单已支付' },
                { status: 400 }
            );
        }

        if (order.status === OrderStatus.CLOSED) {
            return NextResponse.json(
                { error: '订单已关闭' },
                { status: 400 }
            );
        }

        // 5. 检查订单是否过期
        if (order.expiredAt && new Date() > order.expiredAt) {
            // 自动关闭过期订单
            await prisma.order.update({
                where: { id: order.id },
                data: { status: OrderStatus.CLOSED },
            });
            return NextResponse.json(
                { error: '订单已过期，请重新下单' },
                { status: 400 }
            );
        }

        // 6. 获取商户配置
        const merchantKey = getDefaultMerchantKey();
        const config = getMerchantConfig(merchantKey);
        const client = getWechatPayClient(merchantKey);
        const notifyUrl = getNotifyUrl();

        // 7. 更新订单状态和商户信息
        await prisma.order.update({
            where: { id: order.id },
            data: {
                channel: PayChannel.WECHAT,
                merchantKey: merchantKey,
                mchid: config.mchid,
                status: OrderStatus.PAYING,
            },
        });

        // 8. 调用微信 Native 下单 API
        console.log(`[WechatPay] 发起支付: ${order.outTradeNo}, 金额: ${order.amount}分`);

        const result = await client.transactions_native({
            description: order.title.substring(0, 127),
            out_trade_no: order.outTradeNo,
            notify_url: notifyUrl,
            amount: {
                total: order.amount,
                currency: 'CNY',
            },
        });

        if (result.status !== 200 || !result.data?.code_url) {
            console.error('[WechatPay] 下单失败:', result);
            return NextResponse.json(
                { error: '发起支付失败，请稍后重试' },
                { status: 500 }
            );
        }

        const codeUrl = result.data.code_url;

        console.log(`[WechatPay] 下单成功: ${order.outTradeNo}, codeUrl: ${codeUrl}`);

        return NextResponse.json({
            success: true,
            data: {
                code_url: codeUrl,
                outTradeNo: order.outTradeNo,
            },
        });
    } catch (error) {
        console.error('[WechatPay] 发起支付失败:', error);
        return NextResponse.json(
            { error: '发起支付失败，请稍后重试' },
            { status: 500 }
        );
    }
}
