import prisma from "@/lib/prisma"

// API 配置
const API_URL = "https://techsz.aoscdn.com/api/tasks/visual/external/watermark-remove"
const MAX_QPS = 2                  // 最大并发数
const STUCK_TIMEOUT_MINUTES = 5   // 卡住任务超时时间（分钟）
const POLL_INTERVAL_MS = 2000     // 轮询间隔（毫秒）
const MAX_POLL_ATTEMPTS = 30      // 最大轮询次数（约60秒）

// 单例标志，防止并发处理
let isProcessing = false

/**
 * 处理待处理的去水印任务（带 QPS 限制）
 * 即发即忘：调用时无需等待
 */
export async function processPendingTasks(): Promise<void> {
    // 防止并发处理
    if (isProcessing) {
        console.log("[去水印队列] 正在处理中，跳过...")
        return
    }

    isProcessing = true
    console.log("[去水印队列] 启动队列处理器...")

    try {
        // 先重置卡住的任务
        await resetStuckTasks()

        // 检查当前 QPS（统计处理中的任务数）
        const processingCount = await prisma.watermarkTask.count({
            where: { status: "PROCESSING" }
        })

        if (processingCount >= MAX_QPS) {
            console.log(`[去水印队列] 已达 QPS 上限 (${processingCount}/${MAX_QPS})，等待中...`)
            return
        }

        // 计算可处理的数量
        const availableSlots = MAX_QPS - processingCount

        // 获取最早的待处理任务
        const pendingTasks = await prisma.watermarkTask.findMany({
            where: { status: "PENDING" },
            orderBy: { createdAt: "asc" },
            take: availableSlots
        })

        if (pendingTasks.length === 0) {
            console.log("[去水印队列] 没有待处理任务")
            return
        }

        console.log(`[去水印队列] 正在处理 ${pendingTasks.length} 个任务...`)

        // 并行处理任务（最多 availableSlots 个）
        await Promise.all(pendingTasks.map((task: { id: string; originalUrl: string }) =>
            processTask(task.id, task.originalUrl)
        ))

        // 如果还有更多任务，继续处理
        const remainingCount = await prisma.watermarkTask.count({
            where: { status: "PENDING" }
        })

        if (remainingCount > 0) {
            // 延迟后处理下一批
            setTimeout(() => {
                isProcessing = false
                processPendingTasks().catch(console.error)
            }, 1000)
            return
        }

    } catch (error) {
        console.error("[去水印队列] 错误:", error)
    } finally {
        isProcessing = false
    }
}

/**
 * 处理单个去水印任务（异步模式：创建任务 → 轮询结果）
 */
