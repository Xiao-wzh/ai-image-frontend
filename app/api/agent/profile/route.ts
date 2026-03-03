/**
 * Agent Profile API
 * GET - 获取当前用户的代理配置
 * PUT - 更新代理配置
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { AgentProfile } from "@/lib/types/agent"

// GET /api/agent/profile - 获取代理配置
export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "未登录" }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { agentLevel: true, agentProfile: true },
        })

        if (!user) {
            return NextResponse.json({ error: "用户不存在" }, { status: 404 })
        }

        if (user.agentLevel < 1) {
            return NextResponse.json({ error: "非代理用户无法访问" }, { status: 403 })
        }

        return NextResponse.json({
            profile: user.agentProfile || {},
        })
    } catch (error) {
        console.error("[AGENT_PROFILE_GET] Error:", error)
        return NextResponse.json({ error: "服务器错误" }, { status: 500 })
    }
}

// PUT /api/agent/profile - 更新代理配置
export async function PUT(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "未登录" }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { agentLevel: true },
        })

        if (!user) {
            return NextResponse.json({ error: "用户不存在" }, { status: 404 })
        }

        if (user.agentLevel < 1) {
            return NextResponse.json({ error: "非代理用户无法修改" }, { status: 403 })
        }

        const body = await request.json()
        const { siteName, welcomeMsg, contactQr } = body as Partial<AgentProfile>

        // 构建更新数据
        const profile: AgentProfile = {
            siteName: siteName?.trim() || undefined,
            welcomeMsg: welcomeMsg?.trim() || undefined,
            contactQr: contactQr?.trim() || undefined,
        }

        // 更新数据库
        await prisma.user.update({
            where: { id: session.user.id },
            data: { agentProfile: profile as any },
        })

        return NextResponse.json({
            success: true,
            profile,
        })
    } catch (error) {
        console.error("[AGENT_PROFILE_PUT] Error:", error)
        return NextResponse.json({ error: "服务器错误" }, { status: 500 })
    }
}
