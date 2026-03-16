/**
 * 查询特定日期或月份的收入 API
 *
 * GET /api/admin/orders/revenue?date=YYYY-MM-DD
 * GET /api/admin/orders/revenue?month=YYYY-MM
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceOrAdmin } from '@/lib/check-admin';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const guard = await requireFinanceOrAdmin()
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    try {
        const { searchParams } = new URL(req.url);
        const dateStr = searchParams.get('date'); // YYYY-MM-DD
        const monthStr = searchParams.get('month'); // YYYY-MM

        const UTC8_MS = 8 * 60 * 60 * 1000;
        const DAY_MS = 24 * 60 * 60 * 1000;

        /** 将东八区 YYYY-MM-DD 转为该天 00:00:00 的 UTC Date */
        function utc8DayToUTC(dateStr: string): Date {
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(Date.UTC(y, m - 1, d) - UTC8_MS);
        }

        let startDate: Date;
        let endDate: Date;

        if (dateStr) {
            // 查询特定日期
            startDate = utc8DayToUTC(dateStr);
            endDate = new Date(startDate.getTime() + DAY_MS);
        } else if (monthStr) {
            // 查询特定月份
            const [y, m] = monthStr.split('-').map(Number);
            startDate = new Date(Date.UTC(y, m - 1, 1) - UTC8_MS);
            // 下个月的第一天
            const nextMonth = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1));
            endDate = new Date(nextMonth.getTime() - UTC8_MS);
        } else {
            return NextResponse.json({ error: '请提供 date 或 month 参数' }, { status: 400 });
        }

        // 查询该时间段内的已支付订单
        const orders = await prisma.order.findMany({
            where: {
                status: 'PAID',
                paidAt: { gte: startDate, lt: endDate },
            },
            include: {
                plan: {
                    select: { name: true },
                },
            },
        });

        // 计算总收入
        const totalAmount = orders.reduce((sum, order) => sum + order.amount, 0);

        // 按套餐分组统计
        const planMap = new Map<string, { count: number; amount: number }>();
        for (const order of orders) {
            const planName = order.plan?.name || '未知套餐';
            const existing = planMap.get(planName) || { count: 0, amount: 0 };
            planMap.set(planName, {
                count: existing.count + 1,
                amount: existing.amount + order.amount,
            });
        }

        const planBreakdown = Array.from(planMap.entries()).map(([planName, data]) => ({
            planName,
            count: data.count,
            amount: data.amount,
        }));

        return NextResponse.json({
            success: true,
            data: {
                amount: totalAmount,
                planBreakdown,
            },
        });
    } catch (error) {
        console.error('[API] 查询收入失败:', error);
        return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }
}
