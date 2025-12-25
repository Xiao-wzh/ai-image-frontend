import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
          const base64 = Buffer.from(arrayBuffer).toString('base64')

          console.log(`第 ${index + 1} 张图片下载成功`)

          return {
            success: true,
            data: base64,
            contentType: response.headers.get('content-type') || 'image/png',
          }
        } catch (error) {
          console.error(`下载图片 ${index + 1} 失败:`, error)
          return {
            success: false,
            error: error instanceof Error ? error.message : '下载失败',
          }
        }
      })
    )

    const successCount = imageBlobs.filter(b => b.success).length
    console.log(`成功下载 ${successCount}/${imageUrls.length} 张图片`)

    return NextResponse.json({
      success: true,
      images: imageBlobs,
    })
  } catch (error) {
    console.error('下载图片API错误:', error)
    return NextResponse.json(
      { error: '服务器错误', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
