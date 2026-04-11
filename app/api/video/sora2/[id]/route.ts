import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { syncVideoTaskStatus } from "@/lib/video/sync-status"
import { TERMINAL_STATUSES } from "@/lib/video/constants"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/video/sora2/[id]
 *
 * 查询单个视频任务状态（代理查询云雾 API）
 * 参数：force=1 强制刷新（即使终态也重新查询）
 */

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "未登录" }, { status: 401 })
        }

        const { id } = await params
        if (!id) {
            return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 })
        }

        const forceRefresh = req.nextUrl.searchParams.get("force") === "1"

        const videoGen = await prisma.videoGeneration.findFirst({
            where: { id, userId: session.user.id }
        })

        if (!videoGen) {
            return NextResponse.json({ error: "任务不存在" }, { status: 404 })
        }

        // 非终态或 force=1 → 同步云雾 API 状态
        const isTerminal = (TERMINAL_STATUSES as readonly string[]).includes(videoGen.status)
        if ((!isTerminal || forceRefresh)) {
            await syncVideoTaskStatus(id)
        }

        // 重新查询更新后的数据
        const updated = await prisma.videoGeneration.findFirst({
            where: { id, userId: session.user.id }
        })

        if (!updated) {
            return NextResponse.json({ error: "任务不存在" }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            data: {
                id: updated.id,
                taskId: updated.taskId,
                status: updated.status.toLowerCase(),
                progress: updated.progress,
                videoUrl: updated.videoUrl,
                prompt: updated.prompt,
                seconds: updated.seconds,
                size: updated.size,
                model: updated.model,
                cost: updated.cost,
                errorMsg: updated.errorMsg,
                hasRefunded: updated.hasRefunded,
                refreshable: !(TERMINAL_STATUSES as readonly string[]).includes(updated.status),
                message: updated.status === "COMPLETED" ? "视频生成完成" :
                         updated.status === "FAILED" ? updated.errorMsg || "视频生成失败" :
                         updated.status === "PROCESSING" ? "正在生成..." : "等待处理",
            }
        })
    } catch (err: any) {
        console.error("[SORA2] 查询任务错误:", err)
        return NextResponse.json(
            { error: err?.message || "服务器错误" },
            { status: 500 }
        )
    }
}
