import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET: List user's watermark templates
export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "请先登录" }, { status: 401 })
        }

        const templates = await prisma.watermarkTemplate.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({ success: true, templates })
    } catch (error) {
        console.error("获取水印模板失败:", error)
        return NextResponse.json({ error: "获取失败" }, { status: 500 })
    }
}

// POST: Create new template
export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "请先登录" }, { status: 401 })
        }

        const body = await req.json()
        const {
            name,
            type,
            content,
            opacity = 100,
            rotate = 0,
            scale = 100,
            position = "se",
            xOffset = 10,
            yOffset = 10,
            isTiled = false,
            fontSize,
            fontColor,
            fontName,
        } = body

        // Validation
        if (!name?.trim()) {
            return NextResponse.json({ error: "请输入模板名称" }, { status: 400 })
        }
        if (!type || !["IMAGE", "TEXT"].includes(type)) {
            return NextResponse.json({ error: "无效的水印类型" }, { status: 400 })
        }
        if (!content?.trim()) {
            return NextResponse.json({ error: "请输入水印内容" }, { status: 400 })
        }

        // Validate position
        const validPositions = ["nw", "north", "ne", "west", "center", "east", "sw", "south", "se"]
        if (!validPositions.includes(position)) {
            return NextResponse.json({ error: "无效的位置" }, { status: 400 })
        }

        // Limit templates per user
        const count = await prisma.watermarkTemplate.count({
            where: { userId: session.user.id },
        })
        if (count >= 10) {
            return NextResponse.json({ error: "最多只能创建 10 个水印模板" }, { status: 400 })
        }

        const template = await prisma.watermarkTemplate.create({
            data: {
                userId: session.user.id,
                name: name.trim(),
                type,
                content: content.trim(),
                opacity: Math.max(0, Math.min(100, opacity)),
                rotate: Math.max(0, Math.min(360, rotate)),
                scale: Math.max(1, Math.min(100, scale)),
                position,
                xOffset: Math.max(0, Math.min(500, xOffset)),
                yOffset: Math.max(0, Math.min(500, yOffset)),
                isTiled: Boolean(isTiled),
                fontSize: type === "TEXT" ? (fontSize || 24) : null,
                fontColor: type === "TEXT" ? (fontColor || "#FFFFFF") : null,
                fontName: type === "TEXT" ? (fontName || "wqy-zenhei") : null,
            },
        })

        return NextResponse.json({ success: true, template })
    } catch (error) {
        console.error("创建水印模板失败:", error)
        return NextResponse.json({ error: "创建失败" }, { status: 500 })
    }
}

// DELETE: Delete template
export async function DELETE(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "请先登录" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const id = searchParams.get("id")

        if (!id) {
            return NextResponse.json({ error: "缺少模板 ID" }, { status: 400 })
        }

        // Verify ownership
        const template = await prisma.watermarkTemplate.findUnique({
            where: { id },
        })

        if (!template) {
            return NextResponse.json({ error: "模板不存在" }, { status: 404 })
        }

        if (template.userId !== session.user.id) {
            return NextResponse.json({ error: "无权删除此模板" }, { status: 403 })
        }

        await prisma.watermarkTemplate.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("删除水印模板失败:", error)
        return NextResponse.json({ error: "删除失败" }, { status: 500 })
    }
}

// PUT: Update template
export async function PUT(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "请先登录" }, { status: 401 })
        }

        const body = await req.json()
        const { id, ...updates } = body

        if (!id) {
            return NextResponse.json({ error: "缺少模板 ID" }, { status: 400 })
        }

        // Verify ownership
        const template = await prisma.watermarkTemplate.findUnique({
            where: { id },
        })

        if (!template) {
            return NextResponse.json({ error: "模板不存在" }, { status: 404 })
        }

        if (template.userId !== session.user.id) {
            return NextResponse.json({ error: "无权修改此模板" }, { status: 403 })
        }

        // Build update data
        const updateData: Record<string, unknown> = {}
        if (updates.name?.trim()) updateData.name = updates.name.trim()
        if (updates.type && ["IMAGE", "TEXT"].includes(updates.type)) updateData.type = updates.type
        if (updates.content?.trim()) updateData.content = updates.content.trim()
        if (typeof updates.opacity === "number") updateData.opacity = Math.max(0, Math.min(100, updates.opacity))
        if (typeof updates.rotate === "number") updateData.rotate = Math.max(0, Math.min(360, updates.rotate))
        if (typeof updates.scale === "number") updateData.scale = Math.max(1, Math.min(100, updates.scale))
        if (updates.position) updateData.position = updates.position
        if (typeof updates.xOffset === "number") updateData.xOffset = Math.max(0, Math.min(500, updates.xOffset))
        if (typeof updates.yOffset === "number") updateData.yOffset = Math.max(0, Math.min(500, updates.yOffset))
        if (typeof updates.isTiled === "boolean") updateData.isTiled = updates.isTiled
        if (typeof updates.fontSize === "number") updateData.fontSize = updates.fontSize
        if (updates.fontColor) updateData.fontColor = updates.fontColor
        if (updates.fontName) updateData.fontName = updates.fontName

        const updated = await prisma.watermarkTemplate.update({
            where: { id },
            data: updateData,
        })

        return NextResponse.json({ success: true, template: updated })
    } catch (error) {
        console.error("更新水印模板失败:", error)
        return NextResponse.json({ error: "更新失败" }, { status: 500 })
    }
}
