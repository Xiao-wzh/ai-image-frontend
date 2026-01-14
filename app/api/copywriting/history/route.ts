import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

/**
 * GET /api/copywriting/history
 * Get user's copywriting generation history
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id || null
    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)

        const limitRaw = Number(searchParams.get("limit") ?? DEFAULT_LIMIT)
        const offsetRaw = Number(searchParams.get("offset") ?? 0)

        const limit = Number.isFinite(limitRaw)
            ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
            : DEFAULT_LIMIT

        const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0

        const [items, total] = await Promise.all([
            prisma.copywriting.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    platform: true,
                    productName: true,
                    content: true,
                    cost: true,
                    createdAt: true,
                },
            }),
            prisma.copywriting.count({ where: { userId } }),
        ])

        return NextResponse.json({
            success: true,
            items,
            page: {
                limit,
                offset,
                total,
                hasMore: offset + items.length < total,
            },
        })
    } catch (err: any) {
        const message = err?.message || String(err)
        console.error("❌ copywriting history API 错误:", message)
        return NextResponse.json({ error: "获取历史记录失败", message }, { status: 500 })
    }
}