async function processTask(taskId: string, originalUrl: string): Promise<void> {
    console.log(`[去水印队列] 处理任务 ${taskId}...`)

    try {
        // 标记为处理中
        await prisma.watermarkTask.update({
            where: { id: taskId },
            data: { status: "PROCESSING" }
        })

        // 获取 API Key
        const apiKey = process.env.WATERMARK_API_KEY
        if (!apiKey) {
            throw new Error("WATERMARK_API_KEY 未配置")
        }

        console.log(`[去水印队列] 任务 ${taskId} 创建 API 任务，URL: ${originalUrl.substring(0, 80)}...`)

        // 第一步：创建任务（异步模式 sync=0）
        const params = new URLSearchParams()
        params.append("url", originalUrl)
        params.append("sync", "0")

        const createResponse = await fetch(API_URL, {
            method: "POST",
            headers: {
                "X-API-KEY": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: originalUrl,
                sync: 0
            })
        })

        const createText = await createResponse.text()
        console.log(`[去水印队列] 任务 ${taskId} 创建响应:`, createResponse.status, createText)

        let createResult: any
        try {
            createResult = JSON.parse(createText)
        } catch {
            throw new Error(`API 返回无效 JSON: ${createText.substring(0, 300)}`)
        }

        if (createResult.status !== 200) {
            throw new Error(createResult.message || `API 创建失败: 状态码 ${createResult.status}`)
        }

        const remoteTaskId = createResult.data?.task_id
        if (!remoteTaskId) {
            throw new Error(`创建响应中没有 task_id: ${createText}`)
        }

        console.log(`[去水印队列] 任务 ${taskId} 远程任务ID: ${remoteTaskId}`)

        // 第二步：轮询获取结果
        let resultUrl: string | null = null

        for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

            const pollResponse = await fetch(`${API_URL}/${remoteTaskId}`, {
                method: "GET",
                headers: {
                    "X-API-KEY": apiKey
                }
            })

            const pollText = await pollResponse.text()
            console.log(`[去水印队列] 任务 ${taskId} 轮询第 ${attempt + 1} 次:`, pollResponse.status, pollText.substring(0, 150))

            let pollResult: any
            try {
                pollResult = JSON.parse(pollText)
            } catch {
                console.error(`[去水印队列] 轮询解析错误:`, pollText)
                continue
            }

            if (pollResult.status !== 200) {
                throw new Error(pollResult.message || `API 轮询失败: 状态码 ${pollResult.status}`)
            }

            const state = pollResult.data?.state
            const progress = pollResult.data?.progress

            // state: 1 = 完成, 负数 = 错误
            if (state === 1 && progress === 100) {
                resultUrl = pollResult.data?.file
                break
            } else if (state < 0) {
                const stateMessages: Record<number, string> = {
                    [-7]: "无效文件（文件损坏或格式不对）",
                    [-5]: "文件超出大小限制（最大50MB）",
                    [-3]: "下载失败（检查文件URL是否可访问）",
                    [-2]: "上传失败",
                    [-1]: "处理失败"
                }
                throw new Error(stateMessages[state] || `任务状态异常: ${state}`)
            }

            // 仍在处理中，继续轮询
        }

        if (!resultUrl) {
            throw new Error("轮询超时：结果未就绪")
        }

        // 更新任务为已完成
        await prisma.watermarkTask.update({
            where: { id: taskId },
            data: {
                status: "COMPLETED",
                resultUrl: resultUrl
            }
        })

        console.log(`[去水印队列] 任务 ${taskId} 处理完成`)

    } catch (error: any) {
        console.error(`[去水印队列] 任务 ${taskId} 失败:`, error)

        // 获取任务信息用于退款
        const task = await prisma.watermarkTask.findUnique({
            where: { id: taskId },
            select: { userId: true }
        })

        // 更新任务为失败并退款
        await prisma.$transaction(async (tx) => {
            // 1. 更新任务状态
            await tx.watermarkTask.update({
                where: { id: taskId },
                data: {
                    status: "FAILED",
                    errorMsg: error?.message || "未知错误"
                }
            })

            // 2. 退款（每张图片 50 积分）
            if (task?.userId) {
                const refundAmount = 50
                await tx.user.update({
                    where: { id: task.userId },
                    data: { credits: { increment: refundAmount } }
                })
                await tx.creditRecord.create({
                    data: {
                        userId: task.userId,
                        amount: refundAmount,
                        type: "REFUND",
                        description: "去水印失败退款"
                    }
                })
                console.log(`[去水印队列] 已退还 ${refundAmount} 积分给用户 ${task.userId}`)
            }
        })
    }
}

/**
 * 重置卡住太久的任务
 */
async function resetStuckTasks(): Promise<void> {
    const cutoffTime = new Date(Date.now() - STUCK_TIMEOUT_MINUTES * 60 * 1000)

    const stuckTasks = await prisma.watermarkTask.updateMany({
        where: {
            status: "PROCESSING",
            updatedAt: { lt: cutoffTime }
        },
        data: {
            status: "PENDING",
            errorMsg: "任务超时，正在重试..."
        }
    })

    if (stuckTasks.count > 0) {
        console.log(`[去水印队列] 重置了 ${stuckTasks.count} 个卡住的任务`)
    }
}

/**
 * 触发队列处理器（即发即忘）
 * 可从 API 路由安全调用
 */
export function triggerQueue(): void {
    // 使用 setImmediate 不阻塞 API 响应
    setImmediate(() => {
        processPendingTasks().catch(console.error)
    })
}
