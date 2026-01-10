/**
 * 去水印 BullMQ 队列
 * 生产级配置：幂等入队、重试、超时、清理
 */
import { Queue, Job } from "bullmq"

// 队列名称
export const QUEUE_NAME = "watermark-removal"

// 任务数据类型
export interface WatermarkJobData {
    taskId: string        // 数据库任务 ID
    originalUrl: string   // 原图 URL
    userId: string        // 用户 ID（用于退款）
}

// 任务返回类型
export interface WatermarkJobResult {
    success: boolean
    resultUrl?: string
    error?: string
}

// Redis 连接 URL
function getRedisUrl(): string {
    return process.env.REDIS_URL || "redis://localhost:6379"
}

// 创建队列单例
let watermarkQueue: Queue<WatermarkJobData, WatermarkJobResult> | null = null

export function getWatermarkQueue(): Queue<WatermarkJobData, WatermarkJobResult> {
    if (!watermarkQueue) {
        watermarkQueue = new Queue<WatermarkJobData, WatermarkJobResult>(QUEUE_NAME, {
            connection: {
                url: getRedisUrl(),
            } as any,
            defaultJobOptions: {
                attempts: 3,                              // 最多重试 3 次
                backoff: {
                    type: "exponential",
                    delay: 2000,                          // 初始延迟 2 秒
                },
                timeout: 3 * 60 * 1000,                   // 单任务超时 3 分钟
                removeOnComplete: { count: 1000 },        // 保留 1000 个完成任务
                removeOnFail: { count: 5000 },            // 保留 5000 个失败任务（便于排查）
            },
        })
        console.log("[去水印队列] 队列已创建:", QUEUE_NAME)
    }
    return watermarkQueue
}

/**
 * 添加去水印任务到队列（幂等：用 taskId 作为 jobId）
 */
export async function addWatermarkJob(data: WatermarkJobData): Promise<Job<WatermarkJobData, WatermarkJobResult>> {
    const queue = getWatermarkQueue()
    const job = await queue.add("process", data, {
        jobId: data.taskId,  // ✅ 关键：用 taskId 作为 jobId，防止重复入队
    })
    console.log(`[去水印队列] 任务已加入队列: ${data.taskId}`)
    return job
}

/**
 * 批量添加任务（幂等）
 */
export async function addWatermarkJobs(jobs: WatermarkJobData[]): Promise<void> {
    const queue = getWatermarkQueue()
    await queue.addBulk(jobs.map(data => ({
        name: "process",
        data,
        opts: { jobId: data.taskId }  // ✅ 幂等
    })))
    console.log(`[去水印队列] 批量添加 ${jobs.length} 个任务`)
}
