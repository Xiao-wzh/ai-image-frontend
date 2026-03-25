import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { ProductTypePromptKey, ProductTypeKey } from "@/lib/constants"
import { getSystemCosts } from "@/lib/system-config"
import type { SystemCostConfig } from "@/lib/types/config"
import { toCdnUrlArray, extractObjectKey, keyToCdnUrl } from "@/lib/cdnUrl"
import { refundCredits } from "@/lib/credit-service"
import { compilePrompt } from "@/lib/prompt-compiler"
import "dotenv/config"


// Transaction client type
type TxClient = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Get cost based on task type (using dynamic costs)
function getStandardCost(taskType: string, costs: SystemCostConfig): number {
  return taskType === "DETAIL_PAGE" ? costs.DETAIL_PAGE_STANDARD_COST : costs.MAIN_IMAGE_STANDARD_COST
}

function getRetryCost(taskType: string, costs: SystemCostConfig): number {
  return taskType === "DETAIL_PAGE" ? costs.DETAIL_PAGE_RETRY_COST : costs.MAIN_IMAGE_RETRY_COST
}

// Helper: Fill prompt template with variables (legacy wrapper → delegates to compilePrompt)
function fillPromptTemplate(
  template: string,
  productName: string,
  language: string,
  detailBatch: string,
  features?: string,
  refImageCount?: number,
  proFeatures?: string,
  proStyle?: string,
  imageCount?: number,
  aspectRatio?: string,
  originalImageCount?: number,
): string {
  return compilePrompt(template, {
    productName,
    language,
    detailBatch,
    features: features || "",
    numberOfReferenceImages: refImageCount || 0,
    originalImageCount: originalImageCount || 0,
    proFeatures: proFeatures || null,
    proStyle: proStyle || null,
    imageCount: imageCount || 9,
    aspectRatio: aspectRatio || "1:1",
  })
}

// Helper: Call N8N with timeout
async function callN8N(
  webhookUrl: string,
  payload: any,
  timeoutMs: number
): Promise<{ success: true; images: string[]; fullImageUrl: string | null } | { success: false; error: string }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      console.log(webhookUrl);

      return { success: false, error: `n8n 调用失败: ${res.status} ${res.statusText}` }
    }

    const rawText = await res.text()
    if (!rawText) {
      return { success: false, error: "n8n 响应为空" }
    }

    let json: any
    try {
      json = JSON.parse(rawText)
    } catch {
      return { success: false, error: `n8n 响应不是有效 JSON` }
    }

    const images = json.images as string[]
    const fullImageUrl = (json.full_image_url as string) || (json.generated_image_url as string) || null

    if (!Array.isArray(images) || images.length === 0) {
      return { success: false, error: "n8n 响应未包含图片数组" }
    }

    return { success: true, images, fullImageUrl }
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return { success: false, error: "N8N 请求超时" }
    }
    return { success: false, error: err?.message || String(err) }
  } finally {
    clearTimeout(timeoutId)
  }
}

// 本地退款包装器：自带 $transaction（用于非事务上下文的退款场景）
async function refundCreditsStandalone(
  userId: string,
  amount: number,
  description: string
): Promise<void> {
  await prisma.$transaction(async (tx: TxClient) => {
    await refundCredits(tx, userId, amount, description)
  })
}

export async function POST(req: NextRequest) {
  // Fetch dynamic costs from database
  const costs = await getSystemCosts()

  const session = await auth()
  const userId = session?.user?.id || null
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  // Parse body
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: "无效请求" }, { status: 400 })
  }

  const retryFromId = body?.retryFromId as string | undefined
  const withDetailCombo = Boolean(body?.withDetailCombo)

  console.log(`[生图API] 收到请求 - 重试ID: ${retryFromId || '无'}, 组合模式: ${withDetailCombo}`)

  // =============================================
  // COMBO MODE: Main Image + Detail Page in Parallel
  // =============================================
  if (withDetailCombo && !retryFromId) {
    return handleComboGeneration(body, userId, session, costs)
  }

  // =============================================
  // SINGLE TASK MODE (existing logic)
  // =============================================
  return handleSingleGeneration(body, userId, session, costs, retryFromId)
}

