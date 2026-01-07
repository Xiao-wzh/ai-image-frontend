/**
 * Redis 客户端
 * 用于限流和缓存
 */
import Redis from "ioredis"

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1"
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379")
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined

// 创建 Redis 客户端（懒加载）
let redis: Redis | null = null

export function getRedis(): Redis {
    if (!redis) {
        redis = new Redis({
            host: REDIS_HOST,
            port: REDIS_PORT,
            password: REDIS_PASSWORD,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
        })

        redis.on("error", (err) => {
            console.error("Redis 连接错误:", err.message)
        })

        redis.on("connect", () => {
            console.log("✅ Redis 已连接")
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
