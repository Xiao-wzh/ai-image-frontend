// ==================== 站点配置 ====================

// 站点基础 URL（用于生成邀请链接等）
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://120.48.75.102"

// 商品类型常量与映射 - 所有新增类型仅需在此维护
// 1. 数据库存储 / API 传输用英文 KEY
export const ProductType = {
  MENSWEAR: "MENSWEAR",
  BEDDING: "BEDDING",
  SEXY_SPECIES: "SEXY_SPECIES",
} as const

export type ProductTypeKey = (typeof ProductType)[keyof typeof ProductType]

// 2. 前端下拉展示用中文
export const ProductTypeLabel: Record<ProductTypeKey, string> = {
  [ProductType.MENSWEAR]: "男装",
  [ProductType.BEDDING]: "寝具",
  [ProductType.SEXY_SPECIES]: "Sexyspecies",
}

// 3. 发送给 n8n / Prompt 查表时使用的中文关键字
export const ProductTypePromptKey: Record<ProductTypeKey, string> = {
  [ProductType.MENSWEAR]: "MENSWEAR",
  [ProductType.BEDDING]: "BEDDING",
  [ProductType.SEXY_SPECIES]: "SEXY_SPECIES",
}

// 平台类型（用于 Prompt 选择）
export const PlatformType = {
  SHOPEE: "SHOPEE",
  AMAZON: "AMAZON",
  TIKTOK: "TIKTOK",
  GENERAL: "GENERAL",
} as const

export type PlatformTypeKey = (typeof PlatformType)[keyof typeof PlatformType]

export const PlatformLabel: Record<PlatformTypeKey, string> = {
  [PlatformType.SHOPEE]: "虾皮",
  [PlatformType.AMAZON]: "亚马逊",
  [PlatformType.TIKTOK]: "TikTok",
  [PlatformType.GENERAL]: "通用",
}

// 每日打卡奖励积分数
export const DAILY_CHECKIN_REWARD = 200

// ==================== 注册与邀请奖励配置 ====================

// 新用户注册默认赠送积分
export const REGISTRATION_BONUS = 600

// 使用邀请码注册额外奖励积分（给被邀请人）
export const INVITE_CODE_BONUS = 200

// 推广返佣比例（邀请人获得被邀请人充值金额的百分比）
export const REFERRAL_COMMISSION_RATE = 0.1 // 10%

// ==================== 水印功能配置 ====================

// 解锁水印功能所需积分（每次生成后解锁该批图片）
export const WATERMARK_UNLOCK_COST = 100

// 添加水印功能消耗积分
export const WATERMARK_ADD_COST = 0

// 去除水印功能消耗积分
export const WATERMARK_REMOVE_COST = 100

// ==================== 积分消耗配置 ====================

// --- 主图生成 ---
// 主图生成标准消耗
export const MAIN_IMAGE_STANDARD_COST = 1991

// 主图重试消耗（折扣价）
export const MAIN_IMAGE_RETRY_COST = 99

// --- 详情页生成 ---
// 详情页生成标准消耗
export const DETAIL_PAGE_STANDARD_COST = 1991

// 详情页重试消耗（折扣价）
export const DETAIL_PAGE_RETRY_COST = 99

// --- 图片编辑 ---
// 图片编辑（重绘）消耗
export const IMAGE_EDIT_COST = 30

// --- 兼容旧代码的别名 ---
// @deprecated 使用 MAIN_IMAGE_STANDARD_COST 或 DETAIL_PAGE_STANDARD_COST
export const GENERATION_STANDARD_COST = MAIN_IMAGE_STANDARD_COST

// @deprecated 使用 MAIN_IMAGE_RETRY_COST 或 DETAIL_PAGE_RETRY_COST
export const GENERATION_RETRY_COST = MAIN_IMAGE_RETRY_COST

// ==================== 输出语言配置 ====================

// 生成图片中文字的语言选项
export const GENERATION_LANGUAGES = [
  { label: "简体中文", value: "Chinese" },
  { label: "繁体中文", value: "TraditionalChinese" },
  { label: "俄文", value: "Russian" },
  { label: "英文", value: "English" },
  { label: "日文", value: "Japanese" },
  { label: "韩文", value: "Korean" },
  { label: "泰文", value: "Thai" },
  { label: "越南文", value: "Vietnamese" },
] as const

// 传递给N8N的是label（中文名称）
export type GenerationLanguage = (typeof GENERATION_LANGUAGES)[number]["label"]
export const DEFAULT_OUTPUT_LANGUAGE: GenerationLanguage = "简体中文"

