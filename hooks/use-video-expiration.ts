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
 */
export function useVideoExpiration(completedAt?: string | null, status?: string | null) {
  const [tick, setTick] = useState(0)
  const completedTime = completedAt ? new Date(completedAt).getTime() : null

  // 仅在已完成的任务上启动 1 分钟定时器，定期刷新过期状态
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

  return { isExpired, isExpiringSoon }
}
