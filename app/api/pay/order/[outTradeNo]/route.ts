/**
 * 订单查询接口
 * 
 * GET /api/pay/order/:outTradeNo
 * 
 * 用于前端轮询订单支付状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOrder } from '@/lib/pay/wechat/service';
import { PaymentError } from '@/lib/pay/wechat/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
    params: Promise<{
        outTradeNo: string;
    }>;
}

export async function GET(
    req: NextRequest,
    { params }: RouteParams
) {
    try {
        const { outTradeNo } = await params;

        if (!outTradeNo) {
            return NextResponse.json(
                { error: '订单号不能为空' },
                { status: 400 }
            );
        }

        const order = await queryOrder(outTradeNo);

        return NextResponse.json({
            success: true,
            data: {
                outTradeNo: order.outTradeNo,
                status: order.status,
                amount: order.amount,
                title: order.title,
                paidAt: order.paidAt?.toISOString() ?? null,
                createdAt: order.createdAt.toISOString(),
            },
        });
    } catch (error) {
        console.error('[API] 查询订单失败:', error);

        if (error instanceof PaymentError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.httpStatus }
            );
        }

        return NextResponse.json(
            { error: '查询订单失败' },
            { status: 500 }
        );
    }
}
