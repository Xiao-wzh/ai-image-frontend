import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { ProductType, ProductTypePromptKey, ProductTypeKey } from "@/lib/constants"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const GENERATION_COST = 199

function bufferToBase64(buf: ArrayBuffer) {
  return Buffer.from(buf).toString("base64")
}

// 提取多个图片文件（支持 images[] 字段）
function extractImageFiles(fd: FormData): File[] {
  const arr: File[] = []

  // 1. 优先获取 images 字段（多文件）
  const images = fd.getAll("images")
  images.forEach((v) => {
    if (v instanceof File) arr.push(v)
  })

  // 2. 兼容单文件字段 image / file
  const single = fd.get("image") || fd.get("file")
  if (single instanceof File && !arr.includes(single)) {
    arr.push(single)
  }

  return arr
}

export async function POST(req: NextRequest) {
  let generationId: string | null = null

  // 预扣费成功后，如果后续失败需要退款
  let preDeducted = false
  let remainingCreditsAfterDeduct: number | null = null

  try {
    // 必须登录
    const session = await auth()
    const userId = session?.user?.id || null
    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    // 先扣费（并发安全）：只有余额足够才会扣成功
    const deductResult = await prisma.user.updateMany({
      where: {
        id: userId,
        credits: { gte: GENERATION_COST },
      },
      data: {
        credits: { decrement: GENERATION_COST },
      },
    })

    if (deductResult.count === 0) {
      return NextResponse.json(
        { error: `余额不足（需要 ${GENERATION_COST} 积分），请充值` },
        { status: 402 },
      )
    }

    preDeducted = true

    const balanceRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    })
    remainingCreditsAfterDeduct = balanceRow?.credits ?? 0

    // 解析表单
    const form = await req.formData()

    const productName = String(form.get("productName") ?? "").trim()
    const rawType = String(form.get("productType") ?? "").trim()

    if (!productName) {
      return NextResponse.json({ error: "请填写商品名称" }, { status: 400 })
    }

    // 校验商品类型是否合法
    if (!Object.values(ProductType).includes(rawType as ProductTypeKey)) {
      return NextResponse.json({ error: "无效的商品类型" }, { status: 400 })
    }

    const productType = rawType as ProductTypeKey
    const imageFiles = extractImageFiles(form)

    if (imageFiles.length === 0) {
      return NextResponse.json({ error: "未检测到上传的图片文件" }, { status: 400 })
    }

    // 将所有图片转换为 Base64
    const imageBase64Array = await Promise.all(
      imageFiles.map(async (file) => {
        const arrayBuf = await file.arrayBuffer()
        return bufferToBase64(arrayBuf)
      }),
    )

    // 1) 创建 PENDING 记录（存储第一张图片）
    const pending = await prisma.generation.create({
      data: {
        userId,
        productName,
        productType,
        originalImage: imageBase64Array[0],
        status: "PENDING",
      },
    })
    generationId = pending.id

    console.log("📝 创建生成记录:", {
      id: pending.id,
      userId,
      productName,
      productType,
      cost: GENERATION_COST,
      remainingCredits: remainingCreditsAfterDeduct,
    })


    // 2) 查询 Prompt 模板（注意：model 是小驼峰）
    const promptRecord = await prisma.productTypePrompt.findUnique({ where: { productType } })
    if (!promptRecord) {
      await prisma.generation.update({ where: { id: pending.id }, data: { status: "FAILED" } })
      throw new Error("未找到对应商品类型的 Prompt 模板")
    }

    // 3) 调用 n8n Webhook
    const webhookUrl = process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook/nano-banana-yunwu"

    const requestBody = {
      product_name: productName,
      product_type: ProductTypePromptKey[productType],
      prompt_template: promptRecord.promptTemplate,
      images: imageBase64Array,
      image_count: imageBase64Array.length,
    }

    console.log("📤 发送到 n8n:", {
      product_name: productName,
      product_type: ProductTypePromptKey[productType],
      image_count: imageBase64Array.length,
      prompt_len: promptRecord.promptTemplate.length,
    })

    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })

    if (!n8nRes.ok) {
      const errorText = await n8nRes.text().catch(() => "")
      console.error("❌ n8n 返回错误:", n8nRes.status, n8nRes.statusText, errorText)
      throw new Error(`n8n 调用失败: ${n8nRes.status} ${n8nRes.statusText}`)
    }

    const n8nJson = (await n8nRes.json().catch(() => ({}))) as Record<string, unknown>

    const generatedImageUrl =
      (typeof n8nJson["generated_image_url"] === "string" && (n8nJson["generated_image_url"] as string)) ||
      (typeof n8nJson["data"] === "string" && (n8nJson["data"] as string)) ||
      null

    if (!generatedImageUrl) {
      throw new Error("n8n 响应未包含生成图片的 URL")
    }

    // 4) 更新记录为 COMPLETED
    const updated = await prisma.generation.update({
      where: { id: pending.id },
      data: {
        generatedImage: generatedImageUrl,
        status: "COMPLETED",
      },
    })

    // 5) 返回生成结果 + 最新余额
    return NextResponse.json({
      success: true,
      id: updated.id,
      status: updated.status,
      imageUrl: updated.generatedImage,
      generatedImage: updated.generatedImage, // 兼容前端旧字段
      remainingCredits: remainingCreditsAfterDeduct,
      cost: GENERATION_COST,
      productName: updated.productName,
      productType: updated.productType,
      createdAt: updated.createdAt,
    })
  } catch (err: any) {
    const message = err?.message || String(err)

    // 标记生成失败
    if (generationId) {
      try {
        await prisma.generation.update({ where: { id: generationId }, data: { status: "FAILED" } })
      } catch {}
    }

    // 失败退款（仅当已经预扣费）
    if (preDeducted) {
      try {
        const session = await auth()
        const userId = session?.user?.id
        if (userId) {
          const refunded = await prisma.user.update({
            where: { id: userId },
            data: { credits: { increment: GENERATION_COST } },
            select: { credits: true },
          })
          console.log("💸 生成失败，已退款:", { userId, refund: GENERATION_COST, credits: refunded.credits })
        }
      } catch (refundErr) {
        console.error("❌ 退款失败:", refundErr)
      }
    }

    return NextResponse.json(
      { error: "生成失败，积分已退回", message },
      { status: 500 },
    )
  }
}
