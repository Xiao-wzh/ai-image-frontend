import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { ProductType, ProductTypePromptKey, ProductTypeKey } from "@/lib/constants"
import "dotenv/config"


export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GENERATION_COST = 199

function bufferToBase64(buf: ArrayBuffer) {
  return Buffer.from(buf).toString("base64")
}

function extractImageFiles(fd: FormData): File[] {
  const arr: File[] = []
  const images = fd.getAll("images")
  images.forEach((v) => {
    if (v instanceof File) arr.push(v)
  })
  const single = fd.get("image") || fd.get("file")
  if (single instanceof File && !arr.includes(single)) {
    arr.push(single)
  }
  return arr
}

export async function POST(req: NextRequest) {
  let generationId: string | null = null
  let preDeducted = false

  const session = await auth()
  const userId = session?.user?.id || null
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    // 1. 预扣费 (原子操作)
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
        { error: `余额不足 (需要 ${GENERATION_COST} 积分)，请充值` },
        { status: 402 }
      )
    }
    preDeducted = true

    const balanceRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    })
    const remainingCreditsAfterDeduct = balanceRow?.credits ?? 0

    // 2. 解析表单
    const form = await req.formData()
    const productName = String(form.get("productName") ?? "").trim()
    const rawType = String(form.get("productType") ?? "").trim()
    if (!productName) throw new Error("请填写商品名称")
    if (!Object.values(ProductType).includes(rawType as ProductTypeKey)) {
      throw new Error("无效的商品类型")
    }
    const productType = rawType as ProductTypeKey
    const imageFiles = extractImageFiles(form)
    if (imageFiles.length === 0) throw new Error("未检测到上传的图片文件")

    const imageBase64Array = await Promise.all(
      imageFiles.map(async (file) => {
        const arrayBuf = await file.arrayBuffer()
        return bufferToBase64(arrayBuf)
      })
    )

    // 3. 创建 PENDING 记录
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

    // 4. 查询 Prompt
    const promptRecord = await prisma.productTypePrompt.findUnique({ where: { productType } })
    if (!promptRecord) throw new Error("未找到对应商品类型的 Prompt 模板")

    // 5. 调用 n8n Webhook
    const webhookUrl = process.env.N8N_WEBHOOK_URL
    if (!webhookUrl) throw new Error("N8N_WEBHOOK_URL 未配置")

    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_name: productName,
        product_type: ProductTypePromptKey[productType],
        prompt_template: promptRecord.promptTemplate,
        images: imageBase64Array,
        image_count: imageBase64Array.length,
      }),
    })

    if (!n8nRes.ok) {
      const errorText = await n8nRes.text().catch(() => "")
      throw new Error(`n8n 调用失败: ${n8nRes.status} ${n8nRes.statusText} - ${errorText}`)
    }

    const n8nJson = await n8nRes.json()

    // 6. 解析 n8n 响应
    const generatedImages = n8nJson.images as string[]
    const fullImageUrl = (n8nJson.full_image_url as string) || (n8nJson.generated_image_url as string) || null

    if (!Array.isArray(generatedImages) || generatedImages.length === 0) {
      throw new Error("n8n 响应未包含九宫格图片数组 (images)")
    }

    // 7. 更新记录为 COMPLETED
    const updated = await prisma.generation.update({
      where: { id: pending.id },
      data: {
        generatedImages: generatedImages,
        generatedImage: fullImageUrl,
        status: "COMPLETED",
      },
    })

    // 8. 返回成功响应
    return NextResponse.json({
      success: true,
      id: updated.id,
      generatedImages: updated.generatedImages,
      // fullImageUrl: updated.generatedImage,
      remainingCredits: remainingCreditsAfterDeduct,
    })

  } catch (err: any) {
    const message = err?.message || String(err)
    console.error("❌ 生成 API 错误:", message)

    // 标记生成失败
    if (generationId) {
      try {
        await prisma.generation.update({ where: { id: generationId }, data: { status: "FAILED" } })
      } catch {}
    }

    // 失败退款
    if (preDeducted) {
      try {
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: { credits: { increment: GENERATION_COST } },
          })
          console.log(`💸 生成失败，已退款: ${GENERATION_COST} 积分给用户 ${userId}`)
        }
      } catch (refundErr) {
        console.error("❌ 退款失败:", refundErr)
      }
    }

    return NextResponse.json(
      { error: "生成失败，积分已退回", message },
      { status: 500 }
    )
  }
}
