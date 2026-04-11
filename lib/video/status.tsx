import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import type { ReactNode } from "react"

export type VideoResultStatus = "pending" | "processing" | "completed" | "failed" | "timeout"

export type VideoResult = {
  id: string
  taskId?: string
  status: VideoResultStatus
  progress?: number
  videoUrl?: string
  cost?: number
  costPerSecond?: number
  hasRefunded?: boolean
  message?: string
}

/** 获取状态图标 */
export function getVideoStatusIcon(status: VideoResultStatus): ReactNode {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-emerald-400" />
    case "failed":
    case "timeout":
      return <AlertCircle className="h-5 w-5 text-red-400" />
    case "processing":
    case "pending":
    default:
      return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
  }
}

/** 获取状态文案 */
export function getVideoStatusText(status: VideoResultStatus): string {
  switch (status) {
    case "completed":
      return "生成完成"
    case "failed":
      return "生成失败"
    case "timeout":
      return "生成超时"
    case "processing":
      return "正在生成..."
    case "pending":
    default:
      return "等待处理"
  }
}
