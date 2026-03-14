import { NextRequest, NextResponse } from "next/server"
import { tosClient, TOS_BUCKET } from "@/lib/tos"
import { extractObjectKey } from "@/lib/cdnUrl"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "-")
}

/**
 * 生成 TOS 预签名下载 URL
 * 浏览器可直接从 TOS 下载，完全绕过服务器带宽
 */
function getPresignedDownloadUrl(imageUrl: string, filename: string): string {
  const rawKey = extractObjectKey(imageUrl)
  if (!rawKey) throw new Error("无法提取对象 Key")

  // 去掉 x-tos-process 等查询参数，只保留纯路径
  const objectKey = rawKey.split("?")[0]

  const signedUrl = tosClient.getPreSignedUrl({
    method: "GET",
    bucket: TOS_BUCKET,
    key: objectKey,
    expires: 600, // 10分钟有效
    // response 对象的 key 会自动转换为 response-content-disposition 等查询参数
    response: {
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })

  return signedUrl
}

/**
 * GET /api/download-images?url=...&filename=...
 * 单张图片下载：302 重定向到 TOS 预签名 URL
 * 浏览器直接从 TOS 下载，服务器带宽消耗 ≈ 0
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get("url")
    const filename = sanitizeFilename(searchParams.get("filename") || `image-${Date.now()}.png`)

    if (!url) {
      return NextResponse.json({ error: "缺少 url 参数" }, { status: 400 })
    }

    const signedUrl = getPresignedDownloadUrl(url, filename)

    // 302 重定向，浏览器直接去 TOS 下载
    return NextResponse.redirect(signedUrl, { status: 302 })
  } catch (error: any) {
    console.error("单张下载预签名错误:", error)
    return NextResponse.json(
      { error: "生成下载链接失败", message: error?.message || String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/download-images
 * 批量下载：返回预签名 URL 数组，由前端直接从 TOS 拉取并打包 ZIP
 * 服务器带宽消耗 ≈ 0（只返回一个小 JSON）
 */
export async function POST(req: NextRequest) {
  try {
    const { imageUrls } = await req.json()

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: "无效的图片URL数组" }, { status: 400 })
    }

    // 并发生成所有预签名 URL（纯本地计算，无网络请求，极快）
    const results = await Promise.all(
      imageUrls.map(async (url: string, index: number) => {
        try {
          const filename = `image-${index + 1}.png`
          const signedUrl = getPresignedDownloadUrl(url, filename)
          return { success: true, signedUrl }
        } catch (error) {
          console.error(`生成第 ${index + 1} 张预签名 URL 失败:`, error)
          return { success: false, error: error instanceof Error ? error.message : "生成失败" }
        }
      })
    )

    return NextResponse.json({ success: true, images: results })
  } catch (error: any) {
    console.error("批量下载预签名错误:", error)
    return NextResponse.json(
      { error: "服务器错误", message: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}
