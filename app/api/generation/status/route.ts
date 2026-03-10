import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { transformGenerationUrls } from "@/lib/cdnUrl"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/generation/status?id=xxx
 * PRO 模式轮询接口：前端每 5 秒查询一次任务状态
 * 只返回当前用户自己的记录，防止越权查询
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id || null
    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")?.trim()
    if (!id) {
        return NextResponse.json({ error: "缺少 id 参数" }, { status: 400 })
    }

    const generation = await prisma.generation.findUnique({
        where: { id },
        select: {
            id: true,
            userId: true,
            status: true,
            qualityMode: true,
            imageCount: true,
            generatedImages: true,
            generatedImage: true,
            refundAmount: true,
            costPerImage: true,
            totalCost: true,
        },
    })

    if (!generation) {
        return NextResponse.json({ error: "记录不存在" }, { status: 404 })
    }

    // 鉴权：只允许查询自己的记录
    if (generation.userId !== userId) {
        return NextResponse.json({ error: "无权查询" }, { status: 403 })
    }

    // 将对象键转换为 CDN URL
    const transformed = transformGenerationUrls(generation as any)

    return NextResponse.json({
        id: transformed.id,
        status: transformed.status,
        qualityMode: transformed.qualityMode,
        imageCount: transformed.imageCount,
        generatedImages: transformed.generatedImages || [],
        generatedImage: transformed.generatedImage || null,
        refundAmount: transformed.refundAmount || 0,
    })
}
