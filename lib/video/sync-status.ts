import prisma from "@/lib/prisma"
import { refundCredits } from "@/lib/credit-service"
import { YUNWU_BASE_URL } from "@/lib/video/constants"

/** 云雾 API 查询缓存，避免轮询风暴 */
const syncCache = new Map<string, { status: string | null; expireAt: number }>()

/** 同一任务最少间隔 15 秒再查云雾 */
const SYNC_CACHE_TTL = 15_000

/** 定期清理过期缓存，防止内存泄漏 */
setInterval(() => {
    const now = Date.now()
    for (const [key, val] of syncCache) {
        if (val.expireAt < now) syncCache.delete(key)
    }
}, 60_000)

/**
 * 同步视频任务状态：查询云雾 API，更新数据库
 *
 * 用于 `[id]/route.ts` 的单任务查询 和 `sync/route.ts` 的批量轮询
 * 内置 15 秒缓存，同一任务短时间内多次调用只查一次云雾
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

    // 终态任务直接返回，不再查云雾
    if (videoGen.status === "COMPLETED" || videoGen.status === "FAILED") {
        return videoGen.status
    }

    // 检查缓存：15 秒内不重复查云雾
    const cacheKey = videoGen.taskId
    const cached = syncCache.get(cacheKey)
    if (cached && cached.expireAt > Date.now()) {
        return cached.status ?? videoGen.status ?? null
    }

    const apiKey = process.env.YUNWU_API_KEY
    if (!apiKey) return null

    try {
        const res = await fetch(`${YUNWU_BASE_URL}/videos/${videoGen.taskId}`, {
            headers: { "Authorization": `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(8000),
        })
        const data = await res.json()
        const remoteStatus = (data.status || "").toUpperCase()

        // 云雾 API 返回 error 对象（如 server_error），视为失败
        if (data.error && !remoteStatus) {
            const errMsg = typeof data.error === "string"
                ? data.error
                : data.error.message || JSON.stringify(data.error)
            console.error(`[SYNC] 云雾 API 返回错误:`, errMsg)
            await prisma.$transaction(async (tx) => {
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
                    data: { status: "FAILED", errorMsg: errMsg, hasRefunded: true },
                })
            })
            // 终态不缓存（避免失败后无法重试）
            return "FAILED"
        }

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
            // data.error 可能是对象 {code, message}，需要序列化为字符串
            const errorMsg = typeof data.error === "string"
                ? data.error
                : data.error?.message || data.error?.code || JSON.stringify(data.error) || "云雾 API 返回失败"
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
        }

        if (remoteStatus === "PENDING") {
            await prisma.videoGeneration.update({
                where: { id: taskId },
                data: { status: "PENDING" },
            })
        }

        // 非终态写入缓存，15 秒内跳过云雾查询
        const result = remoteStatus || null
        syncCache.set(cacheKey, { status: result, expireAt: Date.now() + SYNC_CACHE_TTL })
        return result ?? videoGen.status ?? null
    } catch {
        return null
    }
}
