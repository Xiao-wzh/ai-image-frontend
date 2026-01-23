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

    const query = String(searchParams.get("query") ?? "").trim()
    const status = searchParams.get("status") // Optional: COMPLETED, PENDING, FAILED

    const limitRaw = Number(searchParams.get("limit") ?? DEFAULT_LIMIT)
    const offsetRaw = Number(searchParams.get("offset") ?? 0)

    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
      : DEFAULT_LIMIT

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
          mode: true,  // 添加 mode 字段
          features: true,  // 添加 features 字段
          refImages: true,  // 添加 refImages 字段
          generatedImages: true,
          originalImage: true,
          status: true,
          createdAt: true,
          hasUsedDiscountedRetry: true,
          isWatermarkUnlocked: true,
          outputLanguage: true,
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

    // Get unique productTypes and fetch their descriptions
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

    // Create a map for quick lookup
    const descriptionMap = new Map(
      productTypeDescriptions.map(p => [p.productType, p.description])
    )

    // Enrich items with productTypeDescription
    const enrichedItems = items.map(item => ({
      ...item,
      productTypeDescription: descriptionMap.get(item.productType) || null,
    }))

    // 转换图片 URL 为 CDN 域名
    const transformedItems = transformGenerationUrlsList(enrichedItems)

    return NextResponse.json({
      success: true,
      items: transformedItems,
      page: {
        limit,
        offset,
        total,
        hasMore: offset + items.length < total,
      },
    })

  } catch (err: any) {
    const message = err?.message || String(err)
    console.error("❌ history API 错误:", message)
    return NextResponse.json({ error: "获取历史记录失败", message }, { status: 500 })
  }
}
