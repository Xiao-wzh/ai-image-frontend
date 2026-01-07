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

// 解锁水印功能所需积分
export const WATERMARK_UNLOCK_COST = 100
