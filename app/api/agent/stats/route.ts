import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getAgentStats } from "@/lib/agent-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/agent/stats
 * 获取当前用户的代理统计数据
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    try {
        const stats = await getAgentStats(userId)

        if (!stats) {
            return NextResponse.json({ error: "获取统计数据失败" }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            ...stats,
        })
    } catch (e: any) {
        console.error("❌ 获取代理统计失败:", e)
        return NextResponse.json({ error: "获取统计失败，请稍后重试" }, { status: 500 })
    }
}
