"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Image as ImageIcon,
  Sparkles,
  ArrowUp,
  X,
  Send,
  Clock,
  Layout,
  Layers,
  Zap,
  User,
  Tag,
  Video,
  Film,
  Clapperboard,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { UserAccountNav } from "@/components/user-account-nav"
import { TopBanner } from "@/components/top-banner"
import { ImageUploadZone } from "@/components/image-upload-zone"
import { Button } from "@/components/ui/button"

import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PromptWizardDialog, type StoryboardShot } from "@/components/video/prompt-wizard"
import { StoryboardTimeline } from "@/components/video/storyboard-timeline"

type VideoParams = {
  ratio: "16:9" | "9:16" | "1:1"
  duration: number
  quality: "标准" | "高清" | "超清"
  count: 1 | 2 | 3 | 4
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n))
}

/* ── animation variants ── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
} satisfies import("framer-motion").Variants

const pillSpring = {
  whileHover: { scale: 1.06, transition: { type: "spring" as const, stiffness: 400, damping: 15 } },
  whileTap: { scale: 0.96 },
}

export default function VideoPage() {
  const { data: session, status } = useSession()
  const [refFiles, setRefFiles] = React.useState<File[]>([])
  const [refPreviews, setRefPreviews] = React.useState<string[]>([])
  const [videoParams, setVideoParams] = React.useState<VideoParams>({
    ratio: "9:16",
    duration: 15,
    quality: "标准",
    count: 1,
  })
  const [prompt, setPrompt] = React.useState("")
  const [storyboard, setStoryboard] = React.useState<StoryboardShot[]>([])
  const [wizardOpen, setWizardOpen] = React.useState(false)
  const [focusMode, setFocusMode] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  React.useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    const lineHeight = 24 // ~text-base leading-relaxed
    const minH = lineHeight * 2   // 2 lines
    const maxH = lineHeight * 15  // 15 lines
    el.style.height = `${Math.max(minH, Math.min(maxH, el.scrollHeight))}px`
  }, [prompt])

  React.useEffect(() => {
    const urls = refFiles.map((f) => URL.createObjectURL(f))
    setRefPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [refFiles])

  const promptLen = prompt.length
  const progress = clamp(promptLen / 8000, 0, 1)
  const canSend = prompt.trim().length > 0

  return (
    <div className="relative flex h-screen bg-slate-950 text-white">
      {/* ── Aurora Background ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-blue-600/15 blur-[140px] animate-aurora" />
        <div className="absolute top-40 -left-20 h-[480px] w-[480px] rounded-full bg-fuchsia-500/12 blur-[130px] animate-aurora-delay" />
        <div className="absolute -bottom-40 right-10 h-[560px] w-[560px] rounded-full bg-cyan-400/10 blur-[150px] animate-aurora-slow" />
        <div className="absolute top-1/2 left-1/3 h-[300px] w-[300px] rounded-full bg-violet-500/8 blur-[100px] animate-aurora-delay" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        />
      </div>

      <Sidebar />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <TopBanner />

        <header className="absolute top-0 right-0 z-50 flex items-center gap-3 p-6">
          {status === "loading" ? (
            <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
          ) : session?.user ? (
            <UserAccountNav user={session.user} />
          ) : null}
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="mx-auto max-w-5xl px-8 py-12">

            {/* ── Hero Section ── */}
            <motion.div
              initial="hidden"
              animate="visible"
              className="mb-12 space-y-3"
            >
              <motion.div variants={fadeUp} custom={0} className="flex items-center gap-2.5">
                <motion.div
                  className="flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1.5 backdrop-blur-sm"
                  whileHover={{ scale: 1.05 }}
                >
                  <Video className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-semibold tracking-wider text-blue-300 uppercase">AI Video Production</span>
                </motion.div>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                custom={1}
                className="text-4xl font-bold tracking-tight shimmer-text"
                style={{ WebkitTextFillColor: "transparent" }}
              >
                视频分镜生成
              </motion.h1>

              <motion.p variants={fadeUp} custom={2} className="text-lg text-slate-400 max-w-2xl">
                上传参考图并描述画面，智能生成专业级分镜脚本。
              </motion.p>
            </motion.div>

            {/* ── Console Card ── */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={3}
              className={[
                "relative rounded-[32px] border backdrop-blur-xl shadow-2xl overflow-hidden",
                "transition-all duration-500",
                focusMode
                  ? "border-blue-500/30 video-glow-active bg-slate-900/50"
                  : "border-white/10 video-glow bg-slate-900/35",
              ].join(" ")}
            >
              {/* Glass highlight layer */}
              <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-gradient-to-b from-white/[0.07] via-transparent to-transparent opacity-60" />
              {/* Inner aurora accent */}
              <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-blue-500/10 blur-[60px] animate-aurora" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-violet-500/8 blur-[50px] animate-aurora-delay" />

              <div className="relative p-6">
                <div className="flex items-start gap-6">
                  {/* Left: Image Upload */}
                  <motion.div
                    className="relative shrink-0"
                    whileHover={{ scale: 1.03 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {refPreviews.length > 0 ? (
                      <div className="group relative h-28 w-28 overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-inner ring-1 ring-white/5">
                        <img src={refPreviews[0]} alt="Ref" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                        <button
                          onClick={() => setRefFiles([])}
                          className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 backdrop-blur-sm transition-all group-hover:opacity-100 hover:bg-red-500/80 hover:scale-110"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="group flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] shadow-inner transition-all duration-300 hover:bg-white/[0.08] hover:border-blue-500/30 hover:shadow-blue-500/10 hover:shadow-lg">
                            <motion.div
                              className="rounded-xl bg-white/5 p-3 transition-colors group-hover:bg-blue-500/15"
                              whileHover={{ rotate: [0, -5, 5, 0] }}
                              transition={{ duration: 0.4 }}
                            >
                              <ImageIcon className="h-7 w-7 text-slate-400 transition-colors group-hover:text-blue-400" />
                            </motion.div>
                            <span className="text-xs font-medium text-slate-400 transition-colors group-hover:text-blue-300">参考图</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 overflow-hidden rounded-2xl border-white/10 bg-slate-900/95 p-0 backdrop-blur-xl shadow-2xl" side="bottom" align="start">
                          <div className="p-4">
                            <ImageUploadZone files={refFiles} previewUrls={refPreviews} onFilesChange={setRefFiles} maxFiles={1} />
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </motion.div>

                  {/* Right: Prompt */}
                  <div className="flex-1 space-y-4">
                    <p className="text-sm font-medium text-slate-400">上传商品图并描述视频要素，避免真人或 IP 形象。</p>
                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onFocus={() => setFocusMode(true)}
                        onBlur={() => setFocusMode(false)}
                        placeholder="在此描述视频画面，例如：一个精致的咖啡杯放在木质桌面上，阳光洒在杯口..."
                        rows={2}
                        className="w-full resize-none border-0 bg-transparent p-0 text-base leading-relaxed text-white placeholder:text-slate-600 outline-none ring-0 focus:outline-none focus:ring-0 focus:border-0 shadow-none"
                        style={{ minHeight: '48px', maxHeight: '360px' }}
                      />
                      {/* Animated gradient underline */}
                      <div className="pointer-events-none absolute -bottom-1 left-0 right-0">
                        <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/5">
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: "linear-gradient(90deg, transparent, #3b82f6, #8b5cf6, #3b82f6, transparent)",
                            }}
                            animate={{
                              width: `${Math.max(progress * 100, focusMode ? 30 : 0)}%`,
                              opacity: focusMode || progress > 0 ? 1 : 0,
                            }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Settings Toolbar ── */}
                <div className="mt-6 border-t border-white/[0.06] pt-5 space-y-4">
                  {/* Row 1: Parameter pills + feature buttons */}
                  <div className="overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <div className="inline-flex items-center gap-2.5">
                      {/* Ratio */}
                      <motion.div {...pillSpring}>
                        <Select value={videoParams.ratio} onValueChange={(v) => setVideoParams((p) => ({ ...p, ratio: v as any }))}>
                          <SelectTrigger className="h-9 w-auto gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 text-sm font-medium text-slate-200 transition-all hover:bg-white/10 hover:border-white/20 active:scale-[0.97] shadow-sm">
                            <Layout className="h-3.5 w-3.5 text-blue-400" />
                            <SelectValue placeholder="比例" />
                          </SelectTrigger>
                          <SelectContent><SelectItem value="16:9">16:9</SelectItem><SelectItem value="9:16">9:16</SelectItem><SelectItem value="1:1">1:1</SelectItem></SelectContent>
                        </Select>
                      </motion.div>

                      {/* Duration */}
                      <motion.div {...pillSpring}>
                        <Select value={String(videoParams.duration)} onValueChange={(v) => setVideoParams((p) => ({ ...p, duration: Number(v) }))}>
                          <SelectTrigger className="h-9 w-auto gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 text-sm font-medium text-slate-200 transition-all hover:bg-white/10 hover:border-white/20 active:scale-[0.97] shadow-sm">
                            <Clock className="h-3.5 w-3.5 text-emerald-400" />
                            <SelectValue placeholder="时长" />
                          </SelectTrigger>
                          <SelectContent><SelectItem value="3">3 秒</SelectItem><SelectItem value="5">5 秒</SelectItem><SelectItem value="8">8 秒</SelectItem><SelectItem value="10">10 秒</SelectItem><SelectItem value="15">15 秒</SelectItem></SelectContent>
                        </Select>
                      </motion.div>

                      {/* Quality */}
                      <motion.div {...pillSpring}>
                        <Select value={videoParams.quality} onValueChange={(v) => setVideoParams((p) => ({ ...p, quality: v as any }))}>
                          <SelectTrigger className="h-9 w-auto gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 text-sm font-medium text-slate-200 transition-all hover:bg-white/10 hover:border-white/20 active:scale-[0.97] shadow-sm">
                            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                            <SelectValue placeholder="画质" />
                          </SelectTrigger>
                          <SelectContent><SelectItem value="标准">标准</SelectItem><SelectItem value="高清">高清</SelectItem><SelectItem value="超清">超清</SelectItem></SelectContent>
                        </Select>
                      </motion.div>

                      {/* Count */}
                      <motion.div {...pillSpring}>
                        <Select value={String(videoParams.count)} onValueChange={(v) => setVideoParams((p) => ({ ...p, count: Number(v) as any }))}>
                          <SelectTrigger className="h-9 w-auto gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 text-sm font-medium text-slate-200 transition-all hover:bg-white/10 hover:border-white/20 active:scale-[0.97] shadow-sm">
                            <Layers className="h-3.5 w-3.5 text-purple-400" />
                            <SelectValue placeholder="条数" />
                          </SelectTrigger>
                          <SelectContent><SelectItem value="1">1 条</SelectItem><SelectItem value="2">2 条</SelectItem><SelectItem value="3">3 条</SelectItem><SelectItem value="4">4 条</SelectItem></SelectContent>
                        </Select>
                      </motion.div>

                      {/* Divider */}
                      <div className="h-5 w-px bg-white/10 mx-0.5" />

                      {/* Wizard Button */}
                      <motion.div {...pillSpring}>
                        <Button
                          variant="ghost"
                          onClick={() => setWizardOpen(true)}
                          className="h-9 rounded-full border border-amber-500/20 bg-amber-500/5 px-4 text-sm font-medium text-amber-200 transition-all hover:bg-amber-500/15 hover:border-amber-500/30 active:scale-[0.97] shadow-sm"
                        >
                          <Zap className="mr-2 h-3.5 w-3.5 text-amber-400" />提示词增强
                        </Button>
                      </motion.div>

                      <motion.div {...pillSpring}>
                        <Button variant="ghost" className="h-9 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition-all hover:bg-white/10 active:scale-[0.97] shadow-sm">
                          <User className="mr-2 h-3.5 w-3.5 text-cyan-400" />角色
                        </Button>
                      </motion.div>

                      <motion.div {...pillSpring}>
                        <Button variant="ghost" className="h-9 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition-all hover:bg-white/10 active:scale-[0.97] shadow-sm">
                          <Tag className="mr-2 h-3.5 w-3.5 text-pink-400" />标签
                        </Button>
                      </motion.div>
                    </div>
                  </div>

                  {/* Row 2: Progress + clear + send */}
                  <div className="flex items-center justify-between">
                    {/* Left: progress bar + counter */}
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-blue-500/50"
                          animate={{ width: `${progress * 100}%` }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                        />
                      </div>
                      <span className="text-xs font-medium tabular-nums text-slate-500">{promptLen}/8000</span>
                    </div>

                    {/* Right: clear + send */}
                    <div className="flex items-center gap-3">
                      <AnimatePresence>
                        {promptLen > 0 && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            onClick={() => setPrompt("")}
                            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                          >
                            <X className="h-4 w-4" />
                          </motion.button>
                        )}
                      </AnimatePresence>

                      {/* Send button */}
                      <motion.div
                        whileHover={canSend ? { scale: 1.08, y: -1 } : {}}
                        whileTap={canSend ? { scale: 0.92 } : {}}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      >
                        <Button
                          disabled={!canSend}
                          className={[
                            "group relative h-10 rounded-full px-5 shadow-lg transition-all duration-300 gap-2",
                            canSend
                              ? "bg-gradient-to-r from-blue-500 to-violet-600 text-white hover:shadow-blue-500/30 hover:shadow-xl"
                              : "bg-white/10 text-white/30 cursor-not-allowed",
                          ].join(" ")}
                        >
                          {canSend && (
                            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/20 to-violet-500/20 animate-ping opacity-20" />
                          )}
                          <Send className="relative h-4 w-4 stroke-[2px]" />
                          <span className="relative text-sm font-medium">生成分镜</span>
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Storyboard Section ── */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={5}
              className="mt-16 space-y-8 pb-20"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-2.5 shadow-inner shadow-blue-500/5"
                  whileHover={{ rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <Sparkles className="h-5 w-5 text-blue-400" />
                </motion.div>
                <div>
                  <h2 className="text-xl font-semibold">分镜预览</h2>
                  <p className="text-sm text-slate-500 mt-0.5">生成后在此处展示完整时间轴</p>
                </div>
              </div>

              <StoryboardTimeline
                shots={storyboard}
                className="border-white/5 bg-slate-900/40 backdrop-blur-xl rounded-[32px]"
              />
            </motion.div>
          </div>
        </main>
      </div>

      <PromptWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        durationSeconds={videoParams.duration}
        onApply={(result) => {
          setPrompt(result.prompt)
          setStoryboard(result.storyboard)
        }}
      />
    </div>
  )
}
