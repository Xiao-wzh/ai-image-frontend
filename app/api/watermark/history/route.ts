import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { triggerQueue } from "@/lib/watermark-queue"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    try {
        // Authenticate user
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "请先登录" },
                { status: 401 }
            )
        }

        // Fetch user's tasks ordered by createdAt desc, limit 50
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

        // Trigger queue processor to ensure background processing continues
        triggerQueue()

        return NextResponse.json({
            success: true,
            tasks
        })

    } catch (error: unknown) {
        console.error("[Watermark History] Error:", error)
        const message = error instanceof Error ? error.message : "获取历史记录失败"
        return NextResponse.json(
            { error: message },
            { status: 500 }
        )
    }
}
