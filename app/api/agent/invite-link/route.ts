import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { signInviteLink } from "@/lib/invite-link"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/agent/invite-link
 * 生成带签名的邀请链接
 * 
 * Query params:
 *   type: "user" | "agent" (默认 user)
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    try {
        // 获取用户的邀请码和等级
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { referralCode: true, agentLevel: true },
        })

        if (!user || !user.referralCode) {
            return NextResponse.json({ error: "未找到邀请码" }, { status: 404 })
        }

        const type = req.nextUrl.searchParams.get("type") === "agent" ? "agent" : "user"

        // 只有 L1/L2 才能生成招募代理链接
        if (type === "agent" && user.agentLevel > 2) {
            return NextResponse.json({ error: "只有 L1/L2 才能招募代理" }, { status: 403 })
        }

        // 生成签名
        const sig = signInviteLink(user.referralCode, type)

        // 返回完整的链接参数
        const params = type === "agent"
            ? `inviteCode=${user.referralCode}&type=agent&sig=${sig}`
            : `inviteCode=${user.referralCode}&sig=${sig}`

        return NextResponse.json({
            success: true,
            inviteCode: user.referralCode,
            type,
            sig,
            params,
        })
    } catch (e: any) {
        console.error("❌ 生成邀请链接失败:", e)
        return NextResponse.json({ error: "生成邀请链接失败" }, { status: 500 })
    }
}
