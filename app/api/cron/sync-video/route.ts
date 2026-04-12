import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncVideoTaskStatus } from "@/lib/video/sync-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 由定时任务调用，同步超时的视频任务状态
export async function POST(req: NextRequest) {
    // 1. 鉴权
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 2. 查询创建超过 45 分钟仍在进行中的视频任务
        const BATCH_LIMIT = 20;
        const timeoutThreshold = new Date(Date.now() - 45 * 60 * 1000);

        const pendingTasks = await prisma.videoGeneration.findMany({
            where: {
                status: { in: ["PENDING", "PROCESSING"] },
                createdAt: { lt: timeoutThreshold },
            },
            take: BATCH_LIMIT,
            orderBy: { createdAt: "asc" },
        });

        console.log(`[CRON SYNC-VIDEO] 🔍 发现 ${pendingTasks.length} 个超时视频任务 (本批上限: ${BATCH_LIMIT})`);

        if (pendingTasks.length === 0) {
            return NextResponse.json({ message: "暂无超时视频任务" });
        }

        // 3. 并行同步
        const results = await Promise.allSettled(
            pendingTasks.map((task) => syncVideoTaskStatus(task.id))
        );

        // 4. 汇总
        let successCount = 0;
        let failCount = 0;
        const details: { id: string; status: string | null; error?: string }[] = [];

        results.forEach((result, i) => {
            const task = pendingTasks[i];
            if (result.status === "fulfilled") {
                successCount++;
                details.push({ id: task.id, status: result.value });
            } else {
                failCount++;
                details.push({ id: task.id, status: null, error: result.reason?.message });
            }
        });

        console.log(
            `[CRON SYNC-VIDEO] ✅ 同步完成：成功 ${successCount}/${pendingTasks.length}` +
            (failCount > 0 ? `，失败 ${failCount}` : "")
        );

        return NextResponse.json({
            success: true,
            total: pendingTasks.length,
            successCount,
            failCount,
            details,
        });
    } catch (error: any) {
        console.error("[CRON SYNC-VIDEO] ❌ 同步任务执行失败:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
