import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getSystemCost } from "@/lib/system-config"
import { refundCredits } from "@/lib/credit-service"
import { tosClient, TOS_BUCKET } from "@/lib/tos"
import { v4 as uuidv4 } from "uuid"
import {
    YUNWU_BASE_URL,
    ALLOWED_IMAGE_TYPES,
    MAX_REFERENCE_IMAGE_SIZE,
} from "@/lib/video/constants"
import "dotenv/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/video/sora2
 *
 * Sora-2 视频生成 API
 *
 * 流程：
 * 1. 接收前端请求（FormData 或 JSON），校验参数和参考图
 * 2. 参考图上传 TOS 存档，DB 只存 URL
 * 3. 调用云雾 API 提交任务（multipart/form-data 格式），拿到真实 taskId
 * 4. 原子性扣除积分 + 创建 VideoGeneration 记录
 * 5. 前端轮询 /api/video/sora2/{id} 获取结果
 */

// Sora-2 支持的合法分辨率（仅 720p）
const VALID_SIZES = ["720x1280", "1280x720"]

/** 将文件上传到 TOS，返回公开 URL */
async function uploadReferenceToTos(buffer: Buffer, contentType: string): Promise<string> {
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg"
    const objectKey = `video-ref/${new Date().toISOString().slice(0, 10).replace(/-/g, "")}/${uuidv4()}.${ext}`

    await tosClient.putObject({
        bucket: TOS_BUCKET,
        key: objectKey,
        body: buffer,
        headers: { "Content-Type": contentType },
    })

    const cdnHost = process.env.NEXT_PUBLIC_CDN_HOST || "img.wzhdjy.xin"
    return `https://${cdnHost}/${objectKey}`
}

/** 云雾 API 错误码映射 */
function mapYunwuError(status: number, errorText: string): { error: string; status: number } {
    if (status === 401) {
        console.error("[SORA2] 云雾 API 认证失败:", errorText)
        return { error: "视频生成服务认证失败", status: 500 }
    }
    if (status === 429) {
        return { error: "请求过于频繁，请稍后再试", status: 429 }
    }
    if (status >= 500) {
        return { error: "视频生成服务暂时不可用", status: 502 }
    }
    return { error: "视频生成服务暂时不可用", status: 502 }
}

