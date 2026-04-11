import prisma from "@/lib/prisma"
import { refundCredits } from "@/lib/credit-service"
import { YUNWU_BASE_URL } from "@/lib/video/constants"

/**
 * 同步视频任务状态：查询云雾 API，更新数据库
 *
 * 用于 `[id]/route.ts` 的单任务查询 和 `pending-count` 的全局轮询
 *
 * @returns 更新后的 status（COMPLETED / FAILED / PROCESSING / PENDING），失败时返回 null
 */
export async function syncVideoTaskStatus(taskId: string): Promise<string | null> {
    const videoGen = await prisma.videoGeneration.findUnique({
        where: { id: taskId },
        select: {
            id: true,
            taskId: true,
            status: true,
            userId: true,
            cost: true,
            hasRefunded: true,
        },
    })
    if (!videoGen?.taskId || videoGen.taskId.startsWith("pending_")) return null

    const apiKey = process.env.YUNWU_API_KEY
    if (!apiKey) return null

    try {
        const res = await fetch(`${YUNWU_BASE_URL}/videos/${videoGen.taskId}`, {
            headers: { "Authorization": `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(8000),
        })
        const data = await res.json()
        const remoteStatus = (data.status || "").toUpperCase()

        if (remoteStatus === "COMPLETED" && data.video_url) {
            await prisma.videoGeneration.update({
                where: { id: taskId },
                data: {
                    status: "COMPLETED",
                    videoUrl: data.video_url,
                    progress: 100,
                    completedAt: new Date(),
                },
            })
            return "COMPLETED"
        }

        if (remoteStatus === "FAILED") {
            const errorMsg = data.error || "云雾 API 返回失败"
            await prisma.$transaction(async (tx) => {
                // 事务内重新读取，加行锁防止并发双重退款
                const locked = await tx.videoGeneration.findUnique({
                    where: { id: taskId },
                    select: { hasRefunded: true, cost: true, userId: true },
                })
                if (!locked) return
                if (!locked.hasRefunded && locked.cost > 0) {
                    await refundCredits(tx, locked.userId, locked.cost, "Sora-2 视频生成失败退款")
                }
                await tx.videoGeneration.update({
                    where: { id: taskId },
                    data: { status: "FAILED", errorMsg, hasRefunded: true },
                })
            })
            return "FAILED"
        }

        if (remoteStatus === "PROCESSING") {
            await prisma.videoGeneration.update({
                where: { id: taskId },
                data: { status: "PROCESSING", progress: 50 },
            })
            return "PROCESSING"
        }

        if (remoteStatus === "PENDING") {
            await prisma.videoGeneration.update({
                where: { id: taskId },
                data: { status: "PENDING" },
            })
            return "PENDING"
        }

        return null
    } catch {
        return null
    }
}
