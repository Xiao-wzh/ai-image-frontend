import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { promoteToLevel2 } from "@/lib/agent-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/agent/promote
 * L1 代理升级下级为 L2 (运营中心)
 * 
 * Body: { targetUserId: string }
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    try {
        const body = await req.json().catch(() => null)
        const targetUserId = body?.targetUserId as string | undefined

        if (!targetUserId) {
            return NextResponse.json({ error: "请指定要升级的用户" }, { status: 400 })
        }

        const result = await promoteToLevel2(userId, targetUserId)

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            message: "升级成功，该用户已成为运营中心(L2)",
        })
    } catch (e: any) {
        console.error("❌ 升级代理失败:", e)
        return NextResponse.json({ error: "升级失败，请稍后重试" }, { status: 500 })
    }
}
