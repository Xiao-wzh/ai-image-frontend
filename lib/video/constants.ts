/**
 * 视频功能共享常量
 */

/** 任务终态（不再轮询） */
export const TERMINAL_STATUSES = ["COMPLETED", "FAILED"] as const

/** 视频过期时间（毫秒），约 24 小时 */
export const VIDEO_EXPIRE_MS = 24 * 60 * 60 * 1000

/** 过期预警阈值（超过 70% 时间开始提醒） */
export const VIDEO_EXPIRE_WARNING_RATIO = 0.7

/** 云雾 API 基础地址 */
export const YUNWU_BASE_URL = "https://yunwu.ai/v1"

/** 允许上传的参考图 MIME 类型 */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

/** 参考图最大文件大小（字节），4MB */
export const MAX_REFERENCE_IMAGE_SIZE = 4 * 1024 * 1024
