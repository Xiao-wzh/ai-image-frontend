import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { extractObjectKey } from "@/lib/cdnUrl"
import { refundCredits } from "@/lib/credit-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * N8N Webhook 回调 — 接收异步生图结果
 *
 * 请求体约定:
 * {
 *   generationId: string,         // Generation UUID
 *   results: (string | null)[],   // 每张图的 URL，失败项为 null 或 "ERROR:xxx"
 *   full_image_url?: string       // 可选：完整大图 URL
 * }
 *
 * 安全措施:
 * - X-N8N-Secret 请求头校验
 * - CAS 乐观锁：防止并发双重退款
 * - 原子事务：prisma.$transaction 保证数据一致性
 */
export async function POST(req: NextRequest) {
    // ── 1. 密钥校验 ──
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET
    if (expectedSecret) {
        const receivedSecret = req.headers.get("x-n8n-secret") || req.headers.get("X-N8N-Secret")
        if (receivedSecret !== expectedSecret) {
            console.error("[N8N回调] ❌ 密钥校验失败")
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
    }

    // ── 2. 解析请求体 ──
    let body: any
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { generationId, results, full_image_url } = body

    if (!generationId) {
        return NextResponse.json({ error: "缺少 generationId" }, { status: 400 })
    }
    if (!Array.isArray(results)) {
        return NextResponse.json({ error: "缺少或无效的 results 数组" }, { status: 400 })
    }

    console.log(`[N8N回调] 收到回调: generationId=${generationId}, 结果数量=${results.length}`)

    // ── 3. 查询 Generation 记录 ──
    const generation = await prisma.generation.findUnique({
        where: { id: generationId },
        select: {
            id: true,
            userId: true,
            status: true,
            imageCount: true,
            costPerImage: true,
            totalCost: true,
            qualityMode: true,
        },
    })

    if (!generation) {
        console.error(`[N8N回调] ❌ 未找到 Generation 记录: ${generationId}`)
        return NextResponse.json({ error: "Generation not found" }, { status: 404 })
    }

    // ── 4. 快速幂等检查（读阶段，非锁） ──
    const terminalStatuses = ["COMPLETED", "PARTIAL_SUCCESS", "FAILED"]
    if (terminalStatuses.includes(generation.status)) {
        console.log(`[N8N回调] ⏭️ 已处于终态 ${generation.status}，跳过`)
        return NextResponse.json({ success: true, skipped: true, status: generation.status })
    }

    // ── 5. 计算结果 ──
    // 有效图片：非 null、非空、不以 "ERROR" 开头
    const validResults = results.filter(
        (r: any) => r != null && typeof r === "string" && r.trim() !== "" && !r.startsWith("ERROR")
    ) as string[]

    // 提取对象键（去掉域名前缀）
    const imageKeys = validResults.map((url) => extractObjectKey(url) as string)
    const fullImageKey = full_image_url ? (extractObjectKey(full_image_url) as string) : null

    const successCount = validResults.length
    const failedCount = Math.max(generation.imageCount - successCount, 0)

    // 确定最终状态
    let finalStatus: string
    if (successCount === 0) {
        finalStatus = "FAILED"
    } else if (failedCount > 0) {
        finalStatus = "PARTIAL_SUCCESS"
    } else {
        finalStatus = "COMPLETED"
    }

    // 计算退款金额
    const refundAmount = failedCount * generation.costPerImage

    console.log(`[N8N回调] 结算: 成功=${successCount}, 失败=${failedCount}, 状态=${finalStatus}, 退款=${refundAmount}`)

    // ── 6. 原子事务：CAS 乐观锁 + 状态更新 + 退款 ──
    try {
        let isAlreadyProcessed = false

        await prisma.$transaction(async (tx) => {
            // 6a. CAS 锁竞争：只更新仍处于非终态的记录
            const updateResult = await tx.generation.updateMany({
                where: {
                    id: generationId,
                    status: { in: ["PENDING", "PROCESSING"] }, // 🔒 CAS 锁：防止并发重复处理
                },
                data: {
                    status: finalStatus,
                    generatedImages: imageKeys,
                    generatedImage: fullImageKey,
                    refundAmount,
                },
            })

            // count === 0 说明被并发请求抢先处理了
            if (updateResult.count === 0) {
                isAlreadyProcessed = true
                return // 跳过退款逻辑
            }

            // 6b. 抢锁成功，执行退款（通过通用积分服务）
            if (refundAmount > 0 && generation.userId) {
                const reason = `Pro模式生图部分失败自动退还 (${failedCount}张×${generation.costPerImage}积分)`
                await refundCredits(tx, generation.userId, refundAmount, reason)
            }
        })

        // 被并发拦截：返回 200 让 N8N 停止重试
        if (isAlreadyProcessed) {
            console.log(`[N8N回调] ⏭️ 已被并发请求处理: ${generationId}`)
            return NextResponse.json({ success: true, skipped: true, note: "已被并发请求处理" })
        }

        console.log(`[N8N回调] ✅ 事务完成: ${generationId}`)

        return NextResponse.json({
            success: true,
            generationId,
            finalStatus,
            successCount,
            failedCount,
            refundAmount,
        })
    } catch (err: any) {
        console.error(`[N8N回调] ❌ 事务执行失败 ${generationId}:`, err)
        return NextResponse.json(
            { error: "回调处理内部错误", message: err?.message },
            { status: 500 }
        )
    }
}
