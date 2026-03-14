/**
 * 图片切片工具
 *
 * 将 STANDARD 模式生成的合并大图切分为子图。
 * 通过 TOS 图像处理 URL 参数（x-tos-process=image/crop）实现零带宽裁剪。
 *
 * 模式说明：
 * - PRO 模式：n8n 直接生成 N 张独立图片，不需要裁剪
 * - STANDARD + MAIN_IMAGE：九宫格 3×3，先行后列遍历；真实尺寸由 worker 读取后传入，默认 4096×4096
 * - STANDARD + DETAIL_PAGE：3行2列，先列后行遍历；真实尺寸由 worker 读取后传入，默认 3072×5504
 * - STANDARD + 其他（图片修改等）：返回完整图片，不裁剪
 */

/** 构造 TOS 图像裁剪 URL */
function buildCropUrl(baseUrl: string, x: number, y: number, w: number, h: number): string {
  return `${baseUrl}?x-tos-process=image/crop,x_${x},y_${y},w_${w},h_${h}`
}

export interface SliceOptions {
  /** 质量模式：STANDARD / PRO */
  qualityMode: string
  /** 任务类型：MAIN_IMAGE / DETAIL_PAGE / ... */
  taskType: string
  /**
   * 合并大图的完整 CDN URL。
   * 仅 STANDARD 模式需要。
   */
  fullImageUrl?: string
  /**
   * PRO 模式下各分图的 TOS key 数组（已上传完毕）。
   * 仅 PRO 模式需要。
   */
  imageKeys?: string[]
  /**
   * 合并大图的真实宽度（像素）。
   * 由 worker 通过 image-size 读取后传入；未传时使用 taskType 对应的默认值。
   */
  actualWidth?: number
  /**
   * 合并大图的真实高度（像素）。
   * 由 worker 通过 image-size 读取后传入；未传时使用 taskType 对应的默认值。
   */
  actualHeight?: number
}

/**
 * 按先行后列顺序生成裁剪 URL（主图九宫格）
 *
 * 遍历顺序：row 0 → col 0,1,2 → row 1 → col 0,1,2 → row 2 → col 0,1,2
 */
function sliceRowFirst(
  baseUrl: string,
  rows: number,
  cols: number,
  totalW: number,
  totalH: number
): string[] {
  const cellW = Math.floor(totalW / cols)
  const cellH = Math.floor(totalH / rows)
  const result: string[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellW
      const y = row * cellH
      // 最后一列/行吸收余数，防止因 floor 导致边缘 1px 缺失
      const w = col === cols - 1 ? totalW - x : cellW
      const h = row === rows - 1 ? totalH - y : cellH
      result.push(buildCropUrl(baseUrl, x, y, w, h))
    }
  }

  return result
}

/**
 * 按先列后行顺序生成裁剪 URL（详情图）
 *
 * 遍历顺序：col 0 → row 0,1,2 → col 1 → row 0,1,2
 */
function sliceColFirst(
  baseUrl: string,
  rows: number,
  cols: number,
  totalW: number,
  totalH: number
): string[] {
  const cellW = Math.floor(totalW / cols)
  const cellH = Math.floor(totalH / rows)
  const result: string[] = []

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const x = col * cellW
      const y = row * cellH
      const w = col === cols - 1 ? totalW - x : cellW
      const h = row === rows - 1 ? totalH - y : cellH
      result.push(buildCropUrl(baseUrl, x, y, w, h))
    }
  }

  return result
}

/**
 * 根据业务参数返回最终展示的图片 URL/key 数组。
 *
 * 返回值说明：
 * - PRO 模式返回 objectKey 数组（由 worker 直接写入 DB）
 * - STANDARD 模式返回完整 CDN 裁剪 URL 数组（含 x-tos-process 参数）
 * - STANDARD + 图片修改等其他类型返回 [fullImageUrl]（单张，不裁剪）
 */
export function sliceImages(opts: SliceOptions): string[] {
  const { qualityMode, taskType, fullImageUrl, imageKeys, actualWidth, actualHeight } = opts

  // PRO 模式：直接返回各分图 key，worker 已并发上传完毕
  if (qualityMode === "PRO") {
    return imageKeys ?? []
  }

  // STANDARD 模式需要 fullImageUrl
  if (!fullImageUrl) {
    console.error("[切图] STANDARD 模式缺少 fullImageUrl")
    return []
  }

  switch (taskType) {
    case "MAIN_IMAGE": {
      // 九宫格：3行3列，先行后列；真实尺寸优先，回退 4096×4096
      const w = actualWidth || 4096
      const h = actualHeight || 4096
      console.log(`[切图] MAIN_IMAGE 尺寸: ${w}×${h}`)
      return sliceRowFirst(fullImageUrl, 3, 3, w, h)
    }

    case "DETAIL_PAGE": {
      // 详情图：3行2列，先列后行；真实尺寸优先，回退 3072×5504
      const w = actualWidth || 3072
      const h = actualHeight || 5504
      console.log(`[切图] DETAIL_PAGE 尺寸: ${w}×${h}`)
      return sliceColFirst(fullImageUrl, 3, 2, w, h)
    }

    default: {
      // 图片修改等其他任务类型：n8n 直接返回完整图片，不裁剪
      console.log(`[切图] taskType=${taskType} 不需要裁剪，返回原图`)
      return [fullImageUrl]
    }
  }
}
