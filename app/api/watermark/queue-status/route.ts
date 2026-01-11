import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * 获取队列状态（排队人数）
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "请先登录" },
                { status: 401 }
            )
        }

        // 统计所有 PENDING 和 PROCESSING 任务数
        const [pendingCount, processingCount] = await Promise.all([
            prisma.watermarkTask.count({
                where: { status: "PENDING" }
            }),
            prisma.watermarkTask.count({
                where: { status: "PROCESSING" }
            })
        ])

        // 查找当前用户最早的待处理任务
        const userEarliestTask = await prisma.watermarkTask.findFirst({
            where: {
                userId: session.user.id,
                status: { in: ["PENDING", "PROCESSING"] }
            },
            orderBy: { createdAt: "asc" },
            select: { id: true, createdAt: true, status: true }
        })

        let queuePosition = 0
        if (userEarliestTask && userEarliestTask.status === "PENDING") {
            // 计算在用户任务之前的 PENDING 任务数
            queuePosition = await prisma.watermarkTask.count({
                where: {
                    status: "PENDING",
                    createdAt: { lt: userEarliestTask.createdAt }
                }
            })
        }

        return NextResponse.json({
            success: true,
            pendingCount,      // 总待处理数
            processingCount,   // 正在处理数
            queuePosition,     // 当前用户排队位置（前面有多少个）
            totalWaiting: pendingCount + processingCount
        })

    } catch (error: unknown) {
        console.error("[队列状态] 错误:", error)
        return NextResponse.json(
            { error: "获取队列状态失败" },
            { status: 500 }
        )
    }
}