// =============================================
// COMBO GENERATION HANDLER
// =============================================
async function handleComboGeneration(
  body: any,
  userId: string,
  session: any,
  costs: SystemCostConfig
) {
  // Parse input
  const productName = String(body?.productName ?? "").trim()
  const productType = String(body?.productType ?? "").trim() as ProductTypeKey
  const platformKey = String(body?.platformKey ?? "SHOPEE").trim().toUpperCase()
  const outputLanguage = String(body?.outputLanguage ?? "简体中文").trim()
  const rawImages = body?.images
  const comboRequestId = body?.requestId as string | undefined

  // 幂等性检查：如果提供了 requestId，检查套餐记录是否已存在
  if (comboRequestId) {
    const existingCombo = await prisma.generation.findFirst({
      where: { requestId: comboRequestId, userId },
      select: { id: true, status: true },
    })
    if (existingCombo) {
      console.log(`[套餐] 重复请求，跳过: ${comboRequestId}`)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true, bonusCredits: true },
      })
      return NextResponse.json({
        success: true,
        isCombo: true,
        isDuplicate: true,
        results: [],
        credits: user?.credits ?? 0,
        bonusCredits: user?.bonusCredits ?? 0,
        message: "重复请求，已忽略",
      })
    }
  }

  // Validation
  if (!productName) {
    return NextResponse.json({ error: "请填写商品名称" }, { status: 400 })
  }
  if (!productType) {
    return NextResponse.json({ error: "请选择商品类型" }, { status: 400 })
  }

  // Parse images
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
  }

  if (imageUrls.length === 0) {
    return NextResponse.json({ error: "请至少上传 1 张图片" }, { status: 400 })
  }

  // Calculate combo cost
  const mainImageCost = costs.MAIN_IMAGE_STANDARD_COST
  const detailPageCost = costs.DETAIL_PAGE_RETRY_COST // Discounted detail page for combo
  const comboCost = mainImageCost + detailPageCost

  console.log(`[套餐] 总费用: ${comboCost}积分 (主图${mainImageCost}+详情页${detailPageCost})`)

  // Check concurrency for both task types
  const [mainPendingCount, detailPendingCount] = await Promise.all([
    prisma.generation.count({
      where: { userId, taskType: "MAIN_IMAGE", status: { in: ["PENDING", "PROCESSING"] } },
    }),
    prisma.generation.count({
      where: { userId, taskType: "DETAIL_PAGE", status: { in: ["PENDING", "PROCESSING"] } },
    }),
  ])

  if (mainPendingCount >= 3) {
    return NextResponse.json(
      { error: `您当前有 ${mainPendingCount} 个主图任务正在进行中，请等待完成后再提交（最多同时 3 个）` },
      { status: 429 }
    )
  }
  if (detailPendingCount >= 3) {
    return NextResponse.json(
      { error: `您当前有 ${detailPendingCount} 个详情页任务正在进行中，请等待完成后再提交（最多同时 3 个）` },
      { status: 429 }
    )
  }

  // Deduct credits atomically
  const deductResult = await prisma.$transaction(async (tx: TxClient) => {
    const userRow = await tx.user.findUnique({
      where: { id: userId },
      select: { credits: true, bonusCredits: true },
    })
    if (!userRow) {
      return { ok: false as const, status: 404, error: "用户不存在" }
    }

    const totalCredits = (userRow.credits ?? 0) + (userRow.bonusCredits ?? 0)
    if (totalCredits < comboCost) {
      return {
        ok: false as const,
        status: 402,
        error: `余额不足 (套餐需要 ${comboCost} 积分，当前 ${totalCredits})`,
      }
    }

    const deductBonus = Math.min(userRow.bonusCredits || 0, comboCost)
    const deductPaid = comboCost - deductBonus

    await tx.user.update({
      where: { id: userId },
      data: { bonusCredits: { decrement: deductBonus }, credits: { decrement: deductPaid } },
    })

    await tx.creditRecord.create({
      data: {
        userId,
        amount: -comboCost,
        type: "CONSUME",
        description: `套餐生成: ${productName} (主图+详情页)`,
      },
    })

    console.log(`[套餐] 扣费成功: ${comboCost}积分 (赠送${deductBonus}, 付费${deductPaid})`)
    return { ok: true as const, deductBonus, deductPaid }
  })

  if (!deductResult.ok) {
    return NextResponse.json({ error: deductResult.error }, { status: deductResult.status })
  }

  // Create two Generation records
  const [mainGen, detailGen] = await Promise.all([
    prisma.generation.create({
      data: {
        requestId: comboRequestId || null, // 保存幂等键，防止网络重试时重复创建
        userId,
        productName,
        productType,
        platformKey,
        taskType: "MAIN_IMAGE",
        mode: "CREATIVE",
        qualityMode: "STANDARD",
        originalImage: imageUrls,
        status: "PENDING",
        isWatermarkUnlocked: true, // Combo bonus: auto-unlock watermark
        outputLanguage,
        costPerImage: 0, // 套餐按次计费，不按张计费
        totalCost: mainImageCost,
        imageCount: 9, // 套餐固定生成9张，用于申诉退款计算
      },
    }),
    prisma.generation.create({
      data: {
        userId,
        productName,
        productType,
        platformKey,
        taskType: "DETAIL_PAGE",
        mode: "CREATIVE",
        qualityMode: "STANDARD",
        originalImage: imageUrls,
        status: "PENDING",
        isWatermarkUnlocked: true, // Bonus: auto-unlock watermark for combo
        outputLanguage,
        requestId: comboRequestId ? `${comboRequestId}_detail` : null, // 加后缀区分，因为 requestId 字段有唯一约束
        costPerImage: 0, // 套餐按次计费，不按张计费
        totalCost: detailPageCost,
        imageCount: 9, // 套餐固定生成9张，用于申诉退款计算
      },
    }),
  ])

  console.log(`[套餐] 创建成功: 主图=${mainGen.id}, 详情页=${detailGen.id}`)

  // Fetch prompt templates for both
  // 先查询平台 ID
  const platform = await prisma.platform.findFirst({
    where: { key: platformKey },
    select: { id: true },
  })
  const platformId = platform?.id

  const [mainPrompt, detailPrompt] = await Promise.all([
    // 主图：仅使用创意模式提示词（不允许落到克隆模式）
    prisma.productTypePrompt.findFirst({
      where: { isActive: true, platformId, productType, taskType: "MAIN_IMAGE", mode: "CREATIVE", qualityMode: "STANDARD", userId: null },
      orderBy: { updatedAt: "desc" },
    }),
    // 详情页（套餐勾选）：多步骤 fallback
    // Step 1: 同平台 + 同商品类型 + STANDARD 模式
    (async () => {
      let prompt = await prisma.productTypePrompt.findFirst({
        where: { isActive: true, platformId, productType, taskType: "DETAIL_PAGE", mode: "CREATIVE", qualityMode: "STANDARD", userId: null },
        orderBy: { updatedAt: "desc" },
      })
      if (prompt) return prompt

      // Step 2: 同平台 + 同商品类型 + PRO 模式
      prompt = await prisma.productTypePrompt.findFirst({
        where: { isActive: true, platformId, productType, taskType: "DETAIL_PAGE", mode: "CREATIVE", qualityMode: "PRO", userId: null },
        orderBy: { updatedAt: "desc" },
      })
      if (prompt) return prompt

      // Step 3: 同平台 + 任意商品类型 + STANDARD 模式
      prompt = await prisma.productTypePrompt.findFirst({
        where: { isActive: true, platformId, taskType: "DETAIL_PAGE", mode: "CREATIVE", qualityMode: "STANDARD", userId: null },
        orderBy: { updatedAt: "desc" },
      })
      if (prompt) return prompt

      // Step 4: 同平台 + 任意商品类型 + PRO 模式
      prompt = await prisma.productTypePrompt.findFirst({
        where: { isActive: true, platformId, taskType: "DETAIL_PAGE", mode: "CREATIVE", qualityMode: "PRO", userId: null },
        orderBy: { updatedAt: "desc" },
      })
      if (prompt) return prompt

      // Step 5: 任意平台 + 同商品类型 + STANDARD 模式
      prompt = await prisma.productTypePrompt.findFirst({
        where: { isActive: true, productType, taskType: "DETAIL_PAGE", mode: "CREATIVE", qualityMode: "STANDARD", userId: null },
        orderBy: { updatedAt: "desc" },
      })
      if (prompt) return prompt

      // Step 6: 任意平台 + 同商品类型 + PRO 模式
      prompt = await prisma.productTypePrompt.findFirst({
        where: { isActive: true, productType, taskType: "DETAIL_PAGE", mode: "CREATIVE", qualityMode: "PRO", userId: null },
        orderBy: { updatedAt: "desc" },
      })
      if (prompt) return prompt

      // Step 7: 任意平台 + 任意商品类型 + STANDARD 模式
      prompt = await prisma.productTypePrompt.findFirst({
        where: { isActive: true, taskType: "DETAIL_PAGE", mode: "CREATIVE", qualityMode: "STANDARD", userId: null },
        orderBy: { updatedAt: "desc" },
      })
      if (prompt) return prompt

      // Step 8: 任意平台 + 任意商品类型 + PRO 模式
      prompt = await prisma.productTypePrompt.findFirst({
        where: { isActive: true, taskType: "DETAIL_PAGE", mode: "CREATIVE", qualityMode: "PRO", userId: null },
        orderBy: { updatedAt: "desc" },
      })
      return prompt
    })(),
  ])

  // If prompt is missing, fail the corresponding task and refund
  const results: Array<{ taskType: string; id: string; status: "COMPLETED" | "FAILED"; error?: string }> = []

  // Select webhook URL based on prompt content
  // If main image prompt starts with "你是", use AUTO webhook, otherwise use GRSAI webhook
  const mainWebhookUrl = mainPrompt?.promptTemplate?.startsWith("你是") || mainPrompt?.promptTemplate?.startsWith("Role")
    ? process.env.N8N_AUTO_WEBHOOK_URL
    : process.env.N8N_GRSAI_WEBHOOK_URL
  const detailWebhookUrl = process.env.N8N_DETAIL_WEBHOOK_URL

  // Prepare tasks
  const tasks: Array<{
    taskType: "MAIN_IMAGE" | "DETAIL_PAGE"
    generationId: string
    webhookUrl: string | undefined
    prompt: any
    cost: number
    timeoutMs: number
  }> = []

  if (mainPrompt && mainWebhookUrl) {
    tasks.push({
      taskType: "MAIN_IMAGE",
      generationId: mainGen.id,
      webhookUrl: mainWebhookUrl,
      prompt: mainPrompt,
      cost: mainImageCost,
      timeoutMs: 360_000,
    })
  } else {
    // Mark as failed and refund immediately
    await prisma.generation.update({ where: { id: mainGen.id }, data: { status: "FAILED" } })
    await refundCreditsStandalone(userId, mainImageCost, "套餐主图生成失败退款 (缺少模板或配置)")
    results.push({ taskType: "MAIN_IMAGE", id: mainGen.id, status: "FAILED", error: "缺少主图模板或 Webhook 配置" })
  }

  if (detailPrompt && detailWebhookUrl) {
    // Update detail generation with actual productType from the prompt
    if (detailPrompt.productType && detailPrompt.productType !== productType) {
      await prisma.generation.update({
        where: { id: detailGen.id },
        data: { productType: detailPrompt.productType },
      })
      console.log(`[套餐] 更新详情页类型: ${productType} -> ${detailPrompt.productType}`)
    }

    tasks.push({
      taskType: "DETAIL_PAGE",
      generationId: detailGen.id,
      webhookUrl: detailWebhookUrl,
      prompt: detailPrompt,
      cost: detailPageCost,
      timeoutMs: 600_000,
    })
  } else {
    await prisma.generation.update({ where: { id: detailGen.id }, data: { status: "FAILED" } })
    await refundCreditsStandalone(userId, detailPageCost, "套餐详情页生成失败退款 (缺少模板或配置)")
    results.push({ taskType: "DETAIL_PAGE", id: detailGen.id, status: "FAILED", error: "缺少详情页模板或 Webhook 配置" })
  }

  // 异步触发所有任务（fire-and-forget），与 STANDARD/PRO 保持一致
  // 结果由 n8n 回调 /api/webhook/n8n → BullMQ Worker 写入 DB
  if (tasks.length > 0) {
    const username = (session?.user as any)?.username ?? (session?.user as any)?.name ?? null

    for (const task of tasks) {
      const referenceLayoutImages = task.prompt.referenceImages ?? []
      const filledPrompt = fillPromptTemplate(
        task.prompt.promptTemplate,
        productName,
        outputLanguage,
        task.prompt.detailBatch,
        "",  // features
        referenceLayoutImages.length,  // 传递参考图片数量
        undefined,  // proFeatures
        undefined,  // proStyle
        undefined,  // imageCount
        undefined,  // aspectRatio
        imageUrls.length,  // 传递用户上传的原始图片数量
      )

      // 构建 images 数组：如果提示词中使用了参考图片数量变量，则拼接参考图片 URL
      let imagesArray = imageUrls

      // 检查原始提示词模板中是否包含 numberOfReferenceImages 变量，如果有且参考图片不为空，则拼接参考图片 URL
      if (referenceLayoutImages.length > 0 && task.prompt.promptTemplate.includes("numberOfReferenceImages")) {
        imagesArray = [...imagesArray, ...referenceLayoutImages]
      }

      const payload = {
        username,
        generation_id: task.generationId,
        product_name: productName,
        product_type: ProductTypePromptKey[productType] || productType,
        prompt_template: filledPrompt,
        images: imagesArray,
        image_count: imagesArray.length,
        output_language: outputLanguage,
      }

      // 更新状态为 PROCESSING
      await prisma.generation.update({
        where: { id: task.generationId },
        data: { status: "PROCESSING" },
      })

      // 发送N8N请求

      fetch(task.webhookUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          if (!res.ok) {
            console.error(`[套餐] N8N请求失败: ${task.taskType} ${res.status}`)
            await prisma.generation.update({ where: { id: task.generationId }, data: { status: "FAILED" } }).catch(() => {})
            await refundCreditsStandalone(userId, task.cost, `套餐${task.taskType === "MAIN_IMAGE" ? "主图" : "详情页"}生图失败退款 (N8N HTTP ${res.status})`)
          } else {
            // N8N请求已送达
          }
        })
        .catch(async (err) => {
          console.error(`[套餐] 网络错误: ${task.taskType}`, err)
          await prisma.generation.update({ where: { id: task.generationId }, data: { status: "FAILED" } }).catch(() => {})
          await refundCreditsStandalone(userId, task.cost, `套餐${task.taskType === "MAIN_IMAGE" ? "主图" : "详情页"}生图失败退款 (网络异常)`)
        })

      results.push({ taskType: task.taskType, id: task.generationId, status: "COMPLETED" })
    }
  }

  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, bonusCredits: true },
  })

  return NextResponse.json({
    success: true,
    isCombo: true,
    results,
    credits: updatedUser?.credits ?? 0,
    bonusCredits: updatedUser?.bonusCredits ?? 0,
    totalCredits: (updatedUser?.credits ?? 0) + (updatedUser?.bonusCredits ?? 0),
    message: "套餐任务已提交，正在处理中",
  })
}

