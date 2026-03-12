import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    // 1. 安全校验：防止恶意调用
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 2. 找到所有状态为 CREATED 或 PAYING，且创建时间超过 60 分钟的订单
        // 每次最多处理 50 个，防止 V8 内存溢出或数据库死锁
        const BATCH_LIMIT = 50;
        const timeoutThreshold = new Date(Date.now() - 60 * 60 * 1000); // 60 分钟前

        const unpaidOrders = await prisma.order.findMany({
            where: {
                status: { in: ["CREATED", "PAYING"] },
                createdAt: { lt: timeoutThreshold },
            },
            take: BATCH_LIMIT,
            orderBy: { createdAt: "asc" }, // 优先处理最早的订单
        });

        console.log(`[CRON UNPAID] 🔍 发现 ${unpaidOrders.length} 个超时未支付订单 (本批上限: ${BATCH_LIMIT})`);

        if (unpaidOrders.length === 0) {
            return NextResponse.json({ message: "No timed-out orders found." });
        }

        // 3. 批量更新订单状态为 CLOSED
        const orderIds = unpaidOrders.map(order => order.id);

        const result = await prisma.order.updateMany({
            where: {
                id: { in: orderIds },
            },
            data: {
                status: "CLOSED",
            },
        });

        console.log(`[CRON UNPAID] 🚫 成功关闭了 ${result.count} 个超时未支付订单`);

        return NextResponse.json({
            success: true,
            closedCount: result.count,
        });

    } catch (error: any) {
        console.error("[CRON UNPAID] ❌ 关闭超时订单任务执行失败:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
