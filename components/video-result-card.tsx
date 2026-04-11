"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, RefreshCw, Loader2, Timer, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { VideoResult } from "@/lib/video/status"
import { getVideoStatusIcon, getVideoStatusText } from "@/lib/video/status"

type VideoResultCardProps = {
  result: VideoResult | null
  submitPhase: "idle" | "processing-image" | "submitting"
  isTaskActive?: boolean
  onRetry: () => void
  onReset: () => void
}

/** 等待时随机显示的小贴士 */
const WAITING_TIPS = [
  "提示词越具体，生成效果越好",
  "可以趁等待时间准备下一个视频的提示词",
  "上传参考图能让 AI 更好地理解你的意图",
  "视频内容越简单，生成质量通常越高",
]

function getPhaseText(phase: VideoResultCardProps["submitPhase"]): string | null {
  switch (phase) {
    case "processing-image": return "正在处理参考图..."
    case "submitting": return "正在提交生成任务..."
    default: return null
  }
}

export function VideoResultCard({ result, submitPhase, isTaskActive, onRetry, onReset }: VideoResultCardProps) {
  // 随机选择一条提示（只在挂载时选一次）
  const [tipIndex] = React.useState(() => Math.floor(Math.random() * WAITING_TIPS.length))

  if (!result && submitPhase === "idle") return null

  // 提交阶段提示（result 还未返回时）
  if (!result && submitPhase !== "idle") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={isTaskActive ? "mt-4" : "mt-8"}
      >
        <div className="rounded-[24px] border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            <span className="text-sm">{getPhaseText(submitPhase)}</span>
          </div>
        </div>
      </motion.div>
    )
  }

  if (!result) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={result.id || "result"}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={isTaskActive ? "mt-4" : "mt-8"}
      >
        <div className="rounded-[24px] border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
          {/* 状态栏 */}
          <div className="flex items-center gap-3 mb-4">
            {getVideoStatusIcon(result.status)}
            <span className="text-sm font-medium">{getVideoStatusText(result.status)}</span>
            {result.cost != null && (
              <span className="text-xs text-violet-400 ml-2">消耗 {result.cost} 积分</span>
            )}
          </div>

          {/* 成功：视频播放 + 下载 */}
          {result.status === "completed" && result.videoUrl && (
            <div className="space-y-4">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black/50">
                <video
                  src={result.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  poster="/video-placeholder.png"
                />
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Timer className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300">视频资源仅保留约24小时，请尽快下载保存到本地</p>
              </div>
              <div className="flex gap-3">
                <Button
                  asChild
                  className="flex-1 bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700"
                >
                  <a href={result.videoUrl} download target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" />
                    下载视频
                  </a>
                </Button>
                <Button
                  variant="outline"
                  onClick={onReset}
                  className="border-white/10 bg-white/5 hover:bg-white/10"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重新生成
                </Button>
              </div>
            </div>
          )}

          {/* 失败/超时 */}
          {(result.status === "failed" || result.status === "timeout") && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">{result.message || "生成失败，请重试"}</p>
              {result.cost != null && result.cost > 0 && (
                <p className="text-xs text-emerald-400">消耗的 {result.cost} 积分已返还</p>
              )}
              <Button
                onClick={onRetry}
                className="bg-gradient-to-r from-violet-500 to-fuchsia-600"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                重试
              </Button>
            </div>
          )}

          {/* 处理中：留客机制 — 预计时间 + 小贴士 */}
          {(result.status === "pending" || result.status === "processing") && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                <span className="text-sm">视频生成中，预计需要 2-5 分钟...</span>
              </div>
              {/* 进度条（有进度时显示） */}
              {result.progress != null && result.progress > 0 && (
                <div className="w-full">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>生成进度</span>
                    <span>{result.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${result.progress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}
              {/* 小贴士 */}
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/10">
                <Lightbulb className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-violet-300/70 leading-relaxed">{WAITING_TIPS[tipIndex]}</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
