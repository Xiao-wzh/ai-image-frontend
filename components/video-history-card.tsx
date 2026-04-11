"use client"

import { Play, Film, Clock, Loader2, CheckCircle2, AlertCircle, Zap, Timer, Download } from "lucide-react"
import { motion } from "framer-motion"
import { useVideoExpiration } from "@/hooks/use-video-expiration"

export type VideoHistoryItem = {
  id: string
  model: string
  prompt: string
  seconds: number
  size: string
  status: string
  videoUrl?: string | null
  progress: number
  cost: number
  errorMsg?: string | null
  hasRefunded?: boolean
  refreshable?: boolean
  createdAt: string
  completedAt?: string | null
}

type VideoHistoryCardProps = {
  item: VideoHistoryItem
  onClick: () => void
}

/** 获取状态徽章 */
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-medium">
          <CheckCircle2 className="w-3 h-3" /> 已完成
        </span>
      )
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-medium">
          <AlertCircle className="w-3 h-3" /> 失败
        </span>
      )
    case "PROCESSING":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-medium">
          <Loader2 className="w-3 h-3 animate-spin" /> 生成中
        </span>
      )
    case "PENDING":
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 text-[10px] font-medium">
          <Clock className="w-3 h-3" /> 等待
        </span>
      )
  }
}

/** 获取分辨率标签 */
function SizeLabel({ size }: { size: string }) {
  const isPortrait = size === "720x1280"
  return (
    <span className="text-[10px] text-slate-400">
      {isPortrait ? "竖屏" : "横屏"} {size.replace("x", "×")}
    </span>
  )
}

export function VideoHistoryCard({ item, onClick }: VideoHistoryCardProps) {
  const isCompleted = item.status === "COMPLETED"

  // 视频过期判断（统一 Hook）
  const { isExpired, isExpiringSoon, remainingHours } = useVideoExpiration(item.completedAt, item.status)

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -2 }}
      onClick={onClick}
      className="group cursor-pointer rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 hover:border-violet-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/10"
    >
      {/* 视频缩略图区域 */}
      <div className="relative aspect-video overflow-hidden bg-black/40">
        {isCompleted && isExpired ? (
          <div className="w-full h-full flex items-center justify-center">
            <Timer className="w-10 h-10 text-slate-600" />
          </div>
        ) : isCompleted && item.videoUrl ? (
          <video
            src={`${item.videoUrl}#t=0.5`}
            className="w-full h-full object-cover"
            preload="metadata"
            muted
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-10 h-10 text-slate-700" />
          </div>
        )}

        {/* 播放按钮覆盖层 + 快捷下载 */}
        {isCompleted && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-6 h-6 text-white fill-white" />
            </div>
            {item.videoUrl && !isExpired && (
              <a
                href={item.videoUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-violet-500/80 transition-colors"
                title="下载视频"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* 生成中动画 */}
        {item.status === "PROCESSING" && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              <span className="text-xs text-violet-300">生成中 {item.progress}%</span>
            </div>
          </div>
        )}

        {/* 左上角：模型标签 */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-violet-500/80 backdrop-blur-sm text-[10px] text-white font-semibold">
          {item.model.toUpperCase()}
        </div>

        {/* 右上角：状态徽章 */}
        <div className="absolute top-2 right-2">
          <StatusBadge status={item.status} />
        </div>

        {/* 左下角：时长标签 */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] text-white">
          <Clock className="w-3 h-3" />
          <span>{item.seconds}s</span>
        </div>

        {/* 右下角：分辨率 */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
          <SizeLabel size={item.size} />
        </div>
      </div>

      {/* 信息区域 */}
      <div className="p-3 space-y-1.5">
        <p className="text-sm text-white font-medium truncate">{item.prompt}</p>
        {isExpired && (
          <p className="text-[10px] text-red-400 flex items-center gap-1">
            <Timer className="w-3 h-3" />
            视频已过期，资源可能已失效
          </p>
        )}
        {isExpiringSoon && !isExpired && (
          <p className="text-[10px] text-amber-400 flex items-center gap-1">
            <Timer className="w-3 h-3" />
            视频即将过期，请尽快下载保存
          </p>
        )}
        {!isExpired && !isExpiringSoon && isCompleted && remainingHours > 0 && (
          <p className="text-[10px] text-slate-500 flex items-center gap-1">
            <Timer className="w-3 h-3" />
            约 {remainingHours}h 后过期
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {new Date(item.createdAt).toLocaleDateString("zh-CN", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <div className="flex items-center gap-1 text-xs text-violet-400">
            <Zap className="w-3 h-3" />
            <span>{item.cost} 积分</span>
            {item.status === "FAILED" && item.hasRefunded && (
              <span className="text-emerald-400 ml-1">已返还</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
