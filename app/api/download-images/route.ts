import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "-")
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrls } = await req.json()

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: "无效的图片URL数组" }, { status: 400 })
    }

    console.log(`开始下载 ${imageUrls.length} 张图片...`)

    // 并发下载所有图片
    const imageBlobs = await Promise.all(
      imageUrls.map(async (url: string, index: number) => {
        try {
          console.log(`正在下载第 ${index + 1} 张图片: ${url}`)
          const response = await fetch(url)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }

          const arrayBuffer = await response.arrayBuffer()
          const base64 = Buffer.from(arrayBuffer).toString("base64")

          console.log(`第 ${index + 1} 张图片下载成功`)

          return {
            success: true,
            data: base64,
            contentType: response.headers.get("content-type") || "image/png",
          }
        } catch (error) {
          console.error(`下载图片 ${index + 1} 失败:`, error)
          return {
            success: false,
            error: error instanceof Error ? error.message : "下载失败",
          }
        }
      }),
    )

    const successCount = imageBlobs.filter((b) => b.success).length
    console.log(`成功下载 ${successCount}/${imageUrls.length} 张图片`)

    return NextResponse.json({
      success: true,
      images: imageBlobs,
    })
  } catch (error) {
    console.error("下载图片API错误:", error)
    return NextResponse.json(
      { error: "服务器错误", message: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    )
  }
}

// 单张图片下载（避免浏览器跨域/CORS 导致 failed to fetch）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get("url")
    const filename = sanitizeFilename(searchParams.get("filename") || `image-${Date.now()}.png`)

    if (!url) {
      return NextResponse.json({ error: "缺少 url 参数" }, { status: 400 })
    }

    const response = await fetch(url)
    if (!response.ok) {
      return NextResponse.json(
        { error: `下载失败: HTTP ${response.status}` },
        { status: 502 },
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    const contentType = response.headers.get("content-type") || "application/octet-stream"

    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // attachment 触发浏览器下载
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error: any) {
    console.error("单张下载错误:", error)
    return NextResponse.json(
      { error: "下载失败", message: error?.message || String(error) },
      { status: 500 },
    )
  }
}
