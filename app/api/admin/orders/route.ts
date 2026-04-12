/**
 * 管理员订单列表 API
 * 
 * GET /api/admin/orders
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
        const status = searchParams.get('status'); // 可选状态筛选
        let startDateStr = searchParams.get('startDate'); // 时间窗起点 YYYY-MM-DD
        let endDateStr = searchParams.get('endDate');     // 时间窗终点 YYYY-MM-DD

        // 东八区偏移
        const UTC8_MS = 8 * 60 * 60 * 1000;
        const DAY_MS = 24 * 60 * 60 * 1000;
        const INITIAL_WINDOW_DAYS = 2;

        /** 将东八区 YYYY-MM-DD 转为该天 00:00:00 的 UTC Date */
        function utc8DayToUTC(dateStr: string): Date {
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(Date.UTC(y, m - 1, d) - UTC8_MS);
        }

        /** 将 UTC Date 转为东八区 YYYY-MM-DD */
        function utcToUTC8DateStr(date: Date): string {
            const utc8 = new Date(date.getTime() + date.getTimezoneOffset() * 60000 + UTC8_MS);
            const y = utc8.getFullYear();
            const m = String(utc8.getMonth() + 1).padStart(2, '0');
            const d = String(utc8.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        /** 将 YYYY-MM-DD 向前推 N 天 */
        function subtractDaysStr(dateStr: string, days: number): string {
            const [y, m, d] = dateStr.split('-').map(Number);
            const ts = Date.UTC(y, m - 1, d) - days * DAY_MS;
            const dt = new Date(ts);
            return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
        }

        // ========== 自动时间窗推算 ==========
        // 如果前端没有传 startDate/endDate，从最新订单的日期自动推算
        if (!startDateStr && !endDateStr) {
            const statusWhere = status && status !== 'all' ? { status } : {};
            const latestOrder = await prisma.order.findFirst({
                where: statusWhere,
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true },
            });

            if (latestOrder) {
                endDateStr = utcToUTC8DateStr(latestOrder.createdAt);
                startDateStr = subtractDaysStr(endDateStr, INITIAL_WINDOW_DAYS - 1);
            }
        }

        const where: any = {};
        if (status && status !== 'all') {
            where.status = status;
        }

        // 日期范围筛选（基于 createdAt，东八区）
        if (startDateStr || endDateStr) {
            where.createdAt = {};
            if (startDateStr) {
                where.createdAt.gte = utc8DayToUTC(startDateStr);
            }
            if (endDateStr) {
                const nextDay = new Date(utc8DayToUTC(endDateStr).getTime() + DAY_MS);
                where.createdAt.lt = nextDay;
            }
        }

        // 查询时间窗内的全部订单（不分页）
        const orders = await prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
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

        // 检查是否存在更早的订单（用于"加载更多"按钮）
        let hasMore = false;
        if (where.createdAt?.gte) {
            const olderCount = await prisma.order.count({
                where: {
                    ...(status && status !== 'all' ? { status } : {}),
                    createdAt: { lt: where.createdAt.gte },
                },
            });
            hasMore = olderCount > 0;
        }

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

        // ========== 今日/昨日 & 趋势图 时区计算 ==========
        /** 获取东八区当前时间对应的 Date */
        function getUTC8Now() {
            const now = new Date();
            return new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + UTC8_MS);
        }

        /** 获取东八区某天 00:00:00 的 UTC Date */
        function getUTC8DayStart(year: number, month: number, day: number): Date {
            return new Date(Date.UTC(year, month, day) - UTC8_MS);
        }

        /** 格式化为 MM/DD */
        function formatMMDD(year: number, month: number, day: number): string {
            return `${String(month + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
        }

        const utc8Now = getUTC8Now();
        const todayStart = getUTC8DayStart(utc8Now.getFullYear(), utc8Now.getMonth(), utc8Now.getDate());
        const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

        // 今日 & 昨日收入（并行查询）
        const [todayRevenue, yesterdayRevenue, todayOrderCount] = await Promise.all([
            prisma.order.aggregate({
                where: { status: 'PAID', paidAt: { gte: todayStart, lt: tomorrowStart } },
                _sum: { amount: true },
            }),
            prisma.order.aggregate({
                where: { status: 'PAID', paidAt: { gte: yesterdayStart, lt: todayStart } },
                _sum: { amount: true },
            }),
            prisma.order.count({
                where: { status: 'PAID', paidAt: { gte: todayStart, lt: tomorrowStart } },
            }),
        ]);

        // ========== 当月收入 & 套餐出售情况 ==========
        const monthStart = getUTC8DayStart(utc8Now.getFullYear(), utc8Now.getMonth(), 1);
        const nextMonthStart = new Date(monthStart.getTime() + 32 * 24 * 60 * 60 * 1000);
        const nextMonthStart2 = getUTC8DayStart(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), 1);

        const monthlyRevenue = await prisma.order.aggregate({
            where: { status: 'PAID', paidAt: { gte: monthStart, lt: nextMonthStart2 } },
            _sum: { amount: true },
        });

        // 当月套餐出售情况
        const monthlyPlanSales = await prisma.order.groupBy({
            by: ['planId'],
            where: { status: 'PAID', paidAt: { gte: monthStart, lt: nextMonthStart2 } },
            _count: { id: true },
            _sum: { amount: true },
        });

        // 获取套餐名称
        const planIds = monthlyPlanSales.map(s => s.planId).filter((id): id is string => !!id);
        const plans = planIds.length > 0 ? await prisma.plan.findMany({
            where: { id: { in: planIds } },
            select: { id: true, name: true },
        }) : [];
        const planMap = new Map(plans.map(p => [p.id, p.name]));

        const monthlyPlanBreakdown = monthlyPlanSales.map(s => ({
            planName: s.planId ? planMap.get(s.planId) || '未知套餐' : '未知套餐',
            count: s._count.id,
            amount: s._sum.amount || 0,
        }));

        // ========== 今日套餐出售情况 ==========
        const todayPlanSales = await prisma.order.groupBy({
            by: ['planId'],
            where: { status: 'PAID', paidAt: { gte: todayStart, lt: tomorrowStart } },
            _count: { id: true },
            _sum: { amount: true },
        });

        const todayPlanBreakdown = todayPlanSales.map(s => ({
            planName: s.planId ? planMap.get(s.planId) || '未知套餐' : '未知套餐',
            count: s._count.id,
            amount: s._sum.amount || 0,
        }));

        // ========== 收入趋势图（支持自定义日期范围） ==========
        const chartStartParam = searchParams.get('chartStart');
        const chartEndParam = searchParams.get('chartEnd');

        let chartStartDate: Date;
        let chartEndDate: Date;

        if (chartStartParam && chartEndParam) {
            // 自定义日期范围
            chartStartDate = utc8DayToUTC(chartStartParam);
            chartEndDate = new Date(utc8DayToUTC(chartEndParam).getTime() + DAY_MS);
        } else {
            // 默认近7天
            const CHART_DAYS = 7;
            chartStartDate = new Date(todayStart.getTime() - (CHART_DAYS - 1) * 24 * 60 * 60 * 1000);
            chartEndDate = tomorrowStart;
        }

        // 计算天数
        const chartDays = Math.max(1, Math.ceil((chartEndDate.getTime() - chartStartDate.getTime()) / DAY_MS));

        // 1) 单次查询：获取范围内所有已支付订单的 paidAt 和 amount
        const recentPaidOrders = await prisma.order.findMany({
            where: {
                status: 'PAID',
                paidAt: { gte: chartStartDate, lt: chartEndDate },
            },
            select: { paidAt: true, amount: true },
        });

        // 2) 生成完整日期数组，金额默认为 0
        const chartMap = new Map<string, number>();
        const chartDates: { key: string; year: number; month: number; day: number }[] = [];
        for (let i = 0; i < chartDays; i++) {
            const dayTs = chartStartDate.getTime() + i * 24 * 60 * 60 * 1000;
            // 将 UTC 时间转回东八区日期
            const d = new Date(dayTs + UTC8_MS);
            const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
            chartMap.set(key, 0);
            chartDates.push({ key, year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() });
        }

        // 3) JS 内存聚合：按东八区日期归类求和
        for (const o of recentPaidOrders) {
            if (!o.paidAt) continue;
            const d = new Date(o.paidAt.getTime() + (o.paidAt.getTimezoneOffset() * 60 * 1000) + UTC8_MS);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            chartMap.set(key, (chartMap.get(key) || 0) + o.amount);
        }

        // 4) 组装结果：date 为 YYYY-MM-DD，amount 为元（分转元，保留两位小数）
        const chartData = chartDates.map(({ key, year, month, day }) => ({
            date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            amount: Number(((chartMap.get(key) || 0) / 100).toFixed(2)),
        }));

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
            hasMore,
            windowStart: startDateStr || null,
            windowEnd: endDateStr || null,
            stats: statsMap,
            dailyRevenue: {
                today: todayRevenue._sum.amount || 0,
                yesterday: yesterdayRevenue._sum.amount || 0,
            },
            monthlyRevenue: monthlyRevenue._sum.amount || 0,
            monthlyPlanBreakdown,
            todayPlanBreakdown,
            chartData,
            todayOrderCount,
        });
    } catch (error) {
        console.error('[API] 获取管理员订单列表失败:', error);
        return NextResponse.json({ error: '获取订单失败' }, { status: 500 });
    }
}
