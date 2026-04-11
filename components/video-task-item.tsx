"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Film, Loader2, AlertCircle, Clock, Zap, Eye, Monitor, RefreshCw, Play, Download, Timer } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import type { VideoHistoryItem } from "@/components/video-history-card"
import { useVideoExpiration } from "@/hooks/use-video-expiration"

interface VideoTaskItemProps {
  item: VideoHistoryItem
  onViewDetails: () => void
  onRefreshSuccess?: () => void
}

export function VideoTaskItem({ item, onViewDetails, onRefreshSuccess }: VideoTaskItemProps) {
  const status = (item.status || "PENDING").toUpperCase()
  const isPending = status === "PENDING" || status === "PROCESSING"
  const isFailed = status === "FAILED"
  const isCompleted = status === "COMPLETED"
  const isPortrait = item.size === "720x1280"

  // 视频过期判断（统一 Hook）
  const { isExpired, isExpiringSoon } = useVideoExpiration(item.completedAt, status)

  const [refreshing, setRefreshing] = useState(false)

  /** 刷新状态：调用 GET API (force=1) 强制从第三方 API 获取最新结果 */
  const handleRefreshStatus = async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/video/sora2/${item.id}?force=1`)
      const data = await res.json()
      if (data.success) {
        const s = data.data?.status?.toUpperCase()
        if (s === "COMPLETED") {
          toast.success("视频已生成完成")
        } else if (s === "FAILED") {
          toast.error("视频生成失败", { description: data.data?.errorMsg || "请重试" })
        } else if (s === "PROCESSING") {
          toast.message("正在生成中", { description: "请稍后再刷新" })
        } else {
          toast.message("等待处理中")
        }
      }
      onRefreshSuccess?.()
    } catch {
      toast.error("刷新状态失败")
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-slate-900/40 hover:border-white/20 hover:bg-slate-900/60 transition-all",
        isFailed && "border-red-500/20 bg-red-950/20 hover:border-red-400/30",
      )}
    >
      {/* 左侧：缩略图 */}
      <div
        className={cn(
          "relative w-20 h-20 rounded-xl overflow-hidden shrink-0 flex items-center justify-center",
          isPending && "bg-gradient-to-br from-violet-900/50 to-slate-900/80",
          isFailed && "bg-gradient-to-br from-slate-900/60 to-red-950/40",
          isCompleted && "bg-black/20",
        )}
      >
        {isPending ? (
          <div className="flex flex-col items-center justify-center gap-1">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            <span className="text-[10px] text-slate-400">生成中</span>
          </div>
        ) : isFailed ? (
          <div className="flex flex-col items-center justify-center gap-1">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <span className="text-[10px] text-red-400">失败</span>
          </div>
        ) : isCompleted && isExpired ? (
          <div className="flex flex-col items-center justify-center gap-1">
            <Timer className="w-6 h-6 text-slate-500" />
            <span className="text-[10px] text-slate-500">已过期</span>
          </div>
        ) : item.videoUrl ? (
          <video
            src={item.videoUrl}
            className="w-full h-full object-cover"
            preload="metadata"
            muted
          />
        ) : (
          <Film className="w-6 h-6 text-slate-600" />
        )}

        {/* 模型角标 */}
        <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-violet-500/80 text-[8px] text-white font-semibold">
          {item.model.toUpperCase()}
        </div>
      </div>

      {/* 中间：信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-semibold text-white text-sm truncate" title={item.prompt}>
            {item.prompt || "未命名视频"}
          </h3>
          {isPending && (
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-1.5 py-0">
              进行中
            </Badge>
          )}
          {isCompleted && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">
              已完成
            </Badge>
          )}
          {isFailed && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0">
              失败
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
            视频
          </span>
          <span className="flex items-center gap-0.5">
            <Clock className="w-3 h-3" />
            {item.seconds}s
          </span>
          <span className="flex items-center gap-0.5">
            <Monitor className="w-3 h-3" />
            {isPortrait ? "竖屏" : "横屏"}
          </span>
          <span className="flex items-center gap-0.5">
            <Zap className="w-3 h-3 text-amber-400" />
            {item.cost} 积分
          </span>
          <span>
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: zhCN })}
          </span>
        </div>

        {isFailed && item.errorMsg && (
          <p className="text-[11px] text-red-400/80 mt-1 truncate">{item.errorMsg}</p>
        )}

        {/* 视频过期/即将过期提示 */}
        {isExpired && (
          <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
            <Timer className="w-3 h-3" />
            视频已过期，资源可能已失效
          </p>
        )}
        {isExpiringSoon && !isExpired && (
          <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
            <Timer className="w-3 h-3" />
            视频即将过期，请尽快下载保存
          </p>
        )}
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-2 shrink-0">
        {isCompleted && item.videoUrl && !isExpired && (
          <Button
            size="sm"
            variant="ghost"
            asChild
            className="text-xs text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 gap-1.5"
          >
            <a href={item.videoUrl} download target="_blank" rel="noopener noreferrer">
              <Download className="w-3.5 h-3.5" />
              下载
            </a>
          </Button>
        )}
        {isCompleted && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onViewDetails}
            className="text-xs text-slate-300 hover:text-white hover:bg-white/10 gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            播放
          </Button>
        )}

        {/* 只有 refreshable 不为 false 时才显示"刷新状态"按钮 */}
        {item.refreshable !== false && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefreshStatus}
            disabled={refreshing}
            className={cn(
              "text-xs gap-1.5",
              isPending
                ? "text-violet-300 hover:text-violet-200 hover:bg-violet-500/10"
                : isFailed
                  ? "text-red-300 hover:text-red-200 hover:bg-red-500/10"
                  : "text-slate-300 hover:text-white hover:bg-white/10",
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            {refreshing ? "查询中" : "刷新状态"}
          </Button>
        )}
      </div>
    </motion.div>
  )
}
