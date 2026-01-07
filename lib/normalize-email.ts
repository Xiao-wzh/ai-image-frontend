/**
 * Email 归一化工具
 * 用于防止用户通过 Gmail 别名重复注册
 */

/**
 * 归一化邮箱地址
 * - Gmail/Googlemail: 去除点号、去除+tag、统一为 gmail.com
 * - QQ: 仅转小写
 * 
 * @example
 * normalizeEmail("A.B.C@Gmail.com")      -> "abc@gmail.com"
 * normalizeEmail("test+spam@gmail.com")  -> "test@gmail.com"
 * normalizeEmail("user@googlemail.com")  -> "user@gmail.com"
 * normalizeEmail("123456@QQ.com")        -> "123456@qq.com"
 */
export function normalizeEmail(email: string): string {
    const lower = email.trim().toLowerCase()
    const parts = lower.split("@")

    // 健壮性：非法邮箱格式直接返回小写
    if (parts.length !== 2) {
        return lower
    }

    const [local, domain] = parts

    // Gmail / Googlemail 归一化
    if (domain === "gmail.com" || domain === "googlemail.com") {
        const normalized = local
            .replace(/\./g, "")      // 去掉所有点号
            .replace(/\+.*$/, "")    // 去掉 +tag 及之后内容
        return `${normalized}@gmail.com`
    }

    // QQ邮箱：仅小写
    return lower
}

/**
 * 验证邮箱格式是否有效
 */
export function isValidEmail(email: string): boolean {
    const parts = email.trim().split("@")
    if (parts.length !== 2) return false
    const [local, domain] = parts
    if (!local || !domain) return false
    if (!domain.includes(".")) return false
    return true
}
