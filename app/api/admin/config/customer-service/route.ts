/**
 * Admin Customer Service Config API
 * 
 * GET: 获取客服二维码配置
 * PUT: 更新客服二维码配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

const CONFIG_KEYS = ['CUSTOMER_SERVICE_QR', 'AFTER_SALE_GROUP_QR'] as const;

export async function GET() {
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

        const configs = await prisma.systemConfig.findMany({
            where: { key: { in: [...CONFIG_KEYS] } },
        });

        const result: Record<string, string> = {};
        for (const config of configs) {
            result[config.key] = config.value;
        }

        return NextResponse.json({
            success: true,
            customerServiceQr: result['CUSTOMER_SERVICE_QR'] || '',
            afterSaleGroupQr: result['AFTER_SALE_GROUP_QR'] || '',
        });
    } catch (error) {
        console.error('[API] 获取客服配置失败:', error);
        return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
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

        const body = await req.json();
        const { customerServiceQr, afterSaleGroupQr } = body;

        // 更新客服二维码
        if (customerServiceQr !== undefined) {
            await prisma.systemConfig.upsert({
                where: { key: 'CUSTOMER_SERVICE_QR' },
                create: {
                    key: 'CUSTOMER_SERVICE_QR',
                    value: customerServiceQr || '',
                    description: '客服微信二维码图片URL',
                },
                update: {
                    value: customerServiceQr || '',
                },
            });
        }

        // 更新售后群二维码
        if (afterSaleGroupQr !== undefined) {
            await prisma.systemConfig.upsert({
                where: { key: 'AFTER_SALE_GROUP_QR' },
                create: {
                    key: 'AFTER_SALE_GROUP_QR',
                    value: afterSaleGroupQr || '',
                    description: '交流群二维码图片URL',
                },
                update: {
                    value: afterSaleGroupQr || '',
                },
            });
        }

        // 刷新缓存 - 使用动态 require 避免类型问题
        try {
            const { revalidateTag } = require('next/cache');
            revalidateTag('customer-service-qr');
        } catch {
            // Ignore if not in server context
        }

        return NextResponse.json({
            success: true,
            message: '配置已更新',
        });
    } catch (error) {
        console.error('[API] 更新客服配置失败:', error);
        return NextResponse.json({ error: '更新配置失败' }, { status: 500 });
    }
}
