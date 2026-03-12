import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { refundCredits } from "@/lib/credit-service"; // 引入我们之前抽离的退款服务

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
        // 2. 找到所有状态为 PROCESSING 或 PENDING，且已经超过 30 分钟没更新的订单
        // 每次最多处理 50 个，防止堆积过多导致 API 超时 (504)
        // Cron 每 15 分钟执行一次，积压订单会像蚂蚁搬家一样被分批安全消化
        const BATCH_LIMIT = 50
        const timeoutThreshold = new Date(Date.now() - 20 * 60 * 1000);

        const zombieTasks = await prisma.generation.findMany({
            where: {
                status: { in: ["PENDING", "PROCESSING"] },
                createdAt: { lt: timeoutThreshold },
            },
            take: BATCH_LIMIT,
            orderBy: { createdAt: "asc" }, // 优先处理最久的僵尸订单
        });

        console.log(`[CRON SWEEP] 🔍 发现 ${zombieTasks.length} 个僵尸订单 (本批上限: ${BATCH_LIMIT})`);

        if (zombieTasks.length === 0) {
            return NextResponse.json({ message: "暂无超时僵尸订单" });
        }

        let recoveredCount = 0;
        let refundedAmount = 0;

        // 3. 遍历僵尸订单，执行退款和状态更新
        for (const task of zombieTasks) {
            // 计算需要退还的金额 (如果已经是部分成功，这里逻辑可以根据实际情况调整，
            // 但既然一直卡在 PROCESSING，说明彻底没回调，全额退款)
            const refundAmount = task.totalCost;

            await prisma.$transaction(async (tx) => {
                // 将订单状态强制标记为失败
                await tx.generation.update({
                    where: { id: task.id },
                    data: {
                        status: "FAILED",
                        generatedImage: "ERROR: Timeout", // 标记超时
                    },
                });

                // 调用通用退款服务
                if (refundAmount > 0 && task.userId) {
                    await refundCredits(
                        tx,
                        task.userId,
                        refundAmount,
                        `订单处理超时，系统自动拦截并全额退还 (${task.imageCount}张)`
                    );
                }
            });

            recoveredCount++;
            refundedAmount += refundAmount;
        }

        console.log(`[CRON SWEEP] 🧹 本批处理完成：清理 ${recoveredCount}/${zombieTasks.length} 个僵尸订单，共退还 ${refundedAmount} 积分`);

        return NextResponse.json({
            success: true,
            recoveredCount,
            refundedAmount,
        });

    } catch (error: any) {
        console.error("[CRON SWEEP] ❌ 清理任务执行失败:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}