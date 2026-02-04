/**
 * 微信 Native 扫码支付 - 创建订单接口
 * 
 * POST /api/pay/wechat/native/create
 * 
 * 请求：{ planId: string, merchantKey?: string }
 * 响应：{ outTradeNo: string, codeUrl: string, merchantKey: string, mchid: string }
 * 
 * 安全设计：
 * - 必须登录
 * - 仅接收 planId，价格从数据库读取
 * - 严禁信任前端传来的价格
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createNativeOrder } from '@/lib/pay/wechat/service';
import { PaymentError } from '@/lib/pay/wechat/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateOrderRequestBody {
    planId: string;
    merchantKey?: string;
}

export async function POST(req: NextRequest) {
    try {
        // 必须登录
        const session = await auth();
        const userId = session?.user?.id;

        if (!userId) {
            return NextResponse.json(
                { error: '请先登录' },
                { status: 401 }
            );
        }

        // 解析请求体
        const body = await req.json().catch(() => null) as CreateOrderRequestBody | null;

        if (!body) {
            return NextResponse.json(
                { error: '请求体格式错误' },
                { status: 400 }
            );
        }

        const { planId, merchantKey } = body;

        // 校验 planId
        if (!planId || typeof planId !== 'string') {
            return NextResponse.json(
                { error: '套餐ID不能为空' },
                { status: 400 }
            );
        }

        // 创建订单（价格从数据库读取，不信任前端）
        const result = await createNativeOrder({
            planId,
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
