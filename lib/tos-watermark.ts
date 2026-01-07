/**
 * Volcengine TOS Image Processing Utility
 * 
 * Supports operation chaining with pipe `|` separator.
 * Order: Crop -> Watermark (strict business requirement)
 * 
 * Docs: https://www.volcengine.com/docs/6349/78939
 */

// ============================================================================
// URL-Safe Base64 Encoding
// ============================================================================

/**
 * Encode string to URL-Safe Base64 (RFC 4648 §5)
 * - Replace '+' with '-'
 * - Replace '/' with '_'
 * - Remove padding '='
 */
export function toSafeBase64(str: string): string {
    const base64 = Buffer.from(str, "utf-8").toString("base64")
    return base64
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}

// ============================================================================
// Font Mapping
// ============================================================================

/**
 * TOS supported Chinese fonts with their Base64 encoded names
 */
const TOS_FONTS: Record<string, string> = {
    "wqy-zenhei": toSafeBase64("wqy-zenhei"),
    "fangzhengshusong": toSafeBase64("fangzhengshusong"),
    "fangzhengkaiti": toSafeBase64("fangzhengkaiti"),
    "fangzhengheiti": toSafeBase64("fangzhengheiti"),
}

/**
 * Get TOS Base64 encoded font name
 */
export function getTosFont(fontName?: string | null): string {
    if (fontName && TOS_FONTS[fontName]) {
        return TOS_FONTS[fontName]
    }
    return TOS_FONTS["wqy-zenhei"]
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface WatermarkParams {
    type: "IMAGE" | "TEXT"
    content: string
    opacity: number          // 0-100
    rotate: number           // 0-360
    scale: number            // 1-100 percentage
    position: string         // TOS gravity: nw/north/ne/west/center/east/sw/south/se
    xOffset: number          // Horizontal margin (pixels)
    yOffset: number          // Vertical margin (pixels)
    isTiled: boolean
    fontSize?: number | null
    fontColor?: string | null
    fontName?: string | null
}

export interface CropParams {
    w?: number               // Width
    h?: number               // Height
    x?: number               // X offset
    y?: number               // Y offset
    g?: string               // Gravity (nw/north/ne/west/center/east/sw/south/se)
}

// ============================================================================
// Build Crop Operation String
// ============================================================================

function buildCropString(params: CropParams): string {
    const parts: string[] = ["image/crop"]

    if (params.w !== undefined) parts.push(`w_${params.w}`)
    if (params.h !== undefined) parts.push(`h_${params.h}`)
    if (params.x !== undefined) parts.push(`x_${params.x}`)
    if (params.y !== undefined) parts.push(`y_${params.y}`)
    if (params.g) parts.push(`g_${params.g}`)

    return parts.join(",")
}

// ============================================================================
// Build Watermark Operation String
// ============================================================================

function buildWatermarkString(params: WatermarkParams): string {
    const parts: string[] = []

    if (params.type === "TEXT") {
        // Text Watermark
        parts.push(`text_${toSafeBase64(params.content)}`)
        parts.push(`type_${getTosFont(params.fontName)}`)

        const color = (params.fontColor || "#FFFFFF").replace("#", "").toUpperCase()
        parts.push(`color_${color}`)

        const size = params.fontSize || 24
        parts.push(`size_${size}`)

        const rotate = Math.max(0, Math.min(360, Math.round(params.rotate)))
        parts.push(`rotate_${rotate}`)

        parts.push(`fill_${params.isTiled ? 1 : 0}`)
        parts.push(`shadow_50`)

    } else if (params.type === "IMAGE") {
        // Image Watermark
        let objectKey = params.content

        // Extract object key from full URL if needed
        if (objectKey.startsWith("http://") || objectKey.startsWith("https://")) {
            try {
                const url = new URL(objectKey)
                objectKey = url.pathname.replace(/^\//, "")
            } catch {
                // Use as-is
            }
        }

        // Apply scale if not 100%
        let rawImageRef = objectKey
        if (params.scale && params.scale !== 100) {
            const scalePercent = Math.max(1, Math.min(100, Math.round(params.scale)))
            rawImageRef = `${objectKey}?x-tos-process=image/resize,P_${scalePercent}`
        }

        parts.push(`image_${toSafeBase64(rawImageRef)}`)
    }

    // Common Parameters
    const opacity = Math.max(0, Math.min(100, Math.round(params.opacity)))
    parts.push(`t_${opacity}`)

    const validPositions = ["nw", "north", "ne", "west", "center", "east", "sw", "south", "se"]
    const gravity = validPositions.includes(params.position) ? params.position : "se"
    parts.push(`g_${gravity}`)

    const xMargin = Math.max(0, Math.round(params.xOffset))
    parts.push(`x_${xMargin}`)

    const yMargin = Math.max(0, Math.round(params.yOffset))
    parts.push(`y_${yMargin}`)

    return `image/watermark,${parts.join(",")}`
}

// ============================================================================
// Main Function: Generate Processed URL
// ============================================================================

/**
 * Generate TOS processed image URL with operation chaining
 * 
 * Order: Crop -> Watermark (strict requirement)
 * 
 * @param originalUrl - Original TOS image URL
 * @param template - Watermark parameters (optional, null to skip watermark)
 * @param cropParams - Crop parameters (optional)
 * @returns URL with x-tos-process query parameter
 * 
 * @example
 * // Crop only
 * getWatermarkedUrl(url, null, { w: 682, h: 682, g: 'center' })
 * // -> url?x-tos-process=image/crop,w_682,h_682,g_center
 * 
 * // Watermark only
 * getWatermarkedUrl(url, template)
 * // -> url?x-tos-process=image/watermark,text_...,g_se
 * 
 * // Crop + Watermark
 * getWatermarkedUrl(url, template, { w: 682, h: 682 })
 * // -> url?x-tos-process=image/crop,w_682,h_682|image/watermark,text_...
 */
export function getWatermarkedUrl(
    originalUrl: string,
    template: WatermarkParams | null,
    cropParams?: CropParams
): string {
    const processChain: string[] = []

    // Step 1: Crop (if provided)
    if (cropParams && (cropParams.w || cropParams.h || cropParams.x !== undefined || cropParams.y !== undefined || cropParams.g)) {
        processChain.push(buildCropString(cropParams))
    }

    // Step 2: Watermark (if provided)
    if (template && template.content) {
        processChain.push(buildWatermarkString(template))
    }

    // If no operations, return original URL
    if (processChain.length === 0) {
        return originalUrl
    }

    // Step 3: Combine with pipe separator
    const processString = processChain.join("|")

    // Step 4: Build final URL
    // Check if URL already has x-tos-process - if so, append with pipe
    const existingProcessMatch = originalUrl.match(/([?&])x-tos-process=([^&]+)/)

    if (existingProcessMatch) {
        // Append to existing x-tos-process with pipe
        const existingProcess = existingProcessMatch[2]
        const newProcess = `${existingProcess}|${processString}`
        return originalUrl.replace(
            /([?&])x-tos-process=[^&]+/,
            `$1x-tos-process=${newProcess}`
        )
    }

    // No existing x-tos-process, add new one
    const separator = originalUrl.includes("?") ? "&" : "?"
    return `${originalUrl}${separator}x-tos-process=${processString}`
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate URL with watermark only (backward compatible)
 */
export function getWatermarkedUrlFromTemplate(
    originalUrl: string,
    template: WatermarkParams
): string {
    return getWatermarkedUrl(originalUrl, template)
}

/**
 * Generate URL with crop only
 */
export function getCroppedUrl(
    originalUrl: string,
    cropParams: CropParams
): string {
    return getWatermarkedUrl(originalUrl, null, cropParams)
}

/**
 * Generate URL with both crop and watermark
 */
export function getCroppedAndWatermarkedUrl(
    originalUrl: string,
    template: WatermarkParams,
    cropParams: CropParams
): string {
    return getWatermarkedUrl(originalUrl, template, cropParams)
}
