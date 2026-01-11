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
 * ❓ 当前已禁用，只打印日志
 */
export async function checkIpAttemptLimit(ip: string): Promise<RateLimitResult> {
    try {
        const redis = getRedis()
        const key = `rate:ip:attempt:${ip}`

        const count = await redis.incr(key)
        if (count === 1) {
            await redis.expire(key, CONFIG.IP_ATTEMPT_WINDOW)
        }

        // 📝 仅打印日志，不做限制
        console.log(`📊 IP 尝试计数: IP=${ip}, count=${count}/${CONFIG.IP_ATTEMPT_LIMIT}`)

        // 暂时禁用 IP 限制
        // if (count > CONFIG.IP_ATTEMPT_LIMIT) {
        //     return {
        //         allowed: false,
        //         reason: "操作过于频繁，请10分钟后再试",
        //         remaining: 0,
        //     }
        // }

        return {
            allowed: true,
            remaining: CONFIG.IP_ATTEMPT_LIMIT - count,
        }
    } catch (error) {
        console.error("IP 限流检查失败:", error)
        return { allowed: true }
    }
}

/**
 * 检查 IP 成功注册次数限制
 * ❓ 当前已禁用，只打印日志
 */
export async function checkIpSuccessLimit(ip: string): Promise<RateLimitResult> {
    try {
        const redis = getRedis()
        const key = `rate:ip:success:${ip}`

        const count = parseInt(await redis.get(key) || "0")

        // 📝 仅打印日志，不做限制
        console.log(`📊 IP 成功计数: IP=${ip}, count=${count}/${CONFIG.IP_SUCCESS_LIMIT}`)

        // 暂时禁用 IP 限制
        // if (count >= CONFIG.IP_SUCCESS_LIMIT) {
        //     return {
        //         allowed: false,
        //         reason: "该IP今日注册次数已达上限",
        //         remaining: 0,
        //     }
        // }

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
    // 📝 调用日志：检查是否误调用/重复调用
    console.log(`📊 recordRegistrationSuccess 被调用: IP=${ip}, deviceId=${deviceId || '无'}, 调用堆栈=${new Error().stack?.split('\n')[2]?.trim() || '未知'}`)

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

        const results = await pipeline.exec()
        const newIpCount = results?.[0]?.[1] || '?'
        const newDeviceCount = deviceId ? (results?.[2]?.[1] || '?') : 'N/A'

        console.log(`✅ 注册计数已更新: IP=${ip} (count=${newIpCount}), deviceId=${deviceId || '无'} (count=${newDeviceCount})`)
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
