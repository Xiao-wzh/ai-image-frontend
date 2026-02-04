/**
 * 业务下单接口（与支付分离）
 * 
 * POST /api/orders/create
 * 
 * 请求：{ planId: string }
 * 响应：{ orderId: string, outTradeNo: string, amount: number }
 * 
 * 安全设计：
 * - 必须登录
 * - 价格从数据库读取
 * - 创建 PENDING 状态订单
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateOrderRequestBody {
    planId: string;
}

/**
 * 生成商户订单号
 * 格式: ORD-{timestamp}-{random}
 */
function generateOutTradeNo(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${timestamp}-${random}`;
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
        const body = await req.json().catch(() => null) as CreateOrderRequestBody | null;

        if (!body || !body.planId) {
            return NextResponse.json(
                { error: '套餐ID不能为空' },
                { status: 400 }
            );
        }

        const { planId } = body;

        // 3. 从数据库查询套餐（必须上架）
        const plan = await prisma.plan.findUnique({
            where: { id: planId },
        });

        if (!plan) {
            return NextResponse.json(
                { error: '套餐不存在' },
                { status: 404 }
            );
        }

        if (!plan.isActive) {
            return NextResponse.json(
                { error: '该套餐已下架' },
                { status: 400 }
            );
        }

        // 4. 生成订单号
        const outTradeNo = generateOutTradeNo();

        // 5. 创建商品快照
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

        // 6. 创建订单（PENDING 状态）
        const order = await prisma.order.create({
            data: {
                outTradeNo,
                channel: 'pending',      // 待选择支付渠道
                merchantKey: 'pending',  // 待选择商户
                mchid: 'pending',        // 待选择商户号
                userId,
                amount: plan.price,      // 使用数据库价格！
                currency: 'CNY',
                title: plan.name,
                status: 'PENDING',       // 待支付状态
                planId: plan.id,
                snapshot,
                expiredAt: new Date(Date.now() + 30 * 60 * 1000), // 30分钟过期
            },
        });

        console.log(`[Orders] 创建订单成功: ${outTradeNo}, 套餐: ${plan.name}, 金额: ${plan.price}分`);

        return NextResponse.json({
            success: true,
            data: {
                orderId: order.id,
                outTradeNo: order.outTradeNo,
                amount: order.amount,
                title: order.title,
            },
        });
    } catch (error) {
        console.error('[Orders] 创建订单失败:', error);
        return NextResponse.json(
            { error: '创建订单失败，请稍后重试' },
            { status: 500 }
        );
    }
}
