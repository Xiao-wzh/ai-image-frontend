/**
 * 获取可用套餐列表
 * 
 * GET /api/plans
 * 
 * 响应：{ success: true, data: Plan[] }
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const plans = await prisma.plan.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
                id: true,
                name: true,
                description: true,
                price: true,
                originalPrice: true,
                credits: true,
                giftCredits: true,
                duration: true,
                type: true,
                isRecommend: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: plans,
        });
    } catch (error) {
        console.error('[Plans] 获取套餐列表失败:', error);
        return NextResponse.json(
            { error: '获取套餐列表失败' },
            { status: 500 }
        );
    }
}
