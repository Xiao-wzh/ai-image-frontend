/**
 * 微信 Native 扫码支付 - 创建订单接口
 * 
 * POST /api/pay/wechat/native/create
 * 
 * 请求：{ amount: number, title: string, merchantKey?: string }
 * 响应：{ outTradeNo: string, codeUrl: string, merchantKey: string, mchid: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createNativeOrder } from '@/lib/pay/wechat/service';
import { PaymentError, BadRequestError } from '@/lib/pay/wechat/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateOrderRequestBody {
    amount: number;
    title: string;
    merchantKey?: string;
}

export async function POST(req: NextRequest) {
    try {
        // 获取当前用户（可选，允许未登录下单）
        const session = await auth();
        const userId = session?.user?.id;

        // 解析请求体
        const body = await req.json().catch(() => null) as CreateOrderRequestBody | null;

        if (!body) {
            return NextResponse.json(
                { error: '请求体格式错误' },
                { status: 400 }
            );
        }

        const { amount, title, merchantKey } = body;

        // 基础校验
        if (typeof amount !== 'number' || amount <= 0) {
            return NextResponse.json(
                { error: '订单金额必须是正整数（单位：分）' },
                { status: 400 }
            );
        }

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return NextResponse.json(
                { error: '订单标题不能为空' },
                { status: 400 }
            );
        }

        // 创建订单
        const result = await createNativeOrder({
            amount: Math.floor(amount), // 确保是整数
            title: title.trim(),
            merchantKey,
            userId,
        });

        console.log(`[API] 创建订单成功: ${result.outTradeNo}`);

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[API] 创建订单失败:', error);

        if (error instanceof PaymentError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.httpStatus }
            );
        }

        // 不要暴露内部错误详情
        return NextResponse.json(
            { error: '创建订单失败，请稍后重试' },
            { status: 500 }
        );
    }
}
