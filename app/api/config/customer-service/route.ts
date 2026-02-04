/**
 * Public Customer Service QR Config API
 * 获取客服二维码配置（公开访问）
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { unstable_cache } from 'next/cache';

export const runtime = 'nodejs';

const getCustomerServiceConfig = unstable_cache(
    async () => {
        const configs = await prisma.systemConfig.findMany({
            where: { key: { in: ['CUSTOMER_SERVICE_QR', 'AFTER_SALE_GROUP_QR'] } },
        });

        const result: Record<string, string> = {};
        for (const config of configs) {
            result[config.key] = config.value;
        }

        return {
            customerServiceQr: result['CUSTOMER_SERVICE_QR'] || '',
            afterSaleGroupQr: result['AFTER_SALE_GROUP_QR'] || '',
        };
    },
    ['customer-service-qr'],
    {
        tags: ['customer-service-qr'],
        revalidate: 60,
    }
);

export async function GET() {
    try {
        const config = await getCustomerServiceConfig();

        return NextResponse.json({
            success: true,
            ...config,
        });
    } catch (error) {
        console.error('[API] 获取客服配置失败:', error);
        return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
    }
}
