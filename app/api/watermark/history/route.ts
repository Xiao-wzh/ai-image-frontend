import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { keyToCdnUrl } from "@/lib/cdnUrl"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    try {
        // 认证用户
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "请先登录" },
                { status: 401 }
            )
        }

        // 获取用户的任务，按创建时间倒序，限制50条
        const tasks = await prisma.watermarkTask.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
                id: true,
                originalUrl: true,
                resultUrl: true,
                status: true,
                errorMsg: true,
                createdAt: true,
                updatedAt: true
            }
        })

        // Transform keys to CDN URLs
        const transformedTasks = tasks.map(task => ({
            ...task,
            originalUrl: keyToCdnUrl(task.originalUrl),
            resultUrl: task.resultUrl ? keyToCdnUrl(task.resultUrl) : null,
        }))

        return NextResponse.json({
            success: true,
            tasks: transformedTasks
        })

    } catch (error: unknown) {
        console.error("[去水印历史] 错误:", error)
        const message = error instanceof Error ? error.message : "获取历史记录失败"
        return NextResponse.json(
            { error: message },
            { status: 500 }
        )
    }
}
