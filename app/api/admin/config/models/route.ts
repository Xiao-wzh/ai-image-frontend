import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getImageModels, updateImageModels } from "@/lib/image-model-config"
import type { ImageModelsConfig } from "@/lib/types/config"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/config/models
 * 获取完整模型配置（需 ADMIN）
 */
export async function GET() {
    const session = await auth()
    const role = (session?.user as any)?.role

    if (role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    try {
        const config = await getImageModels()
        return NextResponse.json(config)
    } catch (error) {
        console.error("[ADMIN_MODELS] 获取模型配置失败:", error)
        return NextResponse.json({ error: "获取模型配置失败" }, { status: 500 })
    }
}

/**
 * PUT /api/admin/config/models
 * 更新模型配置（需 ADMIN）
 * Body: ImageModelsConfig
 */
export async function PUT(req: NextRequest) {
    const session = await auth()
    const role = (session?.user as any)?.role

    if (role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    try {
        const body = await req.json() as ImageModelsConfig

        if (!body.models || !Array.isArray(body.models)) {
            return NextResponse.json({ error: "无效的模型配置格式" }, { status: 400 })
        }

        // 校验至少有一个激活的默认模型
        const hasDefault = body.models.some((m) => m.isDefault && m.isActive)
        if (!hasDefault) {
            return NextResponse.json({ error: "至少需要一个启用的默认模型" }, { status: 400 })
        }

        await updateImageModels(body)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[ADMIN_MODELS] 更新模型配置失败:", error)
        return NextResponse.json({ error: "更新模型配置失败" }, { status: 500 })
    }
}
