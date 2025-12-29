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

  // 记录本次实际扣减的两类积分，用于失败精确退款
  let deductedBonus = 0
  let deductedPaid = 0

  const session = await auth()
  const userId = session?.user?.id || null
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  let productNameForRecord = ""

  try {
    // 0) 先解析表单（用于写流水：生成图片: [Product Name]）
    const form = await req.formData()
    const productName = String(form.get("productName") ?? "").trim()
    const rawType = String(form.get("productType") ?? "").trim()

    // 新增：平台参数（数据库驱动，前端传 platformKey，默认 SHOPEE）
    const platformKey = String(form.get("platformKey") ?? form.get("platform") ?? "SHOPEE")
      .trim()
      .toUpperCase()

    if (!productName) throw new Error("请填写商品名称")
    // if (!Object.values(ProductType).includes(rawType as ProductTypeKey)) {
    //   throw new Error("无效的商品类型")
    // }
    productNameForRecord = productName

    const productType = rawType as ProductTypeKey
    const imageFiles = extractImageFiles(form)
    if (imageFiles.length === 0) throw new Error("未检测到上传的图片文件")

    const imageBase64Array = await Promise.all(
      imageFiles.map(async (file) => {
        const arrayBuf = await file.arrayBuffer()
        return bufferToBase64(arrayBuf)
      }),
    )

    // 1) 原子扣费（并发安全） + 写入扣费流水
    // 采用 PostgreSQL 行级锁：SELECT ... FOR UPDATE
    // 在同一事务内：读取余额 -> 计算扣减（bonus优先）-> 扣减 -> 写入流水（amount=-cost）
    const deductResult = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ credits: number; bonusCredits: number }>>
        `SELECT "credits", "bonusCredits" FROM "User" WHERE "id" = ${userId} FOR UPDATE`

      if (rows.length === 0) {
        return { ok: false as const, status: 404 as const, error: "用户不存在" }
      }

      const credits = rows[0].credits ?? 0
      const bonusCredits = rows[0].bonusCredits ?? 0
      const total = credits + bonusCredits

      if (total < GENERATION_COST) {
        return {
          ok: false as const,
          status: 402 as const,
          error: `余额不足 (需要 ${GENERATION_COST} 积分，当前 ${total})，请充值`,
        }
      }

      const deductBonus = Math.min(bonusCredits, GENERATION_COST)
      const deductPaid = GENERATION_COST - deductBonus

      await tx.user.update({
        where: { id: userId },
        data: {
          bonusCredits: deductBonus > 0 ? { decrement: deductBonus } : undefined,
          credits: deductPaid > 0 ? { decrement: deductPaid } : undefined,
        },
      })

      // 用户可见流水只记录总变动
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

    // 2) 扣费后读一次余额用于返回
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true, bonusCredits: true },
    })

    const creditsNow = updatedUser?.credits ?? 0
    const bonusNow = updatedUser?.bonusCredits ?? 0
    const totalNow = creditsNow + bonusNow

    // 3) 创建 PENDING 记录
    const pending = await prisma.generation.create({
      data: {
        userId,
        productName,
        productType,
        originalImage: "",
        status: "PENDING",
      },
    })
    generationId = pending.id

    // 4) 查询 Prompt（数据库平台关联 + GENERAL 兜底）
    // 优先级：
    // 1) 当前平台 + 用户私有(userId)
    // 2) 当前平台 + 系统(userId=null)
    // 3) GENERAL 平台 + 系统(userId=null)

    const promptRecord =
      (await prisma.productTypePrompt.findFirst({
        where: {
          isActive: true,
          productType,
          userId,
          platform: {
            key: platformKey,
          },
        },
        include: { platform: true },
        orderBy: { updatedAt: "desc" },
      })) ||
      (await prisma.productTypePrompt.findFirst({
        where: {
          isActive: true,
          productType,
          userId: null,
          platform: {
            key: platformKey,
          },
        },
        include: { platform: true },
        orderBy: { updatedAt: "desc" },
      })) ||
      (await prisma.productTypePrompt.findFirst({
        where: {
          isActive: true,
          productType,
          userId: null,
          platform: {
            key: "GENERAL",
          },
        },
        include: { platform: true },
        orderBy: { updatedAt: "desc" },
      }))

    if (!promptRecord) {
      throw new Error(`未找到 Prompt 模板：platformKey=${platformKey}, productType=${productType}`)
    }

    // 5) 调用 n8n Webhook
    const webhookUrl = process.env.N8N_WEBHOOK_URL
    if (!webhookUrl) throw new Error("N8N_WEBHOOK_URL 未配置")

    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_name: productName,
        
        // ✅ 修复 1：不再查常量表，直接传字符串
        // 这样新加的类型（如 "KIDS"）也能原样传过去
        product_type: productType, 

        // ✅ 修复 2：补上你想要的 platform 参数
        platform: platformKey,

        // ✅ 修复 3：补上 description 参数
        // description: description,

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

    // 6) 解析 n8n 响应
    const generatedImages = n8nJson.images as string[]
    const fullImageUrl = (n8nJson.full_image_url as string) || (n8nJson.generated_image_url as string) || null

    if (!Array.isArray(generatedImages) || generatedImages.length === 0) {
      throw new Error("n8n 响应未包含九宫格图片数组 (images)")
    }

    // 7) 更新记录为 COMPLETED
    const updated = await prisma.generation.update({
      where: { id: pending.id },
      data: {
        generatedImages: generatedImages,
        generatedImage: fullImageUrl,
        status: "COMPLETED",
      },
    })

    // 8) 返回成功响应
    return NextResponse.json({
      success: true,
      id: updated.id,
      generatedImages: updated.generatedImages,
      credits: creditsNow,
      bonusCredits: bonusNow,
      totalCredits: totalNow,
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

    // 失败退款（按扣费来源精确退回）+ 写入退款流水
    if (preDeducted) {
      try {
        if (userId) {
          const updateData: any = {}
          if (deductedBonus > 0) updateData.bonusCredits = { increment: deductedBonus }
          if (deductedPaid > 0) updateData.credits = { increment: deductedPaid }

          await prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: userId },
              data: updateData,
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
