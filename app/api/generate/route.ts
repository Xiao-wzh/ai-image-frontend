import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { ProductTypePromptKey, ProductTypeKey } from "@/lib/constants"
import "dotenv/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GENERATION_COST = 199

export async function POST(req: NextRequest) {
  console.log("🔥 API HIT: /api/generate", Date.now())
  let generationId: string | null = null
  let preDeducted = false

  // 记录本次实际扣减的两类积分，用于失败精确退款
  let deductedBonus = 0
  let deductedPaid = 0

  const session = await auth()
  const userId = session?.user?.id || null
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    // 1) 读取并校验 JSON body
    const body = await req.json().catch(() => null)

    const productName = String(body?.productName ?? "").trim()
    const productType = String(body?.productType ?? "").trim() as ProductTypeKey
    const platformKey = String(body?.platformKey ?? "SHOPEE").trim().toUpperCase()
    const rawImages = body?.images

    if (!productName) throw new Error("请填写商品名称")
    if (!productType) throw new Error("请选择商品类型")

    let imageUrls: string[] = []

    if (Array.isArray(rawImages)) {
      imageUrls = rawImages.map((x) => String(x).trim()).filter(Boolean)
    } else if (typeof rawImages === "string") {
      try {
        const parsed = JSON.parse(rawImages)
        if (Array.isArray(parsed)) {
          imageUrls = parsed.map((x) => String(x).trim()).filter(Boolean)
        } else if (rawImages.trim()) {
          imageUrls = [rawImages.trim()]
        }
      } catch {
        if (rawImages.trim()) imageUrls = [rawImages.trim()]
      }
    } else if (rawImages && typeof rawImages === "object") {
      imageUrls = Object.values(rawImages)
        .map((x) => String(x).trim())
        .filter(Boolean)
    }

    if (imageUrls.length === 0) {
      throw new Error("请至少上传 1 张图片")
    }

    // 2) 原子扣费（并发安全） + 写入扣费流水
    const deductResult = await prisma.$transaction(async (tx) => {
      // 使用 SELECT FOR UPDATE 锁定用户行，防止并发扣费问题
      const userRows = await tx.$queryRaw<Array<{ credits: number; bonusCredits: number }>>
        `SELECT "credits", "bonusCredits" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
      
      const userRow = userRows[0]
      if (!userRow) {
        return { ok: false as const, status: 404 as const, error: "用户不存在" }
      }

      const totalCredits = (userRow.credits ?? 0) + (userRow.bonusCredits ?? 0)
      if (totalCredits < GENERATION_COST) {
        return {
          ok: false as const,
          status: 402 as const,
          error: `余额不足 (需要 ${GENERATION_COST} 积分，当前 ${totalCredits})，请充值`,
        }
      }

      const deductBonus = Math.min(userRow.bonusCredits || 0, GENERATION_COST)
      const deductPaid = GENERATION_COST - deductBonus

      await tx.user.update({
        where: { id: userId },
        data: {
          bonusCredits: { decrement: deductBonus },
          credits: { decrement: deductPaid },
        },
      })

      await tx.creditRecord.create({
        data: {
          userId,
          amount: -GENERATION_COST,
          type: "CONSUME",
          description: `生成图片: ${productName}`,
        },
      })

      return { ok: true as const, deductBonus, deductPaid }
    })

    if (!deductResult.ok) {
      return NextResponse.json({ error: deductResult.error }, { status: deductResult.status })
    }

    preDeducted = true
    deductedBonus = deductResult.deductBonus
    deductedPaid = deductResult.deductPaid

    // 3) 创建 PENDING 记录
    const pending = await prisma.generation.create({
      data: {
        userId,
        productName,
        productType,
        originalImage: imageUrls, // 直接存储 URL 数组
        status: "PENDING",
      },
    })
    generationId = pending.id

    // 4) 查询 Prompt
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

    // 5) 调用 n8n Webhook
    const webhookUrl = process.env.N8N_GRSAI_WEBHOOK_URL
    if (!webhookUrl) throw new Error("N8N_GRSAI_WEBHOOK_URL 未配置")

    const n8nPayload = {
      generation_id: generationId,
      product_name: productName,
      product_type: ProductTypePromptKey[productType] || productType,
      prompt_template: promptRecord.promptTemplate,
      images: imageUrls,
      image_count: imageUrls.length,
    }

    // 记录请求 n8n 的日志
    console.log(
      `[N8N_REQUEST] User: ${userId} (${session?.user?.username || "沒有username"}), Payload: `,
      JSON.stringify(n8nPayload, null, 2),
    )

    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nPayload),
    })

    if (!n8nRes.ok) {
      const errorText = await n8nRes.text().catch(() => "")
      throw new Error(`n8n 调用失败: ${n8nRes.status} ${n8nRes.statusText} - ${errorText}`)
    }

    const n8nJson = await n8nRes.json()
    const generatedImages = n8nJson.images as string[]
    const fullImageUrl = (n8nJson.full_image_url as string) || (n8nJson.generated_image_url as string) || null

    if (!Array.isArray(generatedImages) || generatedImages.length === 0) {
      throw new Error("n8n 响应未包含九宫格图片数组 (images)")
    }

    // 6) 更新记录为 COMPLETED
    await prisma.generation.update({
      where: { id: pending.id },
      data: {
        generatedImages,
        generatedImage: fullImageUrl,
        status: "COMPLETED",
      },
    })

    // 7) 返回成功响应
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true, bonusCredits: true },
    })

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
    console.error("❌ 生成 API 错误:", message)

    if (generationId) {
      await prisma.generation.update({ where: { id: generationId }, data: { status: "FAILED" } }).catch(() => {})
    }

    if (preDeducted) {
      try {
        if (userId) {
          await prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: userId },
              data: {
                bonusCredits: { increment: deductedBonus },
                credits: { increment: deductedPaid },
              },
            })
            await tx.creditRecord.create({
              data: {
                userId,
                amount: GENERATION_COST,
                type: "REFUND",
                description: "生成失败退款",
              },
            })
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
