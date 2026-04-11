"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { resizeImageToTarget } from "@/lib/video/resize"
import type { VideoResult, VideoResultStatus } from "@/lib/video/status"
import { ALLOWED_IMAGE_TYPES, MAX_REFERENCE_IMAGE_SIZE } from "@/lib/video/constants"
import { fetchWithAuth } from "@/lib/fetch-with-auth"

type TosSignResponse = {
  uploadUrl: string
  publicUrl: string
  objectKey: string
}

/** 获取 TOS 预签名上传地址 */
async function signTosUpload(filename: string, contentType: string): Promise<TosSignResponse> {
  const res = await fetch("/api/tos/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `签名失败: ${res.status}`)
  return data as TosSignResponse
}

/** 直传文件到 TOS（客户端上传，不经过服务端） */
async function uploadToTos(uploadUrl: string, file: File | Blob) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  })
  if (!res.ok) throw new Error(`TOS 上传失败: ${res.status}`)
}

type UseVideoGenerationOptions = {
  costPerSecond: number
}

export type VideoParams = {
  orientation: "portrait" | "landscape"
  duration: number
  watermark: boolean
}

const DURATION_OPTIONS = [4, 8, 12]

export { DURATION_OPTIONS }

export function useVideoGeneration({ costPerSecond }: UseVideoGenerationOptions) {
  const { data: session } = useSession()

  const [prompt, setPrompt] = React.useState("")
  const [refFiles, setRefFiles] = React.useState<File[]>([])
  const [videoParams, setVideoParams] = React.useState<VideoParams>({
    orientation: "portrait",
    duration: 12,
    watermark: true,
  })
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [result, setResult] = React.useState<VideoResult | null>(null)
  const [submitPhase, setSubmitPhase] = React.useState<"idle" | "processing-image" | "submitting">("idle")
  const pollingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const promptLen = prompt.length
  const canSend = prompt.trim().length >= 10
  const estimatedCost = videoParams.duration * costPerSecond

  // 组件卸载时清理轮询
  React.useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current)
    }
  }, [])

  // 指数退避轮询
  const startPolling = React.useCallback((taskId: string) => {
    let interval = 5000
    const maxInterval = 30000
    const maxDuration = 5 * 60 * 1000
    const startTime = Date.now()

    const poll = async () => {
      if (Date.now() - startTime > maxDuration) {
        setResult(prev => prev ? { ...prev, status: "timeout" as const } : null)
        return
      }

      try {
        const res = await fetchWithAuth(`/api/video/sora2/${taskId}`)
        const data = await res.json()
        if (!res.ok || !data.success) {
          console.error("[SORA2] 轮询失败:", data.error)
        } else {
          setResult(data.data)
          if (data.data.status === 'completed' || data.data.status === 'failed') return
        }
        interval = Math.min(interval * 1.5, maxInterval)
        pollingTimerRef.current = setTimeout(poll, interval)
      } catch {
        pollingTimerRef.current = setTimeout(poll, interval)
      }
    }

    pollingTimerRef.current = setTimeout(poll, interval)
  }, [])

  // 恢复未完成任务
  const restorePendingTask = React.useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/history?type=video&limit=5")
      if (!res.ok) return
      const data = await res.json()
      type HistoryItem = { id: string; status: string; progress: number; cost: number }
      const items: HistoryItem[] = data.items ?? []
      const pending = items.find((item) => {
        const s = (item.status || "").toUpperCase()
        return s === "PENDING" || s === "PROCESSING"
      })
      if (!pending) return
      setResult({
        id: pending.id,
        taskId: pending.id,
        status: "processing",
        progress: pending.progress ?? 0,
        cost: pending.cost,
        message: "正在恢复任务状态...",
      })
      startPolling(pending.id)
    } catch (err) {
      console.error("[SORA2] 恢复任务失败:", err)
    }
  }, [startPolling])

  // 提交视频生成
  const handleSubmit = React.useCallback(async () => {
    if (!canSend || isSubmitting) return

    // 提交前积分预检（实时查询，避免 session 缓存过时）
    try {
      const creditsRes = await fetchWithAuth("/api/user/credits")
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json()
        if ((creditsData.total ?? 0) < estimatedCost) {
          toast.error(`积分不足（需要 ${estimatedCost}，当前 ${creditsData.total}）`)
          return
        }
      }
    } catch {
      // 预检失败不阻塞提交，由后端兜底
    }

    setIsSubmitting(true)
    setResult(null)
    setSubmitPhase("idle")

    try {
      const fd = new FormData()
      fd.append("model", "sora-2")
      fd.append("prompt", prompt)
      fd.append("seconds", String(videoParams.duration))

      const resolution = videoParams.orientation === 'landscape' ? '1280x720' : '720x1280'
      fd.append("size", resolution)

      if (refFiles.length > 0) {
        const file = refFiles[0]
        if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
          toast.error("参考图格式不支持，仅支持 JPG/PNG/WebP")
          return
        }
        if (file.size > MAX_REFERENCE_IMAGE_SIZE) {
          toast.error(`参考图文件过大（最大 4MB），当前 ${(file.size / 1024 / 1024).toFixed(1)}MB`)
          return
        }

        // 阶段提示：处理图片
        setSubmitPhase("processing-image")
        const [width, height] = resolution.split('x').map(Number)
        const resizedFile = await resizeImageToTarget(file, width, height)

        // 直传 TOS 获取存档 URL（不经过服务端，零带宽开销）
        const { uploadUrl, publicUrl } = await signTosUpload(
          resizedFile.name,
          resizedFile.type || "image/jpeg",
        )
        await uploadToTos(uploadUrl, resizedFile)

        fd.append("input_reference", resizedFile)
        fd.append("referenceImageUrl", publicUrl)
      }

      // 阶段提示：提交任务
      setSubmitPhase("submitting")

      const res = await fetchWithAuth("/api/video/sora2", {
        method: "POST",
        body: fd,
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "生成失败")
      }

      setResult(data.data)

      if (data.data?.id && data.data?.status !== 'completed' && data.data?.status !== 'failed') {
        startPolling(data.data.id)
      }
    } catch (err: any) {
      console.error("[SORA2] 生成失败:", err)
      setResult({
        id: "",
        status: "failed",
        message: err?.message || "生成失败，请重试",
      })
    } finally {
      setIsSubmitting(false)
      setSubmitPhase("idle")
    }
  }, [canSend, isSubmitting, prompt, refFiles, videoParams, session?.user?.credits, session?.user?.bonusCredits, estimatedCost, startPolling])

  return {
    prompt, setPrompt, promptLen, canSend,
    refFiles, setRefFiles,
    videoParams, setVideoParams,
    isSubmitting, submitPhase,
    result, setResult,
    estimatedCost,
    handleSubmit,
    restorePendingTask,
  }
}
