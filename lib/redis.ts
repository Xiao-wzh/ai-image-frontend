/**
 * Redis 客户端
 * 用于 BullMQ 队列、限流和缓存
 */
import Redis from "ioredis"

// 支持 REDIS_URL 或单独的环境变量
const REDIS_URL = process.env.REDIS_URL
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1"
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379")
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined

// BullMQ 队列专用连接配置
export function createBullMQConnection(): Redis {
    const config = REDIS_URL ? {
        maxRetriesPerRequest: null, // BullMQ 要求
        enableReadyCheck: false,
    } : {
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    }

    const client = REDIS_URL
        ? new Redis(REDIS_URL, config)
        : new Redis(config)

    client.on("error", (err) => {
        console.error("[Redis] 连接错误:", err.message)
    })

    client.on("connect", () => {
        console.log("[Redis] 连接成功")
    })

    return client
}

// 通用 Redis 客户端（懒加载）
let redis: Redis | null = null

export function getRedis(): Redis {
    if (!redis) {
        redis = REDIS_URL
            ? new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true })
            : new Redis({
                host: REDIS_HOST,
                port: REDIS_PORT,
                password: REDIS_PASSWORD,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
            })

        redis.on("error", (err) => {
            console.error("[Redis] 连接错误:", err.message)
        })

        redis.on("connect", () => {
            console.log("[Redis] 已连接")
        })
    }
    return redis
}

// 优雅关闭
export async function closeRedis() {
    if (redis) {
        await redis.quit()
        redis = null
    }
}