// =============================================
// SINGLE GENERATION HANDLER (existing logic extracted)
// =============================================
async function handleSingleGeneration(
  body: any,
  userId: string,
  session: any,
  costs: SystemCostConfig,
  retryFromId?: string
) {
  let generationId: string | null = null
  let preDeducted = false
  let actualCost = costs.MAIN_IMAGE_STANDARD_COST
  let deductedBonus = 0
  let deductedPaid = 0

  // 并发限制设置：主图和详情页各最多 3 个
  const MAX_CONCURRENT_MAIN_IMAGE = 3
  const MAX_CONCURRENT_DETAIL_PAGE = 3

  const preTaskType = String(body?.taskType || "MAIN_IMAGE").trim().toUpperCase()

  // 如果是重试，需要先查询原始记录获取 taskType
  let checkTaskType = preTaskType
  if (retryFromId) {
    const orig = await prisma.generation.findUnique({
      where: { id: retryFromId },
      select: { taskType: true },
    })
    checkTaskType = orig?.taskType || "MAIN_IMAGE"
  }

  // 按任务类型分开统计并发数
  const pendingCount = await prisma.generation.count({
    where: {
      userId,
      taskType: checkTaskType,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  })

  const maxConcurrent = checkTaskType === "DETAIL_PAGE" ? MAX_CONCURRENT_DETAIL_PAGE : MAX_CONCURRENT_MAIN_IMAGE
  const taskTypeName = checkTaskType === "DETAIL_PAGE" ? "详情页" : "主图"

  if (pendingCount >= maxConcurrent) {
    return NextResponse.json(
      { error: `您当前有 ${pendingCount} 个${taskTypeName}任务正在进行中，请等待完成后再提交（${taskTypeName}最多同时 ${maxConcurrent} 个）` },
      { status: 429 }
    )
  }

  // 幂等性检查：如果提供了 requestId，检查是否已存在
  const requestId = body?.requestId as string | undefined
  if (requestId && !retryFromId) {
    const existing = await prisma.generation.findUnique({
      where: { requestId },
      select: { id: true, status: true, generatedImages: true, generatedImage: true },
    })
    if (existing) {
      console.log(`[生图API] 重复请求，返回已有记录: ${requestId}`)
      // 返回已存在的记录，不重复创建
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true, bonusCredits: true },
      })
      return NextResponse.json({
        id: existing.id,
        generatedImages: existing.generatedImages || [],
        fullImageUrl: existing.generatedImage,
        credits: user?.credits ?? 0,
        bonusCredits: user?.bonusCredits ?? 0,
        totalCredits: (user?.credits ?? 0) + (user?.bonusCredits ?? 0),
        isDuplicate: true, // 标记这是重复请求
      })
    }
  }

  try {
    let productName: string
    let productType: ProductTypeKey
    let platformKey: string
    let imageUrls: string[]
    let taskType: string = "MAIN_IMAGE"
    let outputLanguage: string = "简体中文"
    let mode: string = "CREATIVE"  // Clone Mode support
    let features: string = ""      // 卖点 (Clone Mode)
    let refImages: string[] = []   // 参考图 (Clone Mode)
    let qualityMode: string = "STANDARD"  // PRO mode support
    let imageCount: number = 9
    let aspectRatio: string = "1:1"
    let costPerImage: number = 0
    let totalCost: number = 0
    let proFeatures: string = ""
    let proStyle: string = ""

    if (retryFromId) {
      // --- 重试流程 ---
      const originalGeneration = await prisma.generation.findUnique({
        where: { id: retryFromId },
      })
      console.log("----查询出来的重试对象：" + originalGeneration?.mode);

      if (!originalGeneration) {
        return NextResponse.json({ error: "重试的原始记录不存在" }, { status: 404 })
      }
      if (originalGeneration.userId !== userId) {
        return NextResponse.json({ error: "你无权重试此记录" }, { status: 403 })
      }
      if (originalGeneration.hasUsedDiscountedRetry) {
        const retryQualityMode = (originalGeneration as any).qualityMode || "STANDARD"
        // PRO 模式不限制重试次数，只有 STANDARD 折扣重试限一次
        if (retryQualityMode !== "PRO") {
          return NextResponse.json({ error: "该记录已使用过折扣重试机会" }, { status: 400 })
        }
      }

      taskType = originalGeneration.taskType || "MAIN_IMAGE"
      qualityMode = (originalGeneration as any).qualityMode || "STANDARD"

      // PRO 模式重试：按原始 costPerImage 计费
      if (qualityMode === "PRO") {
        // 重试时保持原始计费参数
        costPerImage = (originalGeneration as any).costPerImage || costs.PRO_COST_PER_IMAGE
        imageCount = (originalGeneration as any).imageCount || 9
        // 使用 ?? 而不是 ||，保留空字符串（auto 模式）
        aspectRatio = (originalGeneration as any).aspectRatio ?? "1:1"

        // 关键修复：保持原始 totalCost，不重新计算（避免 55×9=495 的问题）
        totalCost = (originalGeneration as any).totalCost || (costPerImage * imageCount)
        actualCost = totalCost
        console.log(`[生图API] PRO重试: ${imageCount}张图, 比例${aspectRatio}, 费用${totalCost}积分`)
      } else {
        actualCost = getRetryCost(taskType, costs)
        totalCost = actualCost
      }
      console.log(`[生图API] 重试模式 - ${taskType}(${qualityMode}), 费用${actualCost}积分`)

      productName = originalGeneration.productName
      productType = originalGeneration.productType as ProductTypeKey
      imageUrls = originalGeneration.originalImage
      platformKey = String((originalGeneration as any).platformKey ?? "SHOPEE").trim().toUpperCase()
      outputLanguage = originalGeneration.outputLanguage || "简体中文"
      mode = originalGeneration.mode || "CREATIVE"  // 从原始记录获取模式
      features = originalGeneration.features || ""  // 从原始记录获取卖点
      refImages = originalGeneration.refImages || []  // 从原始记录获取参考图
      // PRO 专属：从原始记录恢复，避免重试时 AI 行为改变
      proFeatures = (originalGeneration as any).proFeatures || ""
      proStyle = (originalGeneration as any).proStyle || ""
    } else {
      // --- 标准流程 ---
      productName = String(body?.productName ?? "").trim()
      productType = String(body?.productType ?? "").trim() as ProductTypeKey
      platformKey = String(body?.platformKey ?? "SHOPEE").trim().toUpperCase()
      taskType = String(body?.taskType ?? "MAIN_IMAGE").trim().toUpperCase()
      outputLanguage = String(body?.outputLanguage ?? "简体中文").trim()
      mode = String(body?.mode ?? "CREATIVE").trim().toUpperCase()
      features = String(body?.features ?? "").trim()
      qualityMode = String(body?.qualityMode ?? "STANDARD").trim().toUpperCase()
      proFeatures = String(body?.proFeatures ?? "").trim()
      proStyle = String(body?.proStyle ?? "").trim()

      // PRO 计费逻辑
      if (qualityMode === "PRO") {
        imageCount = Math.min(Math.max(Number(body?.imageCount) || 1, 1), 20)
        aspectRatio = String(body?.aspectRatio ?? "1:1").trim()

        // 9 张特惠套餐: 500 积分固定价，costPerImage=55 用于退款计算
        if (imageCount === 9) {
          costPerImage = 55  // Math.floor(500/9)，用于部分失败退款
          totalCost = 500    // 实际支付特惠价
        } else {
          costPerImage = costs.PRO_COST_PER_IMAGE  // 100
          totalCost = costPerImage * imageCount
        }
        actualCost = totalCost
        console.log(`[生图API] PRO模式: ${imageCount}张图, 费用${totalCost}积分`)
      } else {
        totalCost = getStandardCost(taskType, costs)
        actualCost = totalCost
      }

      const rawImages = body?.images
      const rawRefImages = body?.refImages

      if (!productName) throw new Error("请填写商品名称")
      // productType is now required for both modes (for proper prompt lookup)
      if (!productType) throw new Error("请选择商品类型")

      let parsedImages: string[] = []
      if (Array.isArray(rawImages)) {
        parsedImages = rawImages.map((x) => String(x).trim()).filter(Boolean)
      } else if (typeof rawImages === "string") {
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
      } else if (rawImages && typeof rawImages === "object") {
        parsedImages = Object.values(rawImages).map((x) => String(x).trim()).filter(Boolean)
      }

      if (parsedImages.length === 0) {
        throw new Error("请至少上传 1 张图片")
      }
      imageUrls = parsedImages

      // Parse reference images for Clone Mode
      if (mode === "CLONE" && rawRefImages) {
        if (Array.isArray(rawRefImages)) {
          refImages = rawRefImages.map((x) => String(x).trim()).filter(Boolean)
        } else if (typeof rawRefImages === "string") {
          try {
            const parsed = JSON.parse(rawRefImages)
            if (Array.isArray(parsed)) {
              refImages = parsed.map((x) => String(x).trim()).filter(Boolean)
            }
          } catch {
            if (rawRefImages.trim()) refImages = [rawRefImages.trim()]
          }
        }
        if (refImages.length === 0) {
          throw new Error("克隆模式需要至少上传 1 张参考图")
        }
      }
    }

    // 2) 原子扣费 + 更新
    const deductResult = await prisma.$transaction(async (tx: TxClient) => {
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

      // PRO 模式不设折扣标记，只有 STANDARD 折扣重试才限一次
      if (retryFromId && qualityMode !== "PRO") {
        await tx.generation.update({
          where: { id: retryFromId },
          data: { hasUsedDiscountedRetry: true },
        })
        console.log(`[生图API] 已标记原记录使用过折扣重试: ${retryFromId}`)
      }

      console.log(`[生图API] 扣费成功: ${actualCost}积分 (赠送${deductBonus}, 付费${deductPaid})`)
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
        requestId: requestId || null, // 保存幂等键
        userId,
        productName,
        productType, // Save actual productType (now required for both modes)
        platformKey,
        taskType,
        mode,
        qualityMode,
        features: features || null,
        refImages,
        originalImage: imageUrls,
        status: "PENDING",
        hasUsedDiscountedRetry: Boolean(retryFromId),
        outputLanguage,
        imageCount,
        aspectRatio,
        costPerImage,
        totalCost,
        proFeatures: proFeatures || null,  // PRO: 产品功能，供重试时恢复
        proStyle: proStyle || null,        // PRO: 画面风格，供重试时恢复
      },
    })
    generationId = pending.id

    // For DETAIL_PAGE: ignore productType, find first prompt for platform
    // For MAIN_IMAGE: match productType as before
    // For CLONE mode: find prompts with mode='CLONE', with fallback to CLONE_GENERAL
    let promptRecord: any = null

    if (mode === "CLONE") {
      // Clone Mode: First try to find a prompt matching the specific productType
      // Step 1: Try to find specific productType Clone prompt for user
      const step1Params = { isActive: true, mode: "CLONE", qualityMode, productType, taskType, userId, }
      promptRecord = await prisma.productTypePrompt.findFirst({
        where: step1Params,
        orderBy: { updatedAt: "desc" },
      })

      // Step 2: Try specific productType Clone prompt (system default)
      if (!promptRecord) {
        const step2Params = { isActive: true, mode: "CLONE", qualityMode, productType, taskType, userId: null, }
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step2Params,
          orderBy: { updatedAt: "desc" },
        })
      }

      // Step 3: Fallback to CLONE_GENERAL for user on the platform
      if (!promptRecord) {
        const step3Params = { isActive: true, mode: "CLONE", qualityMode, productType: "CLONE_GENERAL", taskType, userId, }
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step3Params,
          orderBy: { updatedAt: "desc" },
        })
      }

      // Step 4: Fallback to CLONE_GENERAL (system default) on the platform
      if (!promptRecord) {
        const step4Params = { isActive: true, mode: "CLONE", qualityMode, productType: "CLONE_GENERAL", taskType, userId: null, }
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step4Params,
          orderBy: { updatedAt: "desc" },
        })
      }

      // Step 5: Fallback to CLONE_GENERAL on GENERAL platform
      if (!promptRecord) {
        const step5Params = { isActive: true, mode: "CLONE", qualityMode, productType: "CLONE_GENERAL", taskType, userId: null, platform: { key: "GENERAL" } }
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step5Params,
          orderBy: { updatedAt: "desc" },
        })
      }
    } else if (taskType === "DETAIL_PAGE") {
      const step1Params = { isActive: true, taskType: "DETAIL_PAGE", mode: "CREATIVE", qualityMode, userId, }
      promptRecord = await prisma.productTypePrompt.findFirst({
        where: step1Params,
        orderBy: { updatedAt: "desc" },
      })

      if (!promptRecord) {
        const step2Params = { isActive: true, taskType: "DETAIL_PAGE", mode: "CREATIVE", qualityMode, userId: null, }
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step2Params,
          orderBy: { updatedAt: "desc" },
        })
      }

      if (!promptRecord) {
        const step3Params = { isActive: true, taskType: "DETAIL_PAGE", mode: "CREATIVE", qualityMode, userId: null, platform: { key: "GENERAL" } }
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step3Params,
          orderBy: { updatedAt: "desc" },
        })
      }
    } else {
      // Creative Mode - MAIN_IMAGE
      const step1Params = { isActive: true, productType, taskType, mode: "CREATIVE", qualityMode, userId, }
      promptRecord = await prisma.productTypePrompt.findFirst({
        where: step1Params,
        orderBy: { updatedAt: "desc" },
      })

      if (!promptRecord) {
        const step2Params = { isActive: true, productType, taskType, mode: "CREATIVE", qualityMode, userId: null, }
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step2Params,
          orderBy: { updatedAt: "desc" },
        })
      }

      if (!promptRecord) {
        const step3Params = { isActive: true, productType, taskType, mode: "CREATIVE", qualityMode, userId: null, platform: { key: "GENERAL" } }
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step3Params,
          orderBy: { updatedAt: "desc" },
        })
      }
    }

    if (!promptRecord) {
      console.error(`[生图API] ❌ 未找到提示词模板: ${productType}/${taskType}/${mode}`)
      // PRO 模式硬拦截：决不允许 fallback 到 STANDARD
      if (qualityMode === "PRO") {
        throw new Error("当前类目暂未配置 PRO 专属提示词")
      }
      throw new Error(`未找到 Prompt 模板：platformKey=${platformKey}, productType=${productType}, taskType=${taskType}, mode=${mode}`)
    }

    console.log(`[生图API] 提示词: ${promptRecord.description || promptRecord.productType}`)

    // 根据 qualityMode 和 taskType 选择不同的 webhook
    // PRO 模式: 使用独立的 PRO webhook
    // STANDARD - MAIN_IMAGE: 提示词以"你是"开头用 AUTO，否则用 GRSAI
    // STANDARD - DETAIL_PAGE: 用 DETAIL webhook
    let webhookUrl: string | undefined
    if (qualityMode === "PRO") {
      webhookUrl = process.env.N8N_PRO_WEBHOOK_URL
      if (!webhookUrl) {
        throw new Error("N8N_PRO_WEBHOOK_URL 未配置")
      }
    } else if (taskType === "DETAIL_PAGE") {
      webhookUrl = process.env.N8N_DETAIL_WEBHOOK_URL
    } else {
      // MAIN_IMAGE - check prompt content
      webhookUrl = promptRecord.promptTemplate.startsWith("你是") || promptRecord.promptTemplate.startsWith("Role")
        ? process.env.N8N_AUTO_WEBHOOK_URL
        : process.env.N8N_GRSAI_WEBHOOK_URL
    }
    if (!webhookUrl) {
      throw new Error(taskType === "DETAIL_PAGE" ? "N8N_DETAIL_WEBHOOK_URL 未配置" : "N8N 主图 Webhook 未配置")
    }

    // Fill in template variables before sending (Handlebars-powered)
    const referenceLayoutImages = promptRecord.referenceImages ?? []
    // 克隆模式用 refImages.length，其他模式用 referenceLayoutImages.length
    const refImageCountForPrompt = mode === "CLONE" ? refImages.length : referenceLayoutImages.length
    const filledPrompt = fillPromptTemplate(
      promptRecord.promptTemplate,
      productName,
      outputLanguage,
      "A",
      features,
      refImageCountForPrompt,
      proFeatures,
      proStyle,
      imageCount,
      aspectRatio,
      imageUrls.length,  // 传递用户上传的原始图片数量
    )

    // 构建 images 数组：如果提示词中使用了参考图片数量变量，则拼接参考图片 URL
    let imagesArray = mode === "CLONE" ? [...refImages, ...imageUrls] : imageUrls

    // 检查原始提示词模板中是否包含 numberOfReferenceImages 变量，如果有且参考图片不为空，则拼接参考图片 URL
    if (referenceLayoutImages.length > 0 && promptRecord.promptTemplate.includes("numberOfReferenceImages")) {
      imagesArray = [...imagesArray, ...referenceLayoutImages]
    }

    const n8nPayload: Record<string, any> = {
      username: (session?.user as any)?.username ?? (session?.user as any)?.name ?? null,
      generation_id: generationId,
      product_name: productName,
      product_type: ProductTypePromptKey[productType as ProductTypeKey] || productType,
      prompt_template: filledPrompt,
      images: imagesArray,
      image_count: imagesArray.length,
      output_language: outputLanguage,
      mode,
      quality_mode: qualityMode,
    }

    // Add Clone Mode specific fields
    if (mode === "CLONE") {
      n8nPayload.features = features
      n8nPayload.ref_image_count = refImages.length
    }

    // Add PRO Mode specific fields
    if (qualityMode === "PRO") {
      n8nPayload.pro_image_count = imageCount
      n8nPayload.aspect_ratio = aspectRatio
      n8nPayload.pro_features = proFeatures || null
      n8nPayload.pro_style = proStyle || null
    }

    // N8N 请求详情（调试用，可注释掉）
    // console.log(`[N8N请求] 用户: ${userId}, 内容:`, JSON.stringify(n8nPayload, null, 2))

    // PRO 模式：异步调用 N8N，立即返回 PENDING 状态
    if (qualityMode === "PRO") {
      console.log(`[生图API] PRO模式 - 已发送N8N请求，等待回调`)

      // 更新状态为 PROCESSING
      await prisma.generation.update({
        where: { id: pending.id },
        data: { status: "PROCESSING" },
      })

      // 异步触发 N8N（fire-and-forget：只关心 HTTP 是否送达，不解析响应体）
      // 结果由 N8N webhook 回调 (/api/webhook/n8n) 处理，该回调有 CAS 锁防双重退款
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(n8nPayload),
      })
        .then(async (res) => {
          if (!res.ok) {
            // HTTP 级别失败（N8N 服务不可达、路由404 等）
            console.error(`[生图API] N8N请求失败: ${res.status} ${res.statusText}`)
            await prisma.generation.update({ where: { id: pending.id }, data: { status: "FAILED" } }).catch(() => { })
            await refundCreditsStandalone(userId, totalCost, `PRO模式生图失败退款 (N8N HTTP ${res.status})`)
          } else {
            // N8N 请求已送达，等待回调
          }
          // 成功送达后，由 N8N webhook 回调处理最终结果
        })
        .catch(async (err) => {
          // 网络级别失败（DNS、连接拒绝等）
          console.error(`[生图API] 网络错误:`, err)
          await prisma.generation.update({ where: { id: pending.id }, data: { status: "FAILED" } }).catch(() => { })
          await refundCreditsStandalone(userId, totalCost, `PRO模式生图失败退款 (网络异常)`)
        })

      const updatedUser = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true, bonusCredits: true } })

      return NextResponse.json({
        success: true,
        id: pending.id,
        status: "PROCESSING",
        qualityMode: "PRO",
        imageCount,
        totalCost,
        credits: updatedUser?.credits ?? 0,
        bonusCredits: updatedUser?.bonusCredits ?? 0,
        totalCredits: (updatedUser?.credits ?? 0) + (updatedUser?.bonusCredits ?? 0),
      })
    }

    // STANDARD 模式：异步触发 N8N（fire-and-forget），与 PRO 模式保持一致
    // 结果由 n8n 回调 /api/webhook/n8n → BullMQ Worker 上传 TOS 后写入 DB
    console.log(`[生图API] 标准模式 - 已发送N8N请求，等待回调`)

    await prisma.generation.update({
      where: { id: pending.id },
      data: { status: "PROCESSING" },
    })

    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nPayload),
    })
      .then(async (res) => {
        if (!res.ok) {
          console.error(`[生图API] N8N请求失败: ${res.status} ${res.statusText}`)
          await prisma.generation.update({ where: { id: pending.id }, data: { status: "FAILED" } }).catch(() => {})
          await refundCreditsStandalone(userId, actualCost, `STANDARD模式生图失败退款 (N8N HTTP ${res.status})`)
        } else {
          // N8N请求已送达
        }
      })
      .catch(async (err) => {
        console.error(`[生图API] 网络错误:`, err)
        await prisma.generation.update({ where: { id: pending.id }, data: { status: "FAILED" } }).catch(() => {})
        await refundCreditsStandalone(userId, actualCost, `STANDARD模式生图失败退款 (网络异常)`)
      })

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true, bonusCredits: true },
    })

    return NextResponse.json({
      success: true,
      id: pending.id,
      status: "PROCESSING",
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
        await prisma.$transaction(async (tx) => {
          // 使用通用退款服务
          await refundCredits(tx, userId, actualCost, retryFromId ? "折扣重试失败退款" : "生成失败退款")
          // 重试场景：回滚折扣重试标记
          if (retryFromId) {
            await tx.generation.update({ where: { id: retryFromId }, data: { hasUsedDiscountedRetry: false } })
          }
        })
        console.log(`[生图API] 生成失败，已退款 ${actualCost} 积分`)
      } catch (refundErr) {
        console.error("[生图API] 退款失败:", refundErr)
      }
    }

    return NextResponse.json({ error: "生成失败，积分已退回", message }, { status: 500 })
  }
}
