import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { ProductTypePromptKey, ProductTypeKey } from "@/lib/constants"
import "dotenv/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STANDARD_COST = 199
const RETRY_COST = 99

export async function POST(req: NextRequest) {
  let generationId: string | null = null
  let preDeducted = false
  let actualCost = STANDARD_COST

  let deductedBonus = 0
  let deductedPaid = 0

  const session = await auth()
  const userId = session?.user?.id || null
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  // 在 try 外部预先解析 body，以便 catch 块可以访问
  const body = await req.clone().json().catch(() => null)
  const retryFromId = body?.retryFromId as string | undefined

  try {
    let productName: string
    let productType: ProductTypeKey
    let platformKey: string
    let imageUrls: string[]

    if (retryFromId) {
      // --- 重试流程 ---
      actualCost = RETRY_COST

      const originalGeneration = await prisma.generation.findUnique({
        where: { id: retryFromId },
      })

      if (!originalGeneration) {
        return NextResponse.json({ error: "重试的原始记录不存在" }, { status: 404 })
      }
      if (originalGeneration.userId !== userId) {
        return NextResponse.json({ error: "你无权重试此记录" }, { status: 403 })
      }
      if (originalGeneration.hasUsedDiscountedRetry) {
        return NextResponse.json({ error: "该记录已使用过折扣重试机会" }, { status: 400 })
      }

      productName = originalGeneration.productName
      productType = originalGeneration.productType as ProductTypeKey
      imageUrls = originalGeneration.originalImage
      platformKey = "SHOPEE" // 暂时硬编码
    } else {
      // --- 标准流程 ---
      actualCost = STANDARD_COST

      productName = String(body?.productName ?? "").trim()
      productType = String(body?.productType ?? "").trim() as ProductTypeKey
      platformKey = String(body?.platformKey ?? "SHOPEE").trim().toUpperCase()
      const rawImages = body?.images

      if (!productName) throw new Error("请填写商品名称")
      if (!productType) throw new Error("请选择商品类型")

      let parsedImages: string[] = []
      if (Array.isArray(rawImages)) {
        parsedImages = rawImages.map((x) => String(x).trim()).filter(Boolean)
      } else if (typeof rawImages === 'string') {
        try {
          const parsed = JSON.parse(rawImages)
          if (Array.isArray(parsed)) {
            parsedImages = parsed.map((x) => String(x).trim()).filter(Boolean)
          } else if (rawImages.trim()) {
            parsedImages = [rawImages.trim()]
          }
        } catch {
          if (rawImages.trim()) parsedImages = [rawImages.trim()]
        }
      } else if (rawImages && typeof rawImages === 'object') {
        parsedImages = Object.values(rawImages).map((x) => String(x).trim()).filter(Boolean)
      }

      if (parsedImages.length === 0) {
        throw new Error("请至少上传 1 张图片")
      }
      imageUrls = parsedImages
    }

    // 2) 原子扣费 + 更新
    const deductResult = await prisma.$transaction(async (tx) => {
      const userRow = await tx.user.findUnique({ where: { id: userId }, select: { credits: true, bonusCredits: true } })
      if (!userRow) {
        return { ok: false as const, status: 404 as const, error: "用户不存在" }
      }

      const totalCredits = (userRow.credits ?? 0) + (userRow.bonusCredits ?? 0)
      if (totalCredits < actualCost) {
        return { ok: false as const, status: 402 as const, error: `余额不足 (需要 ${actualCost} 积分，当前 ${totalCredits})` }
      }

      const deductBonus = Math.min(userRow.bonusCredits || 0, actualCost)
      const deductPaid = actualCost - deductBonus

      await tx.user.update({
        where: { id: userId },
        data: { bonusCredits: { decrement: deductBonus }, credits: { decrement: deductPaid } },
      })

      await tx.creditRecord.create({
        data: {
          userId,
          amount: -actualCost,
          type: "CONSUME",
          description: retryFromId ? `折扣重试: ${productName}` : `生成图片: ${productName}`,
        },
      })

      if (retryFromId) {
        await tx.generation.update({
          where: { id: retryFromId },
          data: { hasUsedDiscountedRetry: true },
        })
      }

      return { ok: true as const, deductBonus, deductPaid }
    })

    if (!deductResult.ok) {
      return NextResponse.json({ error: deductResult.error }, { status: deductResult.status })
    }

    preDeducted = true
    deductedBonus = deductResult.deductBonus
    deductedPaid = deductResult.deductPaid

    const pending = await prisma.generation.create({
      data: {
        userId,
        productName,
        productType,
        originalImage: imageUrls,
        status: "PENDING",
        hasUsedDiscountedRetry: Boolean(retryFromId),
      },
    })
    generationId = pending.id

    const promptRecord =
      (await prisma.productTypePrompt.findFirst({
        where: { isActive: true, productType, userId, platform: { key: platformKey } },
        orderBy: { updatedAt: "desc" },
      })) ||
      (await prisma.productTypePrompt.findFirst({
        where: { isActive: true, productType, userId: null, platform: { key: platformKey } },
        orderBy: { updatedAt: "desc" },
      })) ||
      (await prisma.productTypePrompt.findFirst({
        where: { isActive: true, productType, userId: null, platform: { key: "GENERAL" } },
        orderBy: { updatedAt: "desc" },
      }))

    if (!promptRecord) {
      throw new Error(`未找到 Prompt 模板：platformKey=${platformKey}, productType=${productType}`)
    }

    const webhookUrl = process.env.N8N_GRSAI_WEBHOOK_URL
    if (!webhookUrl) throw new Error("N8N_GRSAI_WEBHOOK_URL 未配置")

    const n8nPayload = {
      username: (session?.user as any)?.username ?? (session?.user as any)?.name ?? null,
      generation_id: generationId,
      product_name: productName,
      product_type: ProductTypePromptKey[productType] || productType,
      prompt_template: promptRecord.promptTemplate,
      images: imageUrls,
      image_count: imageUrls.length,
    }

    console.log(`[N8N_REQUEST] User: ${userId}, Payload: `, JSON.stringify(n8nPayload, null, 2))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 360_000)

    let n8nRes: Response
    try {
      n8nRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(n8nPayload),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!n8nRes.ok) {
      const errorText = await n8nRes.text().catch(() => "")
      throw new Error(`n8n 调用失败: ${n8nRes.status} ${n8nRes.statusText}`)
    }

    const rawText = await n8nRes.text().catch(() => "")
    if (!rawText) {
      throw new Error("n8n 响应为空")
    }

    let n8nJson: any
    try {
      n8nJson = JSON.parse(rawText)
    } catch {
      throw new Error(`n8n 响应不是有效 JSON: ${rawText.slice(0, 200)}`)
    }

    const generatedImages = n8nJson.images as string[]
    const fullImageUrl = (n8nJson.full_image_url as string) || (n8nJson.generated_image_url as string) || null

    if (!Array.isArray(generatedImages) || generatedImages.length === 0) {
      throw new Error("n8n 响应未包含九宫格图片数组 (images)")
    }

    await prisma.generation.update({ where: { id: pending.id }, data: { generatedImages, generatedImage: fullImageUrl, status: "COMPLETED" } })

    const updatedUser = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true, bonusCredits: true } })

    return NextResponse.json({
      success: true,
      id: pending.id,
      generatedImages: generatedImages,
      credits: updatedUser?.credits ?? 0,
      bonusCredits: updatedUser?.bonusCredits ?? 0,
      totalCredits: (updatedUser?.credits ?? 0) + (updatedUser?.bonusCredits ?? 0),
    })
  } catch (err: any) {
    const message = err?.message || String(err)
    const errName = err?.name
    if (errName === "AbortError" || errName === "TimeoutError") {
      console.error("⏱️ N8N Response Timeout - 为用户退款")
    }

    console.error("❌ 生成 API 错误:", message)

    if (generationId) {
      await prisma.generation.update({ where: { id: generationId }, data: { status: "FAILED" } }).catch(() => { })
    }

    if (preDeducted) {
      console.log("🔄 准备执行退款...")
      try {
        if (userId) {
          await prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: userId },
              data: { bonusCredits: { increment: deductedBonus }, credits: { increment: deductedPaid } },
            })
            await tx.creditRecord.create({
              data: { userId, amount: actualCost, type: "REFUND", description: retryFromId ? "折扣重试失败退款" : "生成失败退款" },
            })
            if (retryFromId) {
              await tx.generation.update({ where: { id: retryFromId }, data: { hasUsedDiscountedRetry: false } })
            }
          })
          console.log(`💸 生成失败，已退款：bonus=${deductedBonus}，paid=${deductedPaid} 给用户 ${userId}`)
        }
      } catch (refundErr) {
        console.error("❌ 退款失败:", refundErr)
      }
    }

    return NextResponse.json({ error: "生成失败，积分已退回", message }, { status: 500 })
  }
}
