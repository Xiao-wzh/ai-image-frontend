/**
 * CDN URL 替换工具
 * 将火山 TOS 原站 URL 替换为 CDN 域名
 * 数据库不动，仅在返回给前端时替换
 */

// 原始 TOS 域名
const ORIGIN_HOST = "sexyspecies-ai-image.tos-cn-beijing.volces.com"

// CDN 域名 (从环境变量读取，默认 img.wzhdjy.xin)
const CDN_HOST = process.env.NEXT_PUBLIC_CDN_HOST || "img.wzhdjy.xin"

// 用于匹配 origin URL 的正则 (支持 http 和 https)
const ORIGIN_REGEX = new RegExp(`https?://${ORIGIN_HOST.replace(/\./g, "\\.")}`, "g")

/**
 * 将单个 URL 中的 TOS 原站域名替换为 CDN 域名
 * @param url 原始 URL
 * @returns 替换后的 URL，保留 path 和 query 参数
 */
export function toCdnUrl(url: string | null | undefined): string | null | undefined {
    if (!url) return url
    return url.replace(ORIGIN_REGEX, `https://${CDN_HOST}`)
}

/**
 * 从完整 URL 中提取对象 Key (保留查询参数如 x-tos-process)
 * 支持 TOS 原站 URL、CDN URL，或已经是 key 的情况
 * @param url 完整 URL 或 key
 * @returns 对象 key (不含域名，但保留查询参数)
 */
export function extractObjectKey(url: string | null | undefined): string | null | undefined {
    if (!url) return url

    // 已经是 key（不包含 http）
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return url
    }

    try {
        const urlObj = new URL(url)
        // 返回路径部分 + 查询参数，去掉开头的 /
        const pathname = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname
        // 保留查询参数（如 ?x-tos-process=image/crop,...）
        return pathname + urlObj.search
    } catch {
        // URL 解析失败，返回原值
        return url
    }
}

/**
 * 将对象 Key 转换为 CDN URL
 * 兼容两种情况：
 * 1. 新格式：纯 key -> https://CDN_HOST/key
 * 2. 旧格式：完整 URL -> 替换为 CDN 域名
 * @param keyOrUrl 对象 key 或完整 URL
 * @returns CDN URL
 */
export function keyToCdnUrl(keyOrUrl: string | null | undefined): string | null | undefined {
    if (!keyOrUrl) return keyOrUrl

    // 已经是完整 URL，走旧的替换逻辑
    if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
        return toCdnUrl(keyOrUrl)
    }

    // 纯 key，拼接 CDN 域名
    return `https://${CDN_HOST}/${keyOrUrl}`
}

/**
 * 处理可能包含多个 URL 的字符串（如 originalImage 字段）
 * 将其中所有 TOS 原站域名替换为 CDN 域名
 * @param value 原始字符串
 * @returns 替换后的字符串
 */
export function toCdnUrlString(value: string | null | undefined): string | null | undefined {
    if (!value) return value
    return value.replace(ORIGIN_REGEX, `https://${CDN_HOST}`)
}

/**
 * 处理 URL 数组或 JSON 字符串
 * @param value 可能是:
 *   - string[] 数组：每个元素替换
 *   - JSON string（例如 '["https://...","https://..."]'）：解析后替换再 stringify
 *   - null/undefined：原样返回
 * @returns 替换后的值（保持原类型）
 */
export function toCdnUrlArray(value: any): any {
    if (value === null || value === undefined) {
        return value
    }

    // 如果是数组，直接处理每个元素
    if (Array.isArray(value)) {
        return value.map((item) => (typeof item === "string" ? toCdnUrl(item) : item))
    }

    // 如果是字符串，尝试解析为 JSON 数组
    if (typeof value === "string") {
        // 检查是否是 JSON 数组格式
        const trimmed = value.trim()
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                const parsed = JSON.parse(trimmed)
                if (Array.isArray(parsed)) {
                    const replaced = parsed.map((item) =>
                        typeof item === "string" ? toCdnUrl(item) : item
                    )
                    return JSON.stringify(replaced)
                }
            } catch {
                // JSON 解析失败，作为普通字符串处理
            }
        }
        // 普通字符串，直接替换
        return toCdnUrlString(value)
    }

    // 其他类型，原样返回
    return value
}

/**
 * 转换 Generation 记录中的所有图片 URL/Key
 * 统一处理 originalImage, generatedImage, generatedImages 字段
 * 兼容新格式(key)和旧格式(完整URL)
 * @param record Generation 记录对象
 * @returns 转换后的记录对象（新对象，不修改原对象）
 */
export function transformGenerationUrls<T>(record: T): T {
    if (!record || typeof record !== "object") return record

    const result: any = { ...record }

    // originalImage 可能是 string 或 string[]
    if ("originalImage" in result && result.originalImage !== undefined) {
        if (Array.isArray(result.originalImage)) {
            result.originalImage = result.originalImage.map((url: string) => keyToCdnUrl(url))
        } else if (typeof result.originalImage === "string") {
            result.originalImage = keyToCdnUrl(result.originalImage)
        }
    }

    // generatedImage 是单个 string (可能是 key 或 URL)
    if ("generatedImage" in result && result.generatedImage !== undefined) {
        result.generatedImage = keyToCdnUrl(result.generatedImage)
    }

    // generatedImages 是 string[] (可能是 keys 或 URLs)
    if ("generatedImages" in result && result.generatedImages !== undefined) {
        if (Array.isArray(result.generatedImages)) {
            result.generatedImages = result.generatedImages.map((item: string) => keyToCdnUrl(item))
        }
    }

    return result as T
}


/**
 * 批量转换 Generation 记录列表
 * @param records Generation 记录数组
 * @returns 转换后的记录数组
 */
export function transformGenerationUrlsList<T>(records: T[]): T[] {
    return records.map(transformGenerationUrls)
}



// ============ 运行时测试 ============
if (process.env.NODE_ENV === "development") {
    const testUrl = "https://sexyspecies-ai-image.tos-cn-beijing.volces.com/SEXY_SPECIES/test.png?x-tos-process=image/crop,w_100"
    const result = toCdnUrl(testUrl)
    console.log("[CDN URL Test]")
    console.log("  Input: ", testUrl)
    console.log("  Output:", result)
    console.log("  Expected: https://img.wzhdjy.xin/SEXY_SPECIES/test.png?x-tos-process=image/crop,w_100")
    console.log("  Pass:", result === "https://img.wzhdjy.xin/SEXY_SPECIES/test.png?x-tos-process=image/crop,w_100")
}
