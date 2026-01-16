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
 * 转换 Generation 记录中的所有图片 URL
 * 统一处理 originalImage, generatedImage, generatedImages 字段
 * @param record Generation 记录对象
 * @returns 转换后的记录对象（新对象，不修改原对象）
 */
export function transformGenerationUrls<T>(record: T): T {
    if (!record || typeof record !== "object") return record

    const result: any = { ...record }

    // originalImage 可能是 string 或 string[]
    if ("originalImage" in result && result.originalImage !== undefined) {
        if (Array.isArray(result.originalImage)) {
            result.originalImage = result.originalImage.map((url: string) => toCdnUrl(url))
        } else if (typeof result.originalImage === "string") {
            result.originalImage = toCdnUrlString(result.originalImage)
        }
    }

    // generatedImage 是单个 string
    if ("generatedImage" in result && result.generatedImage !== undefined) {
        result.generatedImage = toCdnUrl(result.generatedImage)
    }

    // generatedImages 是 string[] 或 JSON string
    if ("generatedImages" in result && result.generatedImages !== undefined) {
        result.generatedImages = toCdnUrlArray(result.generatedImages)
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
