import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET /api/announcements/active
 * 获取所有激活的公告（公开接口）
 */
export async function GET() {
    try {
        const announcements = await prisma.systemAnnouncement.findMany({
            where: { isActive: true },
            orderBy: [
                { type: "asc" }, // PINNED (alphabetically first) comes before NORMAL
                { sortOrder: "desc" },
                { createdAt: "desc" },
            ],
        })

        // Sort so PINNED comes first (since we can't easily do enum ordering in Prisma)
        const sorted = announcements.sort((a, b) => {
            if (a.type === "PINNED" && b.type !== "PINNED") return -1
            if (a.type !== "PINNED" && b.type === "PINNED") return 1
            // Same type, use sortOrder (desc) then createdAt (desc)
            if (b.sortOrder !== a.sortOrder) return b.sortOrder - a.sortOrder
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })

        return NextResponse.json({ success: true, announcements: sorted })
    } catch (error) {
        console.error("[Announcements Active GET]", error)
        return NextResponse.json({ error: "获取公告失败" }, { status: 500 })
    }
}
