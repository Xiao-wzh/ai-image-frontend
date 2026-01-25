import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { ProductTypePromptKey, ProductTypeKey } from "@/lib/constants"
import { getSystemCosts } from "@/lib/system-config"
import type { SystemCostConfig } from "@/lib/types/config"
import { toCdnUrlArray, extractObjectKey, keyToCdnUrl } from "@/lib/cdnUrl"
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

// Helper: Fill prompt template with variables
function fillPromptTemplate(
  template: string,
  productName: string,
  language: string,
  detailBatch: string,
  features?: string,
  refImageCount?: number
): string {
  return template
    .replace(/\$\{productName\}/g, productName)
    .replace(/\$\{language\}/g, language)
    .replace(/\$\{detailBatch\}/g, detailBatch)
    .replace(/\$\{features\}/g, features || "")
    .replace(/\$\{numberOfReferenceImages\}/g, String(refImageCount || 0))
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

// Helper: Refund a specific amount
async function refundCredits(
  userId: string,
  amount: number,
  description: string
): Promise<void> {
  await prisma.$transaction(async (tx: TxClient) => {
    // Refund to paid credits (simpler than tracking bonus)
    await tx.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    })
    await tx.creditRecord.create({
      data: { userId, amount, type: "REFUND", description },
    })
  })
  console.log(`💸 Refunded ${amount} credits to user ${userId}: ${description}`)
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

  console.log(`[GENERATE_API] Received request - retryFromId: ${retryFromId}, withDetailCombo: ${withDetailCombo}`)

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

  console.log(`[COMBO] Total cost: ${comboCost} (Main: ${mainImageCost} + Detail: ${detailPageCost})`)

  // Check concurrency for both task types
  const [mainPendingCount, detailPendingCount] = await Promise.all([
    prisma.generation.count({
      where: { userId, taskType: "MAIN_IMAGE", status: { in: ["PENDING", "PROCESSING"] } },
    }),
    prisma.generation.count({
      where: { userId, taskType: "DETAIL_PAGE", status: { in: ["PENDING", "PROCESSING"] } },
    }),
  ])

  if (mainPendingCount >= 2) {
    return NextResponse.json(
      { error: `您当前有 ${mainPendingCount} 个主图任务正在进行中，请等待完成后再提交` },
      { status: 429 }
    )
  }
  if (detailPendingCount >= 1) {
    return NextResponse.json(
      { error: `您当前有 ${detailPendingCount} 个详情页任务正在进行中，请等待完成后再提交` },
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

    console.log(`[COMBO] Deducted ${comboCost} credits (bonus: ${deductBonus}, paid: ${deductPaid})`)
    return { ok: true as const, deductBonus, deductPaid }
  })

  if (!deductResult.ok) {
    return NextResponse.json({ error: deductResult.error }, { status: deductResult.status })
  }

  // Create two Generation records
  const [mainGen, detailGen] = await Promise.all([
    prisma.generation.create({
      data: {
        userId,
        productName,
        productType,
        taskType: "MAIN_IMAGE",
        originalImage: imageUrls,
        status: "PENDING",
        isWatermarkUnlocked: true, // Combo bonus: auto-unlock watermark
        outputLanguage,
      },
    }),
    prisma.generation.create({
      data: {
        userId,
        productName,
        productType,
        taskType: "DETAIL_PAGE",
        originalImage: imageUrls,
        status: "PENDING",
        isWatermarkUnlocked: true, // Bonus: auto-unlock watermark for combo
        outputLanguage,
      },
    }),
  ])

  console.log(`[COMBO] Created generations: Main=${mainGen.id}, Detail=${detailGen.id}`)

  // Fetch prompt templates for both
  const [mainPrompt, detailPrompt] = await Promise.all([
    // 主图：仅使用创意模式提示词（不允许落到克隆模式）
    prisma.productTypePrompt.findFirst({
      where: { isActive: true, productType, taskType: "MAIN_IMAGE", mode: "CREATIVE", userId: null },
      orderBy: { updatedAt: "desc" },
    }),
    // 详情页（套餐勾选）：仅使用创意模式提示词（不允许落到克隆模式）
    prisma.productTypePrompt.findFirst({
      where: { isActive: true, taskType: "DETAIL_PAGE", mode: "CREATIVE", userId: null },
      orderBy: { updatedAt: "desc" },
    }),
  ])

  // If prompt is missing, fail the corresponding task and refund
  const results: Array<{ taskType: string; id: string; status: "COMPLETED" | "FAILED"; error?: string }> = []

  // Select webhook URL based on prompt content
  // If main image prompt starts with "你是", use AUTO webhook, otherwise use GRSAI webhook
  const mainWebhookUrl = mainPrompt?.promptTemplate?.startsWith("你是")
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
    await refundCredits(userId, mainImageCost, "套餐主图生成失败退款 (缺少模板或配置)")
    results.push({ taskType: "MAIN_IMAGE", id: mainGen.id, status: "FAILED", error: "缺少主图模板或 Webhook 配置" })
  }

  if (detailPrompt && detailWebhookUrl) {
    // Update detail generation with actual productType from the prompt
    if (detailPrompt.productType && detailPrompt.productType !== productType) {
      await prisma.generation.update({
        where: { id: detailGen.id },
        data: { productType: detailPrompt.productType },
      })
      console.log(`[COMBO] Updated detail generation productType: ${productType} -> ${detailPrompt.productType}`)
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
    await refundCredits(userId, detailPageCost, "套餐详情页生成失败退款 (缺少模板或配置)")
    results.push({ taskType: "DETAIL_PAGE", id: detailGen.id, status: "FAILED", error: "缺少详情页模板或 Webhook 配置" })
  }

  // Execute remaining tasks in parallel
  if (tasks.length > 0) {
    const username = (session?.user as any)?.username ?? (session?.user as any)?.name ?? null

    const n8nPromises = tasks.map((task) => {
      // Fill in template variables before sending
      const filledPrompt = fillPromptTemplate(task.prompt.promptTemplate, productName, outputLanguage, task.prompt.detailBatch)

      const payload = {
        username,
        generation_id: task.generationId,
        product_name: productName,
        product_type: ProductTypePromptKey[productType] || productType,
        prompt_template: filledPrompt,
        images: imageUrls,
        image_count: imageUrls.length,
        output_language: outputLanguage,
      }
      console.log(`[COMBO] Calling N8N for ${task.taskType}: ${task.webhookUrl}`)
      return callN8N(task.webhookUrl!, payload, task.timeoutMs)
    })

    const n8nResults = await Promise.allSettled(n8nPromises)

    // Process results
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      const result = n8nResults[i]

      if (result.status === "fulfilled" && result.value.success) {
        // Success - extract keys from URLs before saving
        const imageKeys = result.value.images.map(url => extractObjectKey(url) as string)
        const fullImageKey = result.value.fullImageUrl ? extractObjectKey(result.value.fullImageUrl) as string : null

        await prisma.generation.update({
          where: { id: task.generationId },
          data: {
            generatedImages: imageKeys,
            generatedImage: fullImageKey,
            status: "COMPLETED",
          },
        })
        results.push({ taskType: task.taskType, id: task.generationId, status: "COMPLETED" })
        console.log(`[COMBO] ${task.taskType} completed successfully`)
      } else {
        // Failed
        const errorMsg = result.status === "rejected"
          ? result.reason?.message || "未知错误"
          : (result.value as any).error || "未知错误"

        await prisma.generation.update({
          where: { id: task.generationId },
          data: { status: "FAILED" },
        })

        // Refund for this specific task
        await refundCredits(
          userId,
          task.cost,
          `套餐${task.taskType === "MAIN_IMAGE" ? "主图" : "详情页"}生成失败退款`
        )

        results.push({ taskType: task.taskType, id: task.generationId, status: "FAILED", error: errorMsg })
        console.log(`[COMBO] ${task.taskType} failed: ${errorMsg}`)
      }
    }
  }

  // Get updated user credits
  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, bonusCredits: true },
  })

  const allSucceeded = results.every((r) => r.status === "COMPLETED")
  const allFailed = results.every((r) => r.status === "FAILED")

  return NextResponse.json({
    success: !allFailed,
    isCombo: true,
    results,
    credits: updatedUser?.credits ?? 0,
    bonusCredits: updatedUser?.bonusCredits ?? 0,
    totalCredits: (updatedUser?.credits ?? 0) + (updatedUser?.bonusCredits ?? 0),
    message: allSucceeded
      ? "套餐生成完成"
      : allFailed
        ? "套餐生成失败，积分已退回"
        : "套餐部分生成成功，失败部分已退款",
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

  // 并发限制设置：主图 2 个，详情页 1 个
  const MAX_CONCURRENT_MAIN_IMAGE = 10
  const MAX_CONCURRENT_DETAIL_PAGE = 10

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
        return NextResponse.json({ error: "该记录已使用过折扣重试机会" }, { status: 400 })
      }

      taskType = originalGeneration.taskType || "MAIN_IMAGE"
      actualCost = getRetryCost(taskType, costs)
      console.log(`[GENERATE_API] Discount retry mode for ${taskType} - setting actualCost to ${actualCost}`)

      productName = originalGeneration.productName
      productType = originalGeneration.productType as ProductTypeKey
      imageUrls = originalGeneration.originalImage
      platformKey = String((originalGeneration as any).platformKey ?? "SHOPEE").trim().toUpperCase()
      outputLanguage = originalGeneration.outputLanguage || "简体中文"
      mode = originalGeneration.mode || "CREATIVE"  // 从原始记录获取模式
      features = originalGeneration.features || ""  // 从原始记录获取卖点
      refImages = originalGeneration.refImages || []  // 从原始记录获取参考图
    } else {
      // --- 标准流程 ---
      productName = String(body?.productName ?? "").trim()
      productType = String(body?.productType ?? "").trim() as ProductTypeKey
      platformKey = String(body?.platformKey ?? "SHOPEE").trim().toUpperCase()
      taskType = String(body?.taskType ?? "MAIN_IMAGE").trim().toUpperCase()
      outputLanguage = String(body?.outputLanguage ?? "简体中文").trim()
      mode = String(body?.mode ?? "CREATIVE").trim().toUpperCase()
      features = String(body?.features ?? "").trim()
      actualCost = getStandardCost(taskType, costs)
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

      if (retryFromId) {
        await tx.generation.update({
          where: { id: retryFromId },
          data: { hasUsedDiscountedRetry: true },
        })
        console.log(`[GENERATE_API] Updated original record ${retryFromId} - hasUsedDiscountedRetry: true`)
      }

      console.log(`[GENERATE_API] Deducted ${actualCost} credits (bonus: ${deductBonus}, paid: ${deductPaid})`)
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
        productType, // Save actual productType (now required for both modes)
        platformKey,
        taskType,
        mode,
        features: features || null,
        refImages,
        originalImage: imageUrls,
        status: "PENDING",
        hasUsedDiscountedRetry: Boolean(retryFromId),
        outputLanguage,
      },
    })
    generationId = pending.id

    // For DETAIL_PAGE: ignore productType, find first prompt for platform
    // For MAIN_IMAGE: match productType as before
    // For CLONE mode: find prompts with mode='CLONE', with fallback to CLONE_GENERAL
    let promptRecord: any = null

    console.log(`[PROMPT_LOOKUP] Starting prompt lookup with params:`, {
      platformKey,
      productType,
      taskType,
      mode,
      userId,
    })

    if (mode === "CLONE") {
      console.log(`[PROMPT_LOOKUP] CLONE mode - trying 5 fallback steps...`)
      
      // Clone Mode: First try to find a prompt matching the specific productType
      // Step 1: Try to find specific productType Clone prompt for user
      const step1Params = { isActive: true, mode: "CLONE", productType, taskType, userId,  }
      console.log(`[PROMPT_LOOKUP] Step 1 - User specific:`, step1Params)
      promptRecord = await prisma.productTypePrompt.findFirst({
        where: step1Params,
        orderBy: { updatedAt: "desc" },
      })
      if (promptRecord) console.log(`[PROMPT_LOOKUP] ✅ Found at Step 1`)
      
      // Step 2: Try specific productType Clone prompt (system default)
      if (!promptRecord) {
        const step2Params = { isActive: true, mode: "CLONE", productType, taskType, userId: null,  }
        console.log(`[PROMPT_LOOKUP] Step 2 - System specific:`, step2Params)
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step2Params,
          orderBy: { updatedAt: "desc" },
        })
        if (promptRecord) console.log(`[PROMPT_LOOKUP] ✅ Found at Step 2`)
      }
      
      // Step 3: Fallback to CLONE_GENERAL for user on the platform
      if (!promptRecord) {
        const step3Params = { isActive: true, mode: "CLONE", productType: "CLONE_GENERAL", taskType, userId,  }
        console.log(`[PROMPT_LOOKUP] Step 3 - User CLONE_GENERAL:`, step3Params)
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step3Params,
          orderBy: { updatedAt: "desc" },
        })
        if (promptRecord) console.log(`[PROMPT_LOOKUP] ✅ Found at Step 3`)
      }
      
      // Step 4: Fallback to CLONE_GENERAL (system default) on the platform
      if (!promptRecord) {
        const step4Params = { isActive: true, mode: "CLONE", productType: "CLONE_GENERAL", taskType, userId: null,  }
        console.log(`[PROMPT_LOOKUP] Step 4 - System CLONE_GENERAL on platform:`, step4Params)
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step4Params,
          orderBy: { updatedAt: "desc" },
        })
        if (promptRecord) console.log(`[PROMPT_LOOKUP] ✅ Found at Step 4`)
      }
      
      // Step 5: Fallback to CLONE_GENERAL on GENERAL platform
      if (!promptRecord) {
        const step5Params = { isActive: true, mode: "CLONE", productType: "CLONE_GENERAL", taskType, userId: null, platform: { key: "GENERAL" } }
        console.log(`[PROMPT_LOOKUP] Step 5 - System CLONE_GENERAL on GENERAL:`, step5Params)
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step5Params,
          orderBy: { updatedAt: "desc" },
        })
        if (promptRecord) console.log(`[PROMPT_LOOKUP] ✅ Found at Step 5`)
      }
    } else if (taskType === "DETAIL_PAGE") {
      console.log(`[PROMPT_LOOKUP] CREATIVE mode - DETAIL_PAGE - trying 3 fallback steps...`)
      
      const step1Params = { isActive: true, taskType: "DETAIL_PAGE", mode: "CREATIVE", userId,  }
      console.log(`[PROMPT_LOOKUP] Step 1 - User specific:`, step1Params)
      promptRecord = await prisma.productTypePrompt.findFirst({
        where: step1Params,
        orderBy: { updatedAt: "desc" },
      })
      if (promptRecord) console.log(`[PROMPT_LOOKUP] ✅ Found at Step 1`)
      
      if (!promptRecord) {
        const step2Params = { isActive: true, taskType: "DETAIL_PAGE", mode: "CREATIVE", userId: null,  }
        console.log(`[PROMPT_LOOKUP] Step 2 - System on platform:`, step2Params)
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step2Params,
          orderBy: { updatedAt: "desc" },
        })
        if (promptRecord) console.log(`[PROMPT_LOOKUP] ✅ Found at Step 2`)
      }
      
      if (!promptRecord) {
        const step3Params = { isActive: true, taskType: "DETAIL_PAGE", mode: "CREATIVE", userId: null, platform: { key: "GENERAL" } }
        console.log(`[PROMPT_LOOKUP] Step 3 - System on GENERAL:`, step3Params)
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step3Params,
          orderBy: { updatedAt: "desc" },
        })
        if (promptRecord) console.log(`[PROMPT_LOOKUP] ✅ Found at Step 3`)
      }
    } else {
      console.log(`[PROMPT_LOOKUP] CREATIVE mode - MAIN_IMAGE - trying 3 fallback steps...`)
      
      // Creative Mode - MAIN_IMAGE
      const step1Params = { isActive: true, productType, taskType, mode: "CREATIVE", userId,  }
      console.log(`[PROMPT_LOOKUP] Step 1 - User specific:`, step1Params)
      promptRecord = await prisma.productTypePrompt.findFirst({
        where: step1Params,
        orderBy: { updatedAt: "desc" },
      })
      if (promptRecord) console.log(`[PROMPT_LOOKUP] ✅ Found at Step 1`)
      
      if (!promptRecord) {
        const step2Params = { isActive: true, productType, taskType, mode: "CREATIVE", userId: null,  }
        console.log(`[PROMPT_LOOKUP] Step 2 - System on platform:`, step2Params)
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step2Params,
          orderBy: { updatedAt: "desc" },
        })
        if (promptRecord) console.log(`[PROMPT_LOOKUP] ✅ Found at Step 2`)
      }
      
      if (!promptRecord) {
        const step3Params = { isActive: true, productType, taskType, mode: "CREATIVE", userId: null, platform: { key: "GENERAL" } }
        console.log(`[PROMPT_LOOKUP] Step 3 - System on GENERAL:`, step3Params)
        promptRecord = await prisma.productTypePrompt.findFirst({
          where: step3Params,
          orderBy: { updatedAt: "desc" },
        })
        if (promptRecord) console.log(`[PROMPT_LOOKUP] ✅ Found at Step 3`)
      }
    }

    if (!promptRecord) {
      console.error(`[PROMPT_LOOKUP] ❌ No prompt found after all fallback steps`)
      throw new Error(`未找到 Prompt 模板：platformKey=${platformKey}, productType=${productType}, taskType=${taskType}, mode=${mode}`)
    }

    console.log(`[PROMPT_LOOKUP] ✅ Final prompt found:`, {
      id: promptRecord.id,
      productType: promptRecord.productType,
      taskType: promptRecord.taskType,
      mode: promptRecord.mode,
      description: promptRecord.description,
    })

    // 根据 taskType 和提示词内容选择不同的 webhook
    // MAIN_IMAGE: 提示词以"你是"开头用 AUTO，否则用 GRSAI
    // DETAIL_PAGE: 用 DETAIL webhook
    let webhookUrl: string | undefined
    if (taskType === "DETAIL_PAGE") {
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

    // Fill in template variables before sending
    const filledPrompt = fillPromptTemplate(
      promptRecord.promptTemplate,
      productName,
      outputLanguage,
      "A",
      features,
      refImages.length
    )

    const n8nPayload: Record<string, any> = {
      username: (session?.user as any)?.username ?? (session?.user as any)?.name ?? null,
      generation_id: generationId,
      product_name: productName,
      product_type: ProductTypePromptKey[productType as ProductTypeKey] || productType,
      prompt_template: filledPrompt,
      images: mode === "CLONE" ? [...refImages, ...imageUrls] : imageUrls,  // 克隆模式：参考图在前，商品图在后
      image_count: mode === "CLONE" ? refImages.length + imageUrls.length : imageUrls.length,
      output_language: outputLanguage,
      mode,
    }

    // Add Clone Mode specific fields
    if (mode === "CLONE") {
      n8nPayload.features = features
      n8nPayload.ref_image_count = refImages.length
    }

    console.log(`[N8N_REQUEST] User: ${userId}, Payload: `, JSON.stringify(n8nPayload, null, 2))

    // 超时设置：主图 6 分钟，详情页 10 分钟
    const timeoutMs = taskType === "DETAIL_PAGE" ? 600_000 : 360_000
    const n8nResult = await callN8N(webhookUrl, n8nPayload, timeoutMs)

    if (!n8nResult.success) {
      throw new Error(n8nResult.error)
    }

    // Extract keys from URLs before saving
    const imageKeys = n8nResult.images.map(url => extractObjectKey(url) as string)
    const fullImageKey = n8nResult.fullImageUrl ? extractObjectKey(n8nResult.fullImageUrl) as string : null

    await prisma.generation.update({
      where: { id: pending.id },
      data: { generatedImages: imageKeys, generatedImage: fullImageKey, status: "COMPLETED" },
    })

    const updatedUser = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true, bonusCredits: true } })

    return NextResponse.json({
      success: true,
      id: pending.id,
      generatedImages: imageKeys.map(key => keyToCdnUrl(key)),
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
      } catch (refundErr) {
        console.error("❌ 退款失败:", refundErr)
      }
    }

    return NextResponse.json({ error: "生成失败，积分已退回", message }, { status: 500 })
  }
}
