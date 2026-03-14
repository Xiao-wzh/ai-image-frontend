/**
 * TOS 上传 BullMQ 队列
 * 解决带宽爆炸问题：n8n 写文件到磁盘 → 回调传路径 → Worker 并发=3 控制上传速率
 */
import { Queue, Job } from "bullmq"

export const TOS_UPLOAD_QUEUE_NAME = "tos-upload"

/** 任务数据 */
export interface TosUploadJobData {
  generationId: string
  userId: string
  /** 宿主机上的绝对路径（已翻译），worker 直接 fs.readFile */
  hostFilePaths: string[]
  /** 合并大图路径（STANDARD 模式使用，可选） */
  hostFullImagePath?: string
  /** 期望图片数量（用于退款计算） */
  imageCount: number
  /** 每张图费用快照（用于退款计算） */
  costPerImage: number
  /** 本次总扣费快照 */
  totalCost: number
  /** 质量模式：STANDARD / PRO */
  qualityMode: string
  /** 任务类型：MAIN_IMAGE / DETAIL_PAGE */
  taskType: string
  /** 任务类型：GENERATE（默认）/ EDIT（编辑单张图片） */
  jobType?: "GENERATE" | "EDIT"
  /** 编辑模式下需要替换的图片索引 */
  imageIndex?: number
}

/** 任务返回值 */
export interface TosUploadJobResult {
  success: boolean
  imageKeys: string[]
  fullImageKey?: string
}

// Redis 连接从环境变量读取（与 watermark-queue 一致）
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1"
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379")
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined

let tosUploadQueue: Queue | null = null

export function getTosUploadQueue(): Queue {
  if (!tosUploadQueue) {
    tosUploadQueue = new Queue(TOS_UPLOAD_QUEUE_NAME, {
      connection: { host: REDIS_HOST, port: REDIS_PORT, password: REDIS_PASSWORD },
      defaultJobOptions: {
        attempts: 5,                                          // 最多重试 5 次
        backoff: { type: "exponential", delay: 3000 },       // 指数退避，初始 3s
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 2000 },
      },
    })
    console.log("[TOS上传队列] 队列已创建:", TOS_UPLOAD_QUEUE_NAME)
  }
  return tosUploadQueue
}

/**
 * 幂等入队：默认用 generationId 作为 jobId，可传入自定义 jobId（编辑模式用）
 */
export async function addTosUploadJob(data: TosUploadJobData, jobId?: string): Promise<Job> {
  const queue = getTosUploadQueue()
  const job = await queue.add("upload", data, { jobId: jobId ?? data.generationId })
  console.log(`[TOS上传队列] 任务已加入队列: ${jobId ?? data.generationId}`)
  return job
}
