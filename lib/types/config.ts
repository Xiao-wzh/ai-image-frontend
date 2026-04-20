/**
 * Type definitions for system configuration
 * Defines the expected keys for credit costs to ensure TypeScript safety
 */

export type SystemCostConfig = {
    // 水印功能
    WATERMARK_UNLOCK_COST: number
    WATERMARK_ADD_COST: number
    WATERMARK_REMOVE_COST: number

    // 主图生成
    MAIN_IMAGE_STANDARD_COST: number
    MAIN_IMAGE_RETRY_COST: number

    // 详情页生成
    DETAIL_PAGE_STANDARD_COST: number
    DETAIL_PAGE_RETRY_COST: number

    // 图片编辑
    IMAGE_EDIT_COST: number

    // 智能文案
    COPYWRITING_COST: number

    // PRO 模式
    PRO_COST_PER_IMAGE: number

    // 视频生成
    VIDEO_SORA2_COST_PER_SECOND: number   // Sora-2 每秒积分，默认 50
}

// All cost config keys
export type SystemCostKey = keyof SystemCostConfig

// List of all cost keys (for iteration)
export const SYSTEM_COST_KEYS: SystemCostKey[] = [
    "WATERMARK_UNLOCK_COST",
    "WATERMARK_ADD_COST",
    "WATERMARK_REMOVE_COST",
    "MAIN_IMAGE_STANDARD_COST",
    "MAIN_IMAGE_RETRY_COST",
    "DETAIL_PAGE_STANDARD_COST",
    "DETAIL_PAGE_RETRY_COST",
    "IMAGE_EDIT_COST",
    "COPYWRITING_COST",
    "PRO_COST_PER_IMAGE",
    "VIDEO_SORA2_COST_PER_SECOND",
]

// Descriptions for admin UI
export const SYSTEM_COST_DESCRIPTIONS: Record<SystemCostKey, string> = {
    WATERMARK_UNLOCK_COST: "解锁水印功能消耗积分",
    WATERMARK_ADD_COST: "添加水印功能消耗积分",
    WATERMARK_REMOVE_COST: "去除水印功能消耗积分",
    MAIN_IMAGE_STANDARD_COST: "主图生成标准消耗积分",
    MAIN_IMAGE_RETRY_COST: "主图重试消耗积分（折扣价）",
    DETAIL_PAGE_STANDARD_COST: "详情页生成标准消耗积分",
    DETAIL_PAGE_RETRY_COST: "详情页重试消耗积分（折扣价）",
    IMAGE_EDIT_COST: "图片编辑（重绘）消耗积分",
    COPYWRITING_COST: "智能文案生成消耗积分",
    PRO_COST_PER_IMAGE: "PRO模式每张图消耗积分",
    VIDEO_SORA2_COST_PER_SECOND: "Sora-2 视频每秒积分（默认50）",
}

// ── 模型配置类型 ──

export type ImageModelConfig = {
    id: string              // 内部标识，如 "nano-banana-pro"（DB 存储、前端传递用）
    name: string            // 用户可见显示名，如 "Banana Pro"
    n8nModelId: string      // 传给 n8n 的实际模型 ID，如 "gemini-3.1-flash-image-preview"
    description: string     // 模型说明
    isActive: boolean       // 是否启用
    isDefault: boolean      // 是否默认模型
    costMultiplier: number  // 费用乘数，1.0 = 原价
    supportedModes: ("STANDARD" | "PRO")[]
    supportedTaskTypes: ("MAIN_IMAGE" | "DETAIL_PAGE")[]
}

export type ImageModelsConfig = {
    models: ImageModelConfig[]
}
