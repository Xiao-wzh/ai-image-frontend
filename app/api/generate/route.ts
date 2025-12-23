import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { ProductType, ProductTypePromptKey, ProductTypeKey } from "@/lib/constants"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
  try {
    // 获取用户 ID（如果已登录）
    const session = await auth()
    const userId = session?.user?.id || null
    
    // 检查用户积分（需要 199 积分）
    const GENERATION_COST = 199
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      })
      
      if (!user || user.credits < GENERATION_COST) {
        return NextResponse.json(
          { error: `余额不足（需要 ${GENERATION_COST} 积分），请充值` },
          { status: 402 }
        )
      }
    }
    
    const form = await req.formData()

    const productName = String(form.get("productName") ?? "").trim()
    const rawType = String(form.get("productType") ?? "").trim()
    
    // 校验商品类型是否合法
    if (!Object.values(ProductType).includes(rawType as ProductTypeKey)) {
      return NextResponse.json({ error: "无效的商品类型" }, { status: 400 })
    }
    const productType = rawType as ProductTypeKey
    const imageFiles = extractImageFiles(form)

    if (!productName || !productType) {
      return NextResponse.json({ error: "productName 与 productType 为必填" }, { status: 400 })
    }
    if (imageFiles.length === 0) {
      return NextResponse.json({ error: "未检测到上传的图片文件" }, { status: 400 })
    }

    // 将所有图片转换为 Base64
    const imageBase64Array = await Promise.all(
      imageFiles.map(async (file) => {
        const arrayBuf = await file.arrayBuffer()
        return bufferToBase64(arrayBuf)
      })
    )

    // 1) 创建待处理记录（存储第一张图片的 Base64）
    const pending = await prisma.generation.create({
      data: {
        userId: userId || null, // 保存用户 ID（支持匿名）
        productName,
        productType,
        originalImage: imageBase64Array[0], // 数据库只存第一张作为代表
        status: "PENDING",
      },
    })
    generationId = pending.id
    
    console.log("📝 创建生成记录:", {
      id: pending.id,
      userId: userId || "匿名",
      productName,
      productType,
    })

    
    
    // 2) 查询 Prompt 模板
    console.log("查询商品类型：" + productType + " 的 Prompt 模板");
    
    const promptRecord = await prisma.productTypePrompt.findUnique({ where: { productType } })
    console.log("查询到的 Prompt 模板：" + promptRecord?.promptTemplate);
    
    // 若未配置 Prompt，返回错误
    if (!promptRecord) {
      await prisma.generation.update({ where: { id: pending.id }, data: { status: "FAILED" } })
      return NextResponse.json({ error: "未找到对应商品类型的 Prompt 模板" }, { status: 500 })
    }
    console.log("开始调用 n8n");
    
    // 3) 调用 n8n Webhook（发送所有图片）
    const webhookUrl = process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook/nano-banana-yunwu"
    
    const requestBody = {
      product_name: productName,
      product_type: ProductTypePromptKey[productType],
      prompt_template: promptRecord.promptTemplate,
      images: imageBase64Array, // 发送所有图片的 Base64 数组
      image_count: imageBase64Array.length, // 图片数量
    }
    
    console.log("📤 发送到 n8n 的数据:")
    console.log("  - 商品名称:", productName)
    console.log("  - 商品类型:", ProductTypePromptKey[productType])
    console.log("  - 图片数量:", imageBase64Array.length)
    console.log("  - Prompt 长度:", promptRecord.promptTemplate.length, "字符")
    console.log("  - 第一张图片 Base64 长度:", imageBase64Array[0]?.length || 0, "字符")
    
    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })

    console.log("n8n 调用完成");
    console.log("状态码:", n8nRes.status);
    console.log("状态文本:", n8nRes.statusText);
    
    if (!n8nRes.ok) {
      const errorText = await n8nRes.text().catch(() => "无法读取错误信息")
      console.error("❌ n8n 错误详情:", errorText)
      
      // 尝试解析 JSON 错误
      let errorDetail = errorText
      try {
        const errorJson = JSON.parse(errorText)
        errorDetail = JSON.stringify(errorJson, null, 2)
        console.error("❌ n8n 错误 JSON:", errorJson)
      } catch {
        console.error("❌ n8n 错误文本:", errorText)
      }
      
      // 失败即更新为失败状态
      await prisma.generation.update({ where: { id: pending.id }, data: { status: "FAILED" } })
      return NextResponse.json(
        { 
          error: `n8n 调用失败: ${n8nRes.status} ${n8nRes.statusText}`, 
          details: errorDetail,
          hint: "请检查 n8n 工作流配置和日志"
        },
        { status: 502 },
      )
    }

    const n8nJson = (await n8nRes.json().catch(() => ({}))) as Record<string, unknown>
    console.log(n8nJson);
    console.log(typeof n8nJson["generated_image_url"]);
    console.log(typeof n8nJson["data"]);
    // 提取 n8n 返回的图片 URL（公网地址）
    const generatedImageUrl =
      (typeof n8nJson["generated_image_url"] === "string" && (n8nJson["generated_image_url"] as string)) ||
      (typeof n8nJson["data"] === "string" && (n8nJson["data"] as string)) ||
      null

    if (!generatedImageUrl) {
      await prisma.generation.update({ where: { id: pending.id }, data: { status: "FAILED" } })
      return NextResponse.json(
        { error: "n8n 响应未包含生成图片的 URL", debug: n8nJson },
        { status: 502 },
      )
    }

    // 3) 更新记录为已完成并扣除积分
    const transactions: any[] = [
      prisma.generation.update({
        where: { id: pending.id },
        data: {
          generatedImage: generatedImageUrl,
          status: "COMPLETED",
        },
      }),
    ]

    if (userId) {
      transactions.push(
        prisma.user.update({
          where: { id: userId },
          data: {
            credits: {
              decrement: GENERATION_COST,
            },
          },
        })
      )
    }

    const results = await prisma.$transaction(transactions)
    const updated = results[0]

    if (userId) {
      console.log(`💰 扣除积分: ${GENERATION_COST} for ${userId}`)
    }

    // 4) 返回生成结果
    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      generatedImage: updated.generatedImage,
      productName: updated.productName,
      productType: updated.productType,
      createdAt: updated.createdAt,
    })
  } catch (err: any) {
    const message = err?.message || String(err)
    if (generationId) {
      try {
        await prisma.generation.update({ where: { id: generationId }, data: { status: "FAILED" } })
      } catch {}
    }
    return NextResponse.json({ error: "服务器错误", message }, { status: 500 })
  }
}

