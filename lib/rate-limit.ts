/**
 * 注册频率限制
 * 使用 Redis 实现 IP 和设备维度的限流
 */
import { getRedis } from "./redis"

// 限制配置
const CONFIG = {
    // IP 限制 (放宽以支持同一局域网多人注册)
    IP_ATTEMPT_WINDOW: 10 * 60,      // 10 分钟
    IP_ATTEMPT_LIMIT: 30,            // 10分钟内最多30次尝试 (放宽，同一IP可能有多人)
    IP_SUCCESS_WINDOW: 24 * 60 * 60,  // 24 小时
    IP_SUCCESS_LIMIT: 50,             // 24小时内最多50次成功注册 (放宽，支持公司/学校场景)

    // 设备限制 (保持严格，防止单设备刷号)
    DEVICE_WINDOW: 24 * 60 * 60,      // 24 小时
    DEVICE_LIMIT: 9,                  // 24小时内每设备最多2次成功注册
}

type RateLimitResult = {
    allowed: boolean
    reason?: string
    remaining?: number
}

/**
 * 检查 IP 尝试次数限制
 */
export async function checkIpAttemptLimit(ip: string): Promise<RateLimitResult> {
    try {
        const redis = getRedis()
        const key = `rate:ip:attempt:${ip}`

        const count = await redis.incr(key)
        if (count === 1) {
            await redis.expire(key, CONFIG.IP_ATTEMPT_WINDOW)
        }

        if (count > CONFIG.IP_ATTEMPT_LIMIT) {
            return {
                allowed: false,
                reason: "操作过于频繁，请10分钟后再试",
                remaining: 0,
            }
        }

        return {
            allowed: true,
            remaining: CONFIG.IP_ATTEMPT_LIMIT - count,
        }
    } catch (error) {
        console.error("IP 限流检查失败:", error)
        // Redis 故障时放行，不影响正常注册
        return { allowed: true }
    }
}

/**
 * 检查 IP 成功注册次数限制
 */
export async function checkIpSuccessLimit(ip: string): Promise<RateLimitResult> {
    try {
        const redis = getRedis()
        const key = `rate:ip:success:${ip}`

        const count = parseInt(await redis.get(key) || "0")

        if (count >= CONFIG.IP_SUCCESS_LIMIT) {
            return {
                allowed: false,
                reason: "该IP今日注册次数已达上限",
                remaining: 0,
            }
        }

        return {
            allowed: true,
            remaining: CONFIG.IP_SUCCESS_LIMIT - count,
        }
    } catch (error) {
        console.error("IP 成功限流检查失败:", error)
        return { allowed: true }
    }
}

/**
 * 检查设备注册次数限制
 */
export async function checkDeviceLimit(deviceId: string): Promise<RateLimitResult> {
    if (!deviceId) return { allowed: true }

    try {
        const redis = getRedis()
        const key = `rate:device:${deviceId}`

        const count = parseInt(await redis.get(key) || "0")

        if (count >= CONFIG.DEVICE_LIMIT) {
            return {
                allowed: false,
                reason: "该设备今日注册次数已达上限",
                remaining: 0,
            }
        }

        return {
            allowed: true,
            remaining: CONFIG.DEVICE_LIMIT - count,
        }
    } catch (error) {
        console.error("设备限流检查失败:", error)
        return { allowed: true }
    }
}

/**
 * 记录成功注册（IP + 设备）
 */
export async function recordRegistrationSuccess(ip: string, deviceId?: string) {
    try {
        const redis = getRedis()
        const pipeline = redis.pipeline()

        // IP 成功计数
        const ipKey = `rate:ip:success:${ip}`
        pipeline.incr(ipKey)
        pipeline.expire(ipKey, CONFIG.IP_SUCCESS_WINDOW)

        // 设备成功计数
        if (deviceId) {
            const deviceKey = `rate:device:${deviceId}`
            pipeline.incr(deviceKey)
            pipeline.expire(deviceKey, CONFIG.DEVICE_WINDOW)
        }

        await pipeline.exec()
    } catch (error) {
        console.error("记录注册成功失败:", error)
    }
}

/**
 * 综合限流检查（注册前调用）
 */
export async function checkRegistrationRateLimit(
    ip: string,
    deviceId?: string
): Promise<RateLimitResult> {
    // 1. 检查 IP 尝试次数
    const attemptCheck = await checkIpAttemptLimit(ip)
    if (!attemptCheck.allowed) return attemptCheck

    // 2. 检查 IP 成功次数
    const successCheck = await checkIpSuccessLimit(ip)
    if (!successCheck.allowed) return successCheck

    // 3. 检查设备限制
    if (deviceId) {
        const deviceCheck = await checkDeviceLimit(deviceId)
        if (!deviceCheck.allowed) return deviceCheck
    }

    return { allowed: true }
}
