import { NextRequest, NextResponse } from "next/server"
import { extractObjectKey } from "@/lib/cdnUrl"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// CDN 域名（利用 CDN 缓存，减少 TOS 回源流出）
const CDN_HOST = process.env.NEXT_PUBLIC_CDN_HOST || "img.wzhdjy.xin"

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "-")
}

/**
 * 从图片 URL 提取 CDN 下载地址
 * 走 CDN 缓存，同一图片重复下载命中缓存，减少 TOS 回源
 */
function getCdnDownloadUrl(imageUrl: string): string {
  const rawKey = extractObjectKey(imageUrl)
  if (!rawKey) throw new Error("无法提取对象 Key")

  // 分离路径和查询参数
  const [objectKey, queryString] = rawKey.split("?")

  if (queryString) {
    return `https://${CDN_HOST}/${objectKey}?${queryString}`
  }
  return `https://${CDN_HOST}/${objectKey}`
}

/**
 * GET /api/download-images?url=...&filename=...
 * 单张图片下载：服务端从 CDN 代理下载，附带 Content-Disposition 头
 * 流量走 CDN 缓存（服务端→CDN），浏览器得到正确的下载响应
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get("url")
    const filename = sanitizeFilename(searchParams.get("filename") || `image-${Date.now()}.png`)

    if (!url) {
      return NextResponse.json({ error: "缺少 url 参数" }, { status: 400 })
    }

    const cdnUrl = getCdnDownloadUrl(url)

    // 从 CDN 拉取图片（命中 CDN 缓存则不回源 TOS）
    const imageResponse = await fetch(cdnUrl)

    if (!imageResponse.ok) {
      throw new Error(`CDN 请求失败: ${imageResponse.status}`)
    }

    const contentType = imageResponse.headers.get("content-type") || "image/png"
    const imageBuffer = await imageResponse.arrayBuffer()

    // 返回图片数据，带 Content-Disposition 触发浏览器下载
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error: any) {
    console.error("单张下载错误:", error)
    return NextResponse.json(
      { error: "下载失败", message: error?.message || String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/download-images
 * 批量下载：返回 CDN URL 数组，由前端直接从 CDN 拉取并打包 ZIP
 * 流量走 CDN 缓存，减少 TOS 直出
 */
export async function POST(req: NextRequest) {
  try {
    const { imageUrls } = await req.json()

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: "无效的图片URL数组" }, { status: 400 })
    }

    // 生成 CDN 下载 URL（纯本地计算，无网络请求）
    const results = imageUrls.map((url: string, index: number) => {
      try {
        const downloadUrl = getCdnDownloadUrl(url)
        return { success: true, signedUrl: downloadUrl }
      } catch (error) {
        console.error(`生成第 ${index + 1} 张 CDN URL 失败:`, error)
        return { success: false, error: error instanceof Error ? error.message : "生成失败" }
      }
    })

    return NextResponse.json({ success: true, images: results })
  } catch (error: any) {
    console.error("批量下载链接生成错误:", error)
    return NextResponse.json(
      { error: "服务器错误", message: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}
