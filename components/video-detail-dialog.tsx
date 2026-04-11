"use client"

import { Download, X, Film, Clock, Zap, Monitor, Timer, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { VideoHistoryItem } from "@/components/video-history-card"
import { useVideoExpiration } from "@/hooks/use-video-expiration"

type VideoDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: VideoHistoryItem | null
}

export function VideoDetailDialog({ open, onOpenChange, item }: VideoDetailDialogProps) {
  // Hooks 必须在条件返回之前调用（React Hooks 规则）
  const { isExpired, isExpiringSoon } = useVideoExpiration(item?.completedAt ?? null, item?.status ?? null)

  if (!item) return null

  const isCompleted = item.status === "COMPLETED" && item.videoUrl
  const isPortrait = item.size === "720x1280"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] bg-slate-950 border-white/10 p-0 overflow-hidden">
        <DialogTitle className="sr-only">视频详情</DialogTitle>

        {/* 视频播放器 / 过期占位 */}
        <div className={`relative overflow-hidden bg-black ${isPortrait ? "max-h-[60vh]" : "aspect-video"}`}>
          {isCompleted && isExpired ? (
            <div className="w-full h-full min-h-[300px] flex items-center justify-center">
              <div className="text-center space-y-3">
                <Film className="w-16 h-16 text-slate-700 mx-auto" />
                <p className="text-slate-400 text-sm">视频已过期</p>
                <p className="text-slate-600 text-xs">资源已被删除，无法播放</p>
              </div>
            </div>
          ) : isCompleted ? (
            <video
              src={item.videoUrl!}
              controls
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full min-h-[300px] flex items-center justify-center">
              <div className="text-center space-y-3">
                <Film className="w-16 h-16 text-slate-700 mx-auto" />
                <p className="text-slate-500 text-sm">
                  {item.status === "PROCESSING" ? "视频生成中..." :
                   item.status === "FAILED" ? "生成失败" : "等待处理"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 信息区域 */}
        <div className="p-5 space-y-4">
          {/* 过期提醒横幅 */}
          {isExpired && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">视频已过期，资源可能已被删除无法播放。建议后续视频生成后尽快下载保存。</p>
            </div>
          )}
          {isExpiringSoon && !isExpired && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Timer className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">视频资源即将过期（约保留24小时），请尽快下载保存到本地，过期后视频将无法播放。</p>
            </div>
          )}

          {/* 提示词 */}
          <div>
            <h4 className="text-xs text-slate-500 mb-1 font-medium">提示词</h4>
            <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{item.prompt}</p>
          </div>

          {/* 生成信息 */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-xs text-slate-300">
              <Film className="w-3.5 h-3.5 text-violet-400" />
              <span>{item.model.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-xs text-slate-300">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{item.seconds} 秒</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-xs text-slate-300">
              <Monitor className="w-3.5 h-3.5 text-blue-400" />
              <span>{isPortrait ? "竖屏" : "横屏"} {item.size.replace("x", "×")}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-xs text-slate-300">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{item.cost} 积分</span>
            </div>
          </div>

          {/* 下载按钮 / 过期提示按钮 */}
          {isCompleted && !isExpired && (
            <div className="flex gap-3 pt-2">
              <Button
                asChild
                className="flex-1 bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700"
              >
                <a href={item.videoUrl!} download target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 mr-2" />
                  下载视频到本地
                </a>
              </Button>
            </div>
          )}
          {isExpired && isCompleted && (
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-white/10 bg-white/5 hover:bg-white/10">
                知道了
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
