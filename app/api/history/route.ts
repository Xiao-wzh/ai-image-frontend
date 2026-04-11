import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { transformGenerationUrlsList } from "@/lib/cdnUrl"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id || null
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") || "image" // image | video

    // 视频历史查询
    if (type === "video") {
      return handleVideoHistory(userId, searchParams)
    }

    // 图片历史查询（原有逻辑）
    return handleImageHistory(userId, searchParams)
  } catch (err: any) {
    const message = err?.message || String(err)
    console.error("❌ history API 错误:", message)
    return NextResponse.json({ error: "获取历史记录失败", message }, { status: 500 })
  }
}

/**
 * 图片历史查询（原有逻辑）
 */
async function handleImageHistory(userId: string, searchParams: URLSearchParams) {
  const query = String(searchParams.get("query") ?? "").trim()
  const status = searchParams.get("status")

  const limitRaw = Number(searchParams.get("limit") ?? 12)
  const offsetRaw = Number(searchParams.get("offset") ?? 0)

  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
    : 12

  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0

  const where = {
    userId,
    ...(query
      ? {
        productName: {
          contains: query,
          mode: "insensitive" as const,
        },
      }
      : {}),
    ...(status ? { status } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.generation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        productName: true,
        productType: true,
        taskType: true,
        mode: true,
        qualityMode: true,
        features: true,
        refImages: true,
        platformKey: true,
        generatedImages: true,
        generatedImage: true,
        originalImage: true,
        status: true,
        createdAt: true,
        hasUsedDiscountedRetry: true,
        isWatermarkUnlocked: true,
        outputLanguage: true,
        imageCount: true,
        costPerImage: true,
        refundAmount: true,
        editingImageIndexes: true,
        appeal: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    }),
    prisma.generation.count({ where }),
  ])

  const productTypes = [...new Set(items.map(g => g.productType).filter(Boolean))] as string[]
  const productTypeDescriptions = await prisma.productTypePrompt.findMany({
    where: {
      productType: { in: productTypes },
      isActive: true,
    },
    select: {
      productType: true,
      description: true,
    },
    distinct: ['productType'],
  })

  const descriptionMap = new Map(
    productTypeDescriptions.map(p => [p.productType, p.description])
  )

  const enrichedItems = items.map(item => ({
    ...item,
    productTypeDescription: descriptionMap.get(item.productType) || null,
  }))

  const transformedItems = transformGenerationUrlsList(enrichedItems)

  return NextResponse.json({
    success: true,
    type: "image",
    items: transformedItems,
    page: {
      limit,
      offset,
      total,
      hasMore: offset + items.length < total,
    },
  })
}

/**
 * 视频历史查询
 */
async function handleVideoHistory(userId: string, searchParams: URLSearchParams) {
  const status = searchParams.get("status")

  const limitRaw = Number(searchParams.get("limit") ?? 12)
  const offsetRaw = Number(searchParams.get("offset") ?? 0)

  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
    : 12

  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0

  const where = {
    userId,
    ...(status ? { status } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.videoGeneration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        model: true,
        prompt: true,
        seconds: true,
        size: true,
        status: true,
        videoUrl: true,
        progress: true,
        cost: true,
        errorMsg: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    prisma.videoGeneration.count({ where }),
  ])

  // 为每条记录计算 refreshable 字段
  const enrichedItems = items.map(item => ({
    ...item,
    refreshable: !["COMPLETED", "FAILED"].includes(item.status),
  }))

  return NextResponse.json({
    success: true,
    type: "video",
    items: enrichedItems,
    page: {
      limit,
      offset,
      total,
      hasMore: offset + items.length < total,
    },
  })
}
