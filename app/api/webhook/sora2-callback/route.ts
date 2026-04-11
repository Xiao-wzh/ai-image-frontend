import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { refundCredits } from "@/lib/credit-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/webhook/sora2-callback
 *
 * N8N 回调接口 - 接收视频生成结果
 *
 * 请求体格式：
 * {
 *   videoGenerationId: string,  // VideoGeneration 记录 ID
 *   taskId: string,             // 云雾 API 任务 ID
 *   status: "COMPLETED" | "FAILED",
 *   videoUrl?: string,          // 生成的视频 URL（完成时）
 *   progress?: number,          // 进度 0-100
 *   errorMsg?: string           // 错误信息（失败时）
 * }
 */

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { videoGenerationId, taskId, status, videoUrl, progress, errorMsg } = body

        console.log("[SORA2回调] 收到回调:", { videoGenerationId, taskId, status, progress })

        if (!videoGenerationId) {
            console.error("[SORA2回调] 缺少 videoGenerationId")
            return NextResponse.json({ error: "缺少 videoGenerationId" }, { status: 400 })
        }

        // 查询视频生成记录
        const videoGen = await prisma.videoGeneration.findUnique({
            where: { id: videoGenerationId }
        })

        if (!videoGen) {
            console.error(`[SORA2回调] VideoGeneration 不存在: ${videoGenerationId}`)
            return NextResponse.json({ error: "VideoGeneration not found" }, { status: 404 })
        }

        // 幂等检查：如果已经是终态，跳过
        const terminalStatuses = ["COMPLETED", "FAILED"]
        if (terminalStatuses.includes(videoGen.status)) {
            console.log(`[SORA2回调] 任务 ${videoGenerationId} 已是终态(${videoGen.status})，跳过`)
            return NextResponse.json({ success: true, skipped: true })
        }

        // 失败 → 退款 + 更新状态
        if (status === "FAILED") {
            const reason = errorMsg || "视频生成失败"
            await prisma.$transaction(async (tx) => {
                if (!videoGen.hasRefunded && videoGen.cost > 0) {
                    await refundCredits(tx, videoGen.userId, videoGen.cost, "Sora-2 视频生成失败退款")
                }
                await tx.videoGeneration.update({
                    where: { id: videoGenerationId },
                    data: {
                        status: "FAILED",
                        errorMsg: reason,
                        hasRefunded: true,
                        ...(taskId ? { taskId } : {}),
                    },
                })
            })
            console.log(`[SORA2回调] 任务 ${videoGenerationId} 失败，已退款 ${videoGen.cost} 积分`)
            return NextResponse.json({ success: true })
        }

        // 成功或其他状态更新
        const updateData: any = {
            status,
            progress: progress ?? (status === "COMPLETED" ? 100 : videoGen.progress),
        }

        if (taskId) {
            updateData.taskId = taskId
        }

        if (status === "COMPLETED" && videoUrl) {
            updateData.videoUrl = videoUrl
            updateData.completedAt = new Date()
        }

        if (status === "FAILED" && errorMsg) {
            updateData.errorMsg = errorMsg
        }

        await prisma.videoGeneration.update({
            where: { id: videoGenerationId },
            data: updateData
        })

        console.log(`[SORA2回调] 任务 ${videoGenerationId} 更新为 ${status}`)

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error("[SORA2回调] 处理错误:", err)
        return NextResponse.json(
            { error: err?.message || "服务器错误" },
            { status: 500 }
        )
    }
}
