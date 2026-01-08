import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/check-admin"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/announcements
 * 获取所有公告（管理员）
 */
export async function GET() {
    const guard = await requireAdmin()
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    try {
        const announcements = await prisma.systemAnnouncement.findMany({
            orderBy: [
                { sortOrder: "desc" },
                { createdAt: "desc" },
            ],
        })

        return NextResponse.json({ success: true, announcements })
    } catch (error) {
        console.error("[Admin Announcements GET]", error)
        return NextResponse.json({ error: "获取公告失败" }, { status: 500 })
    }
}

/**
 * POST /api/admin/announcements
 * 创建公告
 */
export async function POST(req: Request) {
    const guard = await requireAdmin()
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    try {
        const body = await req.json()
        const { title, content, type = "NORMAL", sortOrder = 0, isActive = true } = body

        if (!title?.trim()) {
            return NextResponse.json({ error: "标题不能为空" }, { status: 400 })
        }
        if (!content?.trim()) {
            return NextResponse.json({ error: "内容不能为空" }, { status: 400 })
        }
        if (!["PINNED", "NORMAL"].includes(type)) {
            return NextResponse.json({ error: "类型无效" }, { status: 400 })
        }

        const announcement = await prisma.systemAnnouncement.create({
            data: {
                title: title.trim(),
                content: content.trim(),
                type,
                sortOrder: Number(sortOrder) || 0,
                isActive: Boolean(isActive),
            },
        })

        return NextResponse.json({ success: true, announcement })
    } catch (error) {
        console.error("[Admin Announcements POST]", error)
        return NextResponse.json({ error: "创建公告失败" }, { status: 500 })
    }
}

/**
 * PUT /api/admin/announcements
 * 更新公告
 */
export async function PUT(req: Request) {
    const guard = await requireAdmin()
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    try {
        const body = await req.json()
        const { id, title, content, type, sortOrder, isActive } = body

        if (!id) {
            return NextResponse.json({ error: "缺少公告 ID" }, { status: 400 })
        }

        const existing = await prisma.systemAnnouncement.findUnique({ where: { id } })
        if (!existing) {
            return NextResponse.json({ error: "公告不存在" }, { status: 404 })
        }

        const updateData: Record<string, unknown> = {}

        if (title !== undefined) {
            if (!title?.trim()) {
                return NextResponse.json({ error: "标题不能为空" }, { status: 400 })
            }
            updateData.title = title.trim()
        }
        if (content !== undefined) {
            if (!content?.trim()) {
                return NextResponse.json({ error: "内容不能为空" }, { status: 400 })
            }
            updateData.content = content.trim()
        }
        if (type !== undefined) {
            if (!["PINNED", "NORMAL"].includes(type)) {
                return NextResponse.json({ error: "类型无效" }, { status: 400 })
            }
            updateData.type = type
        }
        if (sortOrder !== undefined) {
            updateData.sortOrder = Number(sortOrder) || 0
        }
        if (isActive !== undefined) {
            updateData.isActive = Boolean(isActive)
        }

        const announcement = await prisma.systemAnnouncement.update({
            where: { id },
            data: updateData,
        })

        return NextResponse.json({ success: true, announcement })
    } catch (error) {
        console.error("[Admin Announcements PUT]", error)
        return NextResponse.json({ error: "更新公告失败" }, { status: 500 })
    }
}

/**
 * DELETE /api/admin/announcements
 * 删除公告
 */
export async function DELETE(req: Request) {
    const guard = await requireAdmin()
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get("id")

        if (!id) {
            return NextResponse.json({ error: "缺少公告 ID" }, { status: 400 })
        }

        const existing = await prisma.systemAnnouncement.findUnique({ where: { id } })
        if (!existing) {
            return NextResponse.json({ error: "公告不存在" }, { status: 404 })
        }

        await prisma.systemAnnouncement.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[Admin Announcements DELETE]", error)
        return NextResponse.json({ error: "删除公告失败" }, { status: 500 })
    }
}
