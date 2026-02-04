/**
 * 管理员订单列表 API
 * 
 * GET /api/admin/orders
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

        // 检查是否为管理员
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: '无权限访问' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');
        const status = searchParams.get('status'); // 可选状态筛选
        const dateStr = searchParams.get('date'); // 可选日期筛选 YYYY-MM-DD

        const where: any = {};
        if (status && status !== 'all') {
            where.status = status;
        }

        // 日期筛选
        if (dateStr) {
            const date = new Date(dateStr);
            const nextDate = new Date(dateStr);
            nextDate.setDate(nextDate.getDate() + 1);
            where.paidAt = {
                gte: date,
                lt: nextDate,
            };
        }

        const orders = await prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
                plan: {
                    select: {
                        name: true,
                        credits: true,
                        giftCredits: true,
                    },
                },
            },
        });

        const total = await prisma.order.count({ where });

        // 统计数据
        const stats = await prisma.order.groupBy({
            by: ['status'],
            _count: { id: true },
            _sum: { amount: true },
        });

        const statsMap: Record<string, { count: number; amount: number }> = {};
        for (const s of stats) {
            statsMap[s.status] = {
                count: s._count.id,
                amount: s._sum.amount || 0,
            };
        }

        // 计算今日和昨日收入
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayEnd);
        yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

        const todayRevenue = await prisma.order.aggregate({
            where: {
                status: 'PAID',
                paidAt: {
                    gte: todayStart,
                    lte: todayEnd,
                },
            },
            _sum: { amount: true },
        });

        const yesterdayRevenue = await prisma.order.aggregate({
            where: {
                status: 'PAID',
                paidAt: {
                    gte: yesterdayStart,
                    lte: yesterdayEnd,
                },
            },
            _sum: { amount: true },
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
                totalCredits: (order.plan?.credits || 0) + (order.plan?.giftCredits || 0),
                user: order.user ? {
                    id: order.user.id,
                    username: order.user.username,
                    name: order.user.name,
                    email: order.user.email,
                    image: order.user.image,
                } : null,
                paidAt: order.paidAt?.toISOString() || null,
                createdAt: order.createdAt.toISOString(),
                channel: order.channel,
            })),
            pagination: {
                total,
                limit,
                offset,
            },
            stats: statsMap,
            dailyRevenue: {
                today: todayRevenue._sum.amount || 0,
                yesterday: yesterdayRevenue._sum.amount || 0,
            },
        });
    } catch (error) {
        console.error('[API] 获取管理员订单列表失败:', error);
        return NextResponse.json({ error: '获取订单失败' }, { status: 500 });
    }
}
