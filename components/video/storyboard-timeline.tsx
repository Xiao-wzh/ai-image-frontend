"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Film, Camera, Mic2, Timer, Pencil, RefreshCcw, Clapperboard } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { StoryboardShot } from "@/components/video/prompt-wizard"

const shotVariant = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.1,
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
}

const COLOR_MAP: Record<string, string> = {
  camera: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  film: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  audio: "text-amber-400 bg-amber-500/10 border-amber-500/20",
}

export function StoryboardTimeline(props: {
  shots: StoryboardShot[]
  onEditShot?: (index: number) => void
  onRegenerateShot?: (index: number) => void
  className?: string
}) {
  const { shots, onEditShot, onRegenerateShot, className } = props

  if (!shots || shots.length === 0) {
    return (
      <Card className={cn("border-white/10 bg-white/5 p-8", className)}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <motion.div
            className="relative mb-5"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-violet-500/10 p-5 shadow-inner">
              <Clapperboard className="h-10 w-10 text-slate-400" />
            </div>
            {/* Floating dots */}
            <span className="absolute -top-2 -right-2 h-3 w-3 rounded-full bg-blue-500/40 animate-float" />
            <span className="absolute -bottom-1 -left-3 h-2 w-2 rounded-full bg-violet-500/30 animate-float-delay" />
          </motion.div>
          <div className="text-base font-medium text-white mb-1.5">分镜预览</div>
          <div className="text-sm text-slate-500 max-w-xs">
            使用上方提示词描述视频画面，或打开「提示词增强」向导后，分镜时间轴将在此展示。
          </div>
        </div>
      </Card>
    )
  }

  const total = shots.reduce((acc, s) => acc + (Number.isFinite(s.duration) ? s.duration : 0), 0)

  return (
    <Card className={cn("border-white/10 bg-white/5 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <motion.div
            className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500/15 to-violet-500/15 border border-blue-500/20 flex items-center justify-center shadow-inner"
            whileHover={{ rotate: [0, -8, 8, 0] }}
            transition={{ duration: 0.5 }}
          >
            <Film className="h-5 w-5 text-blue-400" />
          </motion.div>
          <div>
            <div className="text-sm font-semibold text-white">分镜时间轴</div>
            <div className="text-xs text-slate-500 mt-0.5">
              共 <span className="text-slate-300 font-medium">{shots.length}</span> 个镜头
              <span className="mx-1.5 text-slate-700">·</span>
              约 <span className="text-blue-400 font-medium">{total.toFixed(1)}s</span>
            </div>
          </div>
        </div>

        {/* Duration bar */}
        <div className="hidden md:flex items-center gap-3">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-500/60 via-violet-500/60 to-fuchsia-500/60"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
          <span className="text-xs font-medium text-slate-400 tabular-nums">{total.toFixed(1)}s</span>
        </div>
      </div>

      {/* Timeline body */}
      <div className="p-5">
        <div className="relative">
          {/* Animated timeline connector */}
          <div className="absolute left-[15px] top-0 bottom-0 w-px overflow-hidden">
            <div className="h-full w-full bg-gradient-to-b from-blue-500/30 via-violet-500/20 to-transparent animate-timeline-pulse" />
          </div>

          <motion.div
            className="grid gap-4"
            initial="hidden"
            animate="visible"
          >
            {shots.map((shot, idx) => {
              const durationLabel = `${shot.duration ?? "-"}s`
              return (
                <motion.div
                  key={idx}
                  variants={shotVariant}
                  custom={idx}
                  className="relative pl-10"
                >
                  {/* Timeline dot */}
                  <motion.div
                    className="absolute left-[7px] top-3.5 h-4 w-4 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 ring-4 ring-blue-500/10 shadow-sm shadow-blue-500/20"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.1 + 0.2, type: "spring", stiffness: 400, damping: 15 }}
                  />

                  {/* Shot card */}
                  <motion.div
                    className="group rounded-2xl border border-white/[0.08] bg-slate-950/40 backdrop-blur-sm transition-all duration-300 hover:border-white/15 hover:bg-slate-950/60 hover:shadow-lg hover:shadow-blue-500/5"
                    whileHover={{ y: -2 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            镜头 {String(idx + 1).padStart(2, "0")}
                          </div>
                          <div className="mt-2 text-sm font-medium text-white leading-relaxed">
                            {shot.text || "（暂无画面描述）"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Duration badge */}
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-300">
                            <Timer className="h-3.5 w-3.5" />
                            {durationLabel}
                          </div>

                          {/* Action buttons - appear on hover */}
                          <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEditShot?.(idx)}
                                className="h-8 w-8 rounded-full p-0 text-slate-400 hover:bg-white/10 hover:text-white"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRegenerateShot?.(idx)}
                                className="h-8 w-8 rounded-full p-0 text-slate-400 hover:bg-white/10 hover:text-white"
                              >
                                <RefreshCcw className="h-3.5 w-3.5" />
                              </Button>
                            </motion.div>
                          </div>
                        </div>
                      </div>

                      {/* Metadata grid */}
                      <div className="mt-4 grid gap-2.5 md:grid-cols-3">
                        {/* Camera */}
                        <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/[0.04] p-2.5">
                          <div className="flex items-center gap-1.5 text-xs text-cyan-400 mb-1">
                            <Camera className="h-3 w-3" />
                            <span className="font-medium">镜头控制</span>
                          </div>
                          <div className="text-sm text-slate-300 leading-relaxed">
                            {shot.camera || "-"}
                          </div>
                        </div>

                        {/* Scene */}
                        <div className="rounded-xl border border-violet-500/10 bg-violet-500/[0.04] p-2.5">
                          <div className="flex items-center gap-1.5 text-xs text-violet-400 mb-1">
                            <Film className="h-3 w-3" />
                            <span className="font-medium">画面描述</span>
                          </div>
                          <div className="text-sm text-slate-300 leading-relaxed">
                            {shot.text || "-"}
                          </div>
                        </div>

                        {/* Audio */}
                        <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.04] p-2.5">
                          <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-1">
                            <Mic2 className="h-3 w-3" />
                            <span className="font-medium">旁白 / 音频</span>
                          </div>
                          <div className="text-sm text-slate-300 leading-relaxed">
                            {shot.audio || "-"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </div>
    </Card>
  )
}
