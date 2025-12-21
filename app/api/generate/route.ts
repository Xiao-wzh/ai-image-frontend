import { NextRequest, NextResponse } from "next/server"
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
        productName,
        productType,
        originalImage: imageBase64Array[0], // 数据库只存第一张作为代表
        status: "PENDING",
      },
    })
    generationId = pending.id

    
    
    // 2) 查询 Prompt 模板
    console.log("查询商品类型：" + productType + " 的 Prompt 模板");
    
    const promptRecord = await prisma.ProductTypePrompt.findUnique({ where: { productType } })
    console.log("查询到的 Prompt 模板：" + promptRecord?.promptTemplate);
    
    // 若未配置 Prompt，返回错误
    if (!promptRecord) {
      await prisma.generation.update({ where: { id: pending.id }, data: { status: "FAILED" } })
      return NextResponse.json({ error: "未找到对应商品类型的 Prompt 模板" }, { status: 500 })
    }
    console.log("开始调用 n8n");
    // 3) 调用 n8n Webhook（发送所有图片）
    const webhookUrl = process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook/nano-banana-yunwu"
    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_name: productName,
        product_type: ProductTypePromptKey[productType],
        prompt_template: promptRecord.promptTemplate,
        images: imageBase64Array, // 发送所有图片的 Base64 数组
        image_count: imageBase64Array.length, // 图片数量
      }),
    })

    console.log("n8n 调用完成");
    console.log(n8nRes);
    console.log(n8nRes.ok);
    if (!n8nRes.ok) {
      const txt = await n8nRes.text().catch(() => "")
      // 失败即更新为失败状态
      await prisma.generation.update({ where: { id: pending.id }, data: { status: "FAILED" } })
      return NextResponse.json(
        { error: `n8n 调用失败: ${n8nRes.status} ${n8nRes.statusText}`, details: txt },
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

    // 3) 更新记录为已完成
    const updated = await prisma.generation.update({
      where: { id: pending.id },
      data: {
        generatedImage: generatedImageUrl,
        status: "COMPLETED",
      },
    })

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

