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
}