export async function POST(req: NextRequest) {
    console.log("[SORA2] 收到请求, Content-Type:", req.headers.get("content-type"))

    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "未登录" }, { status: 401 })
        }
        const userId = session.user.id

        // 解析参数
        const contentType = req.headers.get("content-type") || ""
        let prompt = ""
        let model = "sora-2"
        let seconds = 10
        let size = "720x1280"
        let referenceImage: string | null = null
        let refFileBuffer: Buffer | null = null
        let refFileContentType: string | null = null

        if (contentType.includes("multipart/form-data")) {
            try {
                const formData = await req.formData()
                prompt = formData.get("prompt") as string || ""
                model = formData.get("model") as string || "sora-2"
                seconds = parseInt(formData.get("seconds") as string || "10", 10)
                size = formData.get("size") as string || "720x1280"

                const inputFile = formData.get("input_reference") as File | null
                if (inputFile && inputFile.size > 0) {
                    // 文件类型校验
                    const fileType = inputFile.type || "application/octet-stream"
                    if (!ALLOWED_IMAGE_TYPES.includes(fileType as any)) {
                        return NextResponse.json(
                            { error: `参考图格式不支持（仅支持 JPG/PNG/WebP），当前: ${fileType}` },
                            { status: 400 }
                        )
                    }
                    // 文件大小校验
                    if (inputFile.size > MAX_REFERENCE_IMAGE_SIZE) {
                        return NextResponse.json(
                            { error: `参考图文件过大（最大 4MB），当前: ${(inputFile.size / 1024 / 1024).toFixed(1)}MB` },
                            { status: 400 }
                        )
                    }
                    refFileBuffer = Buffer.from(await inputFile.arrayBuffer())
                    refFileContentType = fileType
                }

                console.log("[SORA2] FormData 解析成功, model:", model, ", size:", size, ", 参考图:", refFileBuffer ? "有" : "无")
            } catch (parseErr: any) {
                console.error("[SORA2] FormData 解析失败:", parseErr?.message)
                return NextResponse.json(
                    { error: `请求解析失败: ${parseErr?.message || "未知错误"}` },
                    { status: 400 }
                )
            }
        } else if (contentType.includes("application/json")) {
            try {
                const jsonBody = await req.json()
                prompt = jsonBody.prompt || ""
                model = jsonBody.model || "sora-2"
                seconds = jsonBody.seconds || 10
                size = jsonBody.size || "720x1280"
                referenceImage = jsonBody.referenceImage || null
                console.log("[SORA2] JSON 解析成功, model:", model, ", size:", size)
            } catch (parseErr: any) {
                console.error("[SORA2] JSON 解析失败:", parseErr?.message)
                return NextResponse.json(
                    { error: `JSON 解析失败: ${parseErr?.message || "未知错误"}` },
                    { status: 400 }
                )
            }
        } else {
            console.error("[SORA2] 不支持的 Content-Type:", contentType)
            return NextResponse.json(
                { error: `不支持的 Content-Type: ${contentType || "(空)"}` },
                { status: 400 }
            )
        }

        // 参数校验
        if (!prompt.trim()) {
            return NextResponse.json({ error: "缺少视频描述" }, { status: 400 })
        }

        if (!VALID_SIZES.includes(size)) {
            return NextResponse.json({ error: "Sora-2 仅支持 720p 分辨率" }, { status: 400 })
        }

        if (seconds < 1 || seconds > 20) {
            return NextResponse.json({ error: "视频时长需在 1-20 秒之间" }, { status: 400 })
        }

        // 获取每秒单价并计算总费用
        const costPerSecond = await getSystemCost("VIDEO_SORA2_COST_PER_SECOND")
        const totalCost = seconds * costPerSecond

        // 检查积分是否足够（提前检查，避免浪费 API 调用）
        const userCheck = await prisma.user.findUnique({
            where: { id: userId },
            select: { credits: true, bonusCredits: true },
        })
        if (!userCheck) {
            return NextResponse.json({ error: "用户不存在" }, { status: 400 })
        }
        const userTotalCredits = (userCheck.credits ?? 0) + (userCheck.bonusCredits ?? 0)
        if (userTotalCredits < totalCost) {
            return NextResponse.json({ error: `积分不足（需要 ${totalCost}，当前 ${userTotalCredits}）` }, { status: 400 })
        }

        // ── 参考图处理：上传 TOS 存档 ──
        if (refFileBuffer && refFileContentType) {
            try {
                referenceImage = await uploadReferenceToTos(refFileBuffer, refFileContentType)
                console.log("[SORA2] 参考图已上传 TOS:", referenceImage)
            } catch (tosErr: any) {
                console.error("[SORA2] 参考图上传 TOS 失败:", tosErr?.message)
                return NextResponse.json(
                    { error: "参考图上传失败，请重试" },
                    { status: 500 }
                )
            }
        }

        // ── 调用云雾 API 提交任务 ──
        const apiKey = process.env.YUNWU_API_KEY
        if (!apiKey) {
            console.error("[SORA2] YUNWU_API_KEY 未配置")
            return NextResponse.json({ error: "视频生成服务未配置" }, { status: 500 })
        }

        console.log("[SORA2] 调用云雾 API 提交任务...")

        let realTaskId: string
        try {
            // 构建 multipart/form-data 请求（云雾 API 要求）
            const apiFormData = new FormData()
            apiFormData.append("model", model)
            apiFormData.append("prompt", prompt)
            apiFormData.append("size", size)
            apiFormData.append("seconds", String(seconds))

            if (refFileBuffer && refFileContentType) {
                const fileBlob = new Blob([new Uint8Array(refFileBuffer)], { type: refFileContentType })
                apiFormData.append(
                    "input_reference",
                    fileBlob,
                    "reference.jpg"
                )
            }

            const submitRes = await fetch(`${YUNWU_BASE_URL}/videos`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: apiFormData,
                signal: AbortSignal.timeout(30000),
            })

            if (!submitRes.ok) {
                const errorText = await submitRes.text().catch(() => "")
                console.error(`[SORA2] 云雾 API 提交失败: ${submitRes.status}`, errorText)
                const mapped = mapYunwuError(submitRes.status, errorText)
                return NextResponse.json({ error: mapped.error }, { status: mapped.status })
            }

            const submitData = await submitRes.json()
            realTaskId = submitData.id || submitData.task_id || submitData.taskId

            if (!realTaskId) {
                console.error("[SORA2] 云雾 API 返回数据中没有 taskId:", submitData)
                return NextResponse.json(
                    { error: "视频生成服务返回异常" },
                    { status: 502 }
                )
            }

            console.log(`[SORA2] 云雾 API 提交成功, taskId: ${realTaskId}`)
        } catch (submitErr: any) {
            console.error("[SORA2] 云雾 API 提交异常:", submitErr?.message)
            // 区分超时和其他错误
            if (submitErr?.name === "TimeoutError" || submitErr?.message?.includes("timeout")) {
                return NextResponse.json(
                    { error: "请求超时，请重试" },
                    { status: 504 }
                )
            }
            return NextResponse.json(
                { error: "视频生成服务暂时不可用" },
                { status: 502 }
            )
        }

        // ── 原子性扣费 + 创建记录 ──
        const deductResult = await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { credits: true, bonusCredits: true },
            })
            if (!user) return { ok: false as const, error: "用户不存在" }

            const total = (user.credits ?? 0) + (user.bonusCredits ?? 0)
            if (total < totalCost) {
                return { ok: false as const, error: `积分不足（需要 ${totalCost}，当前 ${total}）` }
            }

            // 先扣 bonusCredits，再扣 credits
            let remaining = totalCost
            const bonusDeduct = Math.min(remaining, user.bonusCredits ?? 0)
            remaining -= bonusDeduct
            const creditDeduct = remaining

            await tx.user.update({
                where: { id: userId },
                data: {
                    bonusCredits: { decrement: bonusDeduct },
                    credits: { decrement: creditDeduct },
                },
            })

            // 记录积分流水
            await tx.creditRecord.create({
                data: {
                    userId,
                    amount: -totalCost,
                    type: "CONSUME",
                    description: `Sora-2 视频生成 ${seconds}秒`,
                },
            })

            // 创建 VideoGeneration 记录（含真实 taskId，referenceImage 为 TOS URL）
            const videoGen = await tx.videoGeneration.create({
                data: {
                    userId,
                    model,
                    prompt,
                    seconds,
                    size,
                    referenceImage,
                    costPerSecond,
                    cost: totalCost,
                    status: "PROCESSING",
                    taskId: realTaskId,
                },
            })

            return { ok: true as const, videoGen }
        })

        if (!deductResult.ok) {
            // 扣费失败（可能并发导致积分不足），但云雾任务已提交
            // 创建 FAILED 记录兜底，避免云雾任务完成后无记录可匹配
            console.warn(`[SORA2] 扣费失败: ${deductResult.error}, 但云雾任务 ${realTaskId} 已提交`)
            await prisma.videoGeneration.create({
                data: {
                    userId, model, prompt, seconds, size,
                    referenceImage, costPerSecond, cost: totalCost,
                    status: "FAILED", taskId: realTaskId,
                    errorMsg: deductResult.error, hasRefunded: true,
                },
            })
            return NextResponse.json({ error: deductResult.error }, { status: 400 })
        }

        const videoGen = deductResult.videoGen
        console.log(`[SORA2] 任务创建成功: ${videoGen.id}, taskId: ${realTaskId}, 扣费: ${totalCost} 积分`)

        return NextResponse.json({
            success: true,
            data: {
                id: videoGen.id,
                status: "PROCESSING",
                cost: totalCost,
                costPerSecond,
                message: "任务已提交到云雾 API，正在处理中..."
            }
        })
    } catch (err: any) {
        console.error("[SORA2] 未知错误:", err)
        return NextResponse.json(
            { error: err?.message || "服务器错误" },
            { status: 500 }
        )
    }
}
