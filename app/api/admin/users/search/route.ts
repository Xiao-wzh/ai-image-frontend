import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    try {
        // 验证管理员权限
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "未登录" }, { status: 401 })
        }
        if (session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "无权限" }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const q = searchParams.get("q")?.trim() || ""

        let users

        if (!q) {
            // 无搜索词时返回最近10个用户
            users = await prisma.user.findMany({
                orderBy: { createdAt: "desc" },
                take: 10,
                select: {
                    id: true,
                    name: true,
                    username: true,
                    email: true,
                    image: true,
                },
            })
        } else {
            // 搜索用户名/邮箱/昵称
            users = await prisma.user.findMany({
                where: {
                    OR: [
                        { email: { contains: q, mode: "insensitive" } },
                        { username: { contains: q, mode: "insensitive" } },
                        { name: { contains: q, mode: "insensitive" } },
                    ],
                },
                orderBy: { createdAt: "desc" },
                take: 20,
                select: {
                    id: true,
                    name: true,
                    username: true,
                    email: true,
                    image: true,
                },
            })
        }

        return NextResponse.json(users)
    } catch (error) {
        console.error("用户搜索失败:", error)
        return NextResponse.json({ error: "搜索失败" }, { status: 500 })
    }
}
