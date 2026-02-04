/**
 * 订单查询接口（带原子补单）
 * 
 * GET /api/pay/order/:outTradeNo
 * 
 * 功能：
 * 1. 查询本地订单状态
 * 2. 如果是 PENDING 状态，主动向微信查询
 * 3. 如果微信返回 SUCCESS，调用 settleOrder 原子补单
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getWechatPayClient } from '@/lib/pay/wechat/client';
import { settleOrder } from '@/lib/order-service';
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

        // 1. 查询本地订单
        const order = await prisma.order.findUnique({
            where: { outTradeNo },
            select: {
                id: true,
                outTradeNo: true,
                status: true,
                amount: true,
                title: true,
                paidAt: true,
                createdAt: true,
                merchantKey: true,
            },
        });

        if (!order) {
            return NextResponse.json(
                { error: '订单不存在' },
                { status: 404 }
            );
        }

        // 2. 如果已支付，直接返回
        if (order.status === 'PAID') {
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
        }

        // 3. 如果是待支付状态，主动向微信查询
        if (order.status === 'PENDING' || order.status === 'PAYING' || order.status === 'CREATED') {
            try {
                const client = getWechatPayClient(order.merchantKey || undefined);

                // 调用微信查询订单 API
                const wxResult = await client.query({
                    out_trade_no: outTradeNo,
                });

                console.log(`[OrderQuery] 微信查询结果: ${outTradeNo}`, wxResult.data?.trade_state);

                // 如果微信返回支付成功，执行原子补单
                if (wxResult.status === 200 && wxResult.data?.trade_state === 'SUCCESS') {
                    console.log(`[OrderQuery] 发现掉单，执行原子补单: ${outTradeNo}`);

                    const result = await settleOrder(order.id, {
                        transactionId: wxResult.data.transaction_id,
                        source: 'RECOVERY',
                    });

                    // 无论是 SUCCESS 还是 ALREADY_PROCESSED，都说明已支付
                    if (result.status === 'SUCCESS' || result.status === 'ALREADY_PROCESSED') {
                        return NextResponse.json({
                            success: true,
                            data: {
                                outTradeNo: order.outTradeNo,
                                status: 'PAID',
                                amount: order.amount,
                                title: order.title,
                                paidAt: new Date().toISOString(),
                                createdAt: order.createdAt.toISOString(),
                                recovered: result.status === 'SUCCESS',
                            },
                        });
                    }
                }

                // 微信返回未支付或其他状态
                // trade_state: NOTPAY, USERPAYING, CLOSED, REVOKED, PAYERROR
            } catch (wxError) {
                // 微信查询失败不影响返回本地状态
                console.warn(`[OrderQuery] 微信查询失败（不影响返回）:`, wxError);
            }
        }

        // 4. 返回本地状态
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
