"use client"

import { useState, useEffect, useMemo } from "react"
import { VIDEO_EXPIRE_MS, VIDEO_EXPIRE_WARNING_RATIO } from "@/lib/video/constants"

/**
 * 视频过期状态 Hook
 *
 * @param completedAt - 完成时间（ISO 字符串）
 * @param status - 任务状态（COMPLETED / FAILED / PROCESSING / PENDING）
 * @returns isExpired - 是否已过期
 * @returns isExpiringSoon - 是否即将过期（超过 70% 保留时间）
 * @returns remainingHours - 剩余小时数（整数，过期后为 0）
 */
export function useVideoExpiration(completedAt?: string | null, status?: string | null) {
  const [tick, setTick] = useState(0)
  const completedTime = completedAt ? new Date(completedAt).getTime() : null

  // 已完成任务每分钟刷新一次过期状态
  useEffect(() => {
    if (status !== "COMPLETED" || !completedTime) return
    const timer = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(timer)
  }, [status, completedTime])

  const isExpired = useMemo(() => {
    if (status !== "COMPLETED" || !completedAt) return false
    return Date.now() - new Date(completedAt).getTime() > VIDEO_EXPIRE_MS
  }, [completedAt, status, tick])

  const isExpiringSoon = useMemo(() => {
    if (status !== "COMPLETED" || !completedAt || isExpired) return false
    return Date.now() - new Date(completedAt).getTime() > VIDEO_EXPIRE_MS * VIDEO_EXPIRE_WARNING_RATIO
  }, [completedAt, status, isExpired, tick])

  // 剩余小时数（向上取整，最少显示 1h）
  const remainingHours = useMemo(() => {
    if (status !== "COMPLETED" || !completedAt || isExpired) return 0
    const remaining = VIDEO_EXPIRE_MS - (Date.now() - new Date(completedAt).getTime())
    if (remaining <= 0) return 0
    return Math.max(1, Math.ceil(remaining / (60 * 60 * 1000)))
  }, [completedAt, status, isExpired, tick])

  return { isExpired, isExpiringSoon, remainingHours }
}
