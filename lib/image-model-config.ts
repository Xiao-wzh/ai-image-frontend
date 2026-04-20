import { unstable_cache } from "next/cache"
import prisma from "@/lib/prisma"
import type { ImageModelConfig, ImageModelsConfig } from "@/lib/types/config"

/** 默认模型配置（数据库无记录时的 fallback） */
const DEFAULT_MODELS: ImageModelsConfig = {
    models: [{
        id: "nano-banana-pro",
        name: "Banana Pro",
        n8nModelId: "gemini-3.1-flash-image-preview",
        description: "默认模型",
        isActive: true,
        isDefault: true,
        costMultiplier: 1.0,
        supportedModes: ["STANDARD", "PRO"],
        supportedTaskTypes: ["MAIN_IMAGE", "DETAIL_PAGE"],
    }],
}

const CONFIG_KEY = "IMAGE_MODELS"

/** 从数据库读取模型配置 */
async function fetchImageModelsFromDB(): Promise<ImageModelsConfig> {
    const row = await prisma.systemConfig.findUnique({
        where: { key: CONFIG_KEY },
    })

    if (!row) return DEFAULT_MODELS

    try {
        const parsed = JSON.parse(row.value) as ImageModelsConfig
        if (parsed.models && Array.isArray(parsed.models) && parsed.models.length > 0) {
            return parsed
        }
    } catch {
        // JSON 解析失败，使用默认
    }

    return DEFAULT_MODELS
}

/** 带缓存的获取模型配置 */
export const getImageModels = unstable_cache(
    fetchImageModelsFromDB,
    ["image-models"],
    {
        tags: ["image-models"],
        revalidate: 60,
    }
)

/** 获取默认模型 */
export async function getDefaultModel(): Promise<ImageModelConfig> {
    const config = await getImageModels()
    return config.models.find((m) => m.isDefault && m.isActive) || config.models.find((m) => m.isActive) || DEFAULT_MODELS.models[0]
}

/** 按条件筛选可用模型 */
export async function getAvailableModels(
    qualityMode?: "STANDARD" | "PRO",
    taskType?: "MAIN_IMAGE" | "DETAIL_PAGE",
): Promise<ImageModelConfig[]> {
    const config = await getImageModels()
    return config.models.filter((m) => {
        if (!m.isActive) return false
        if (qualityMode && !m.supportedModes.includes(qualityMode)) return false
        if (taskType && !m.supportedTaskTypes.includes(taskType)) return false
        return true
    })
}

/** 按 ID 查找模型 */
export async function getModelById(modelId: string): Promise<ImageModelConfig | null> {
    const config = await getImageModels()
    return config.models.find((m) => m.id === modelId) || null
}

/** 管理员更新模型配置（同时清缓存） */
export async function updateImageModels(config: ImageModelsConfig): Promise<void> {
    await prisma.systemConfig.upsert({
        where: { key: CONFIG_KEY },
        create: {
            key: CONFIG_KEY,
            value: JSON.stringify(config),
            description: "图片生成模型配置",
        },
        update: {
            value: JSON.stringify(config),
        },
    })

    // 清除缓存
    try {
        const { revalidateTag } = require("next/cache")
        revalidateTag("image-models")
    } catch {
        // 非 server context 时忽略
    }
}
