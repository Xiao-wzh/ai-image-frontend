/**
 * 用户订单列表 API
 * 
 * GET /api/orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        const orders = await prisma.order.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
                plan: {
                    select: {
                        name: true,
                        credits: true,
                        giftCredits: true,
                    },
                },
            },
        });

        const total = await prisma.order.count({
            where: { userId: session.user.id },
        });

        return NextResponse.json({
            success: true,
            data: orders.map(order => ({
                id: order.id,
                outTradeNo: order.outTradeNo,
                amount: order.amount,
                status: order.status,
                planName: order.plan?.name || order.title,
                credits: order.plan?.credits || 0,
                giftCredits: order.plan?.giftCredits || 0,
                paidAt: order.paidAt?.toISOString() || null,
                createdAt: order.createdAt.toISOString(),
                expiredAt: order.expiredAt?.toISOString() || null,
            })),
            pagination: {
                total,
                limit,
                offset,
            },
        });
    } catch (error) {
        console.error('[API] 获取订单列表失败:', error);
        return NextResponse.json({ error: '获取订单失败' }, { status: 500 });
    }
}
