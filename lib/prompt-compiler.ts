import Handlebars from "handlebars"

/**
 * Prompt 模板变量上下文
 * 所有可在模板中使用的变量
 */
export interface PromptContext {
    productName: string
    language: string
    detailBatch?: string
    features?: string
    numberOfReferenceImages?: number
    proFeatures?: string | null
    proStyle?: string | null
    imageCount?: number
    aspectRatio?: string
    [key: string]: any
}

/**
 * 向前兼容：将旧 `${var}` 语法转换为 Handlebars `{{var}}` 语法
 * 确保存量模板零迁移成本
 */
function migrateLegacySyntax(template: string): string {
    // 匹配 ${variableName}（不含花括号嵌套），转为 {{variableName}}
    return template.replace(/\$\{(\w+)\}/g, "{{$1}}")
}

/**
 * 使用 Handlebars 编译 Prompt 模板
 *
 * 支持：
 * - 简单变量替换：   {{productName}}
 * - 条件渲染：       {{#if proStyle}}...{{else}}...{{/if}}
 * - 反条件渲染：     {{#unless proStyle}}...{{/unless}}
 * - 向前兼容：       ${productName} → 自动转为 {{productName}}
 *
 * @param templateStr - 原始模板字符串
 * @param payload     - 变量上下文
 * @returns 编译后的纯文本字符串
 */
export function compilePrompt(templateStr: string, payload: PromptContext): string {
    if (!templateStr || !templateStr.trim()) {
        throw new Error("Prompt 模板内容为空，无法编译")
    }

    // 1. 向前兼容旧语法
    const migratedTemplate = migrateLegacySyntax(templateStr)

    // 2. 处理 payload 兜底逻辑
    const context: Record<string, any> = {
        ...payload,
        // PRO 兜底：proFeatures 为空时给默认值
        proFeatures: payload.proFeatures?.trim() || "智能分析产品卖点",
        // proStyle 为空时设为 null，让 {{#if proStyle}} 返回 false
        proStyle: payload.proStyle?.trim() || null,
        // 通用兜底
        productName: payload.productName || "商品",
        language: payload.language || "简体中文",
        features: payload.features || "",
        numberOfReferenceImages: payload.numberOfReferenceImages ?? 0,
        imageCount: payload.imageCount ?? 9,
        aspectRatio: payload.aspectRatio ?? "1:1",
        detailBatch: payload.detailBatch ?? "A",
    }

    // 3. 编译并渲染
    try {
        const compiled = Handlebars.compile(migratedTemplate, { noEscape: true })
        return compiled(context)
    } catch (err: any) {
        console.error("[PROMPT_COMPILER] Handlebars compilation error:", err.message)
        throw new Error(`Prompt 模板编译失败: ${err.message}`)
    }
}
