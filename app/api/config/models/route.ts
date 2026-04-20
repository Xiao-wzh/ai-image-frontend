import { NextRequest, NextResponse } from "next/server"
import { getAvailableModels } from "@/lib/image-model-config"

export const dynamic = "force-dynamic"

/**
 * GET /api/config/models
 * 返回当前可用的模型列表（公开接口）
 * Query: qualityMode, taskType
 */
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const qualityMode = searchParams.get("qualityMode") as "STANDARD" | "PRO" | null
    const taskType = searchParams.get("taskType") as "MAIN_IMAGE" | "DETAIL_PAGE" | null

    try {
        const models = await getAvailableModels(
            qualityMode || undefined,
            taskType || undefined,
        )
        return NextResponse.json({ models })
    } catch (error) {
        console.error("[MODELS_API] 获取模型列表失败:", error)
        return NextResponse.json({ models: [] }, { status: 500 })
    }
}
