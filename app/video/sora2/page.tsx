"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Image as ImageIcon,
  X,
  Send,
  Clock,
  Layout,
  Loader2,
  Play,
  Film,
  Zap,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { UserAccountNav } from "@/components/user-account-nav"
import { TopBanner } from "@/components/top-banner"
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
import { ImageUploadZone } from "@/components/image-upload-zone"
import { useCost } from "@/hooks/use-costs"
import { useVideoGeneration, DURATION_OPTIONS } from "@/hooks/use-video-generation"
import { VideoResultCard } from "@/components/video-result-card"
import { MAX_REFERENCE_IMAGE_SIZE } from "@/lib/video/constants"

type VideoOrientation = "portrait" | "landscape"

// 示例提示词
const EXAMPLE_PROMPTS = [
  "做一个产品宣发视频，要求顶级运镜和质感，出现的营销文字不允许发生任何变形和乱码，每个笔画必须清晰可见，风格参照赫莲娜品牌的产品宣发，中文",
  "帮我做一个抖音产品宣传视频，这款三合一剃须刀，随时替换刀头",
  "运动鞋在空中翻转，背景是纯色渐变，光影动态变化",
]

/* ── 动画变体 ── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
} satisfies import("framer-motion").Variants

const pillSpring = {
  whileHover: { scale: 1.06, transition: { type: "spring" as const, stiffness: 400, damping: 12 } },
  whileTap: { scale: 0.96 },
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n))
}

export default function Sora2VideoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // 从后端获取实时单价
  const costPerSecond = useCost("VIDEO_SORA2_COST_PER_SECOND")

  // 视频生成核心逻辑（状态 + 提交 + 轮询）
  const {
    prompt, setPrompt, promptLen, canSend,
    refFiles, setRefFiles,
    videoParams, setVideoParams,
    isSubmitting, submitPhase,
    result, setResult,
    estimatedCost,
    handleSubmit,
    restorePendingTask,
  } = useVideoGeneration({ costPerSecond })

  // 图片预览 URL
  const [refPreviews, setRefPreviews] = React.useState<string[]>([])
  const [focusMode, setFocusMode] = React.useState(false)
  const [examplesCollapsed, setExamplesCollapsed] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // 是否有活跃的生成任务（控制台折叠判断）
  const isTaskActive = result?.status === "pending" || result?.status === "processing"

  // 权限检查
  React.useEffect(() => {
    if (status === "loading") return
    if (!session?.user) {
      router.replace("/login")
    }
  }, [session, status, router])

  // 页面加载时恢复未完成任务
  React.useEffect(() => {
    if (status !== "authenticated" || !session?.user) return
    restorePendingTask()
  // restorePendingTask 是 useCallback 依赖 session，直接依赖 status/session 即可
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session])

  // 图片预览
  React.useEffect(() => {
    const urls = refFiles.map((f) => URL.createObjectURL(f))
    setRefPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [refFiles])

  // 自动调整文本框高度
  React.useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    const lineHeight = 24
    const minH = lineHeight * 2
    const maxH = lineHeight * 10
    el.style.height = `${Math.max(minH, Math.min(maxH, el.scrollHeight))}px`
  }, [prompt])

  // Ctrl+Enter 快捷提交
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canSend && !isSubmitting) {
        e.preventDefault()
        handleSubmit()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [canSend, isSubmitting, handleSubmit])

  const progress = clamp(promptLen / 2000, 0, 1)
  const charsNeeded = Math.max(0, 10 - prompt.trim().length)

  return (
    <div className="relative flex h-screen bg-slate-950 text-white">
      {/* ── 极光背景 ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:[&__*]:!animate-none">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[140px] animate-aurora" />
        <div className="absolute top-40 -left-20 h-[480px] w-[480px] rounded-full bg-fuchsia-500/12 blur-[130px] animate-aurora-delay" />
        <div className="absolute -bottom-40 right-10 h-[560px] w-[560px] rounded-full bg-purple-400/10 blur-[150px] animate-aurora-slow" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        />
      </div>

      <Sidebar />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <TopBanner />

        <header className="absolute top-0 right-0 z-50 flex items-center gap-3 max-sm:p-3 sm:p-6">
          {status === "loading" ? (
            <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
          ) : session?.user ? (
            <UserAccountNav user={session.user} />
          ) : null}
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
            {/* ── 标题区域 ── */}
            <motion.div initial="hidden" animate="visible" className="mb-8 sm:mb-10 space-y-3">
              <motion.div variants={fadeUp} custom={0} className="flex items-center gap-2.5">
                <motion.div
                  className="flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3.5 py-1.5 backdrop-blur-sm"
                  whileHover={{ scale: 1.05 }}
                >
                  <Film className="h-4 w-4 text-violet-400" />
                  <span className="text-xs font-semibold tracking-wider text-violet-300 uppercase">Sora 2 Pro</span>
                </motion.div>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                custom={1}
                className="text-2xl sm:text-3xl font-bold tracking-tight"
                style={{
                  background: "linear-gradient(135deg, #a78bfa 0%, #f472b6 50%, #fb923c 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AI 视频生成
              </motion.h1>

              <motion.p variants={fadeUp} custom={2} className="text-sm sm:text-base text-slate-400 max-w-xl">
                上传参考图并描述你想要的视频画面，Sora 2 将为你生成高质量 720p 视频
              </motion.p>
              <motion.div variants={fadeUp} custom={3} className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 max-w-xl">
                <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  <span className="font-medium text-amber-300">提示：</span>视频质量完全取决于你的提示词。平台不预设任何提示词。
                </p>
              </motion.div>
            </motion.div>

            {/* ── 主控制台 ── */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={4}
              className={[
                "relative rounded-[20px] sm:rounded-[28px] border backdrop-blur-xl shadow-2xl overflow-hidden",
                "transition-all duration-500",
                focusMode
                  ? "border-violet-500/30 bg-slate-900/60"
                  : "border-white/10 bg-slate-900/40",
              ].join(" ")}
            >
              {/* 玻璃高光层 */}
              <div className="pointer-events-none absolute inset-0 rounded-[20px] sm:rounded-[28px] bg-gradient-to-b from-white/[0.07] via-transparent to-transparent opacity-60" />
              <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-violet-500/10 blur-[60px] animate-aurora" />

              <div className="relative p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-5">
                  {/* 左侧：图片上传 */}
                  <motion.div
                    className="relative shrink-0 self-center sm:self-start"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {refPreviews.length > 0 ? (
                      <div className="group relative h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-inner">
                        <img src={refPreviews[0]} alt="参考图" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
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
                          <button className="group flex h-20 w-20 sm:h-24 sm:w-24 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-500/20 bg-violet-500/[0.03] shadow-inner transition-all duration-300 hover:bg-violet-500/[0.08] hover:border-violet-500/30 hover:shadow-violet-500/10 hover:shadow-lg">
                            <motion.div
                              className="rounded-xl bg-violet-500/5 p-2.5 transition-colors group-hover:bg-violet-500/15"
                              whileHover={{ rotate: [0, -5, 5, 0] }}
                              transition={{ duration: 0.4 }}
                            >
                              <ImageIcon className="h-5 w-5 text-violet-400/70 transition-colors group-hover:text-violet-400" />
                            </motion.div>
                            <span className="text-[10px] font-medium text-violet-300/60 transition-colors group-hover:text-violet-300">参考图</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 overflow-hidden rounded-2xl border-white/10 bg-slate-900/95 p-0 backdrop-blur-xl shadow-2xl" side="bottom" align="start">
                          <div className="p-3">
                            <ImageUploadZone files={refFiles} previewUrls={refPreviews} onFilesChange={setRefFiles} maxFiles={1} maxSize={MAX_REFERENCE_IMAGE_SIZE} />
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </motion.div>

                  {/* 右侧：提示词输入 */}
                  <div className="flex-1 w-full space-y-3">
                    <p className="text-xs text-slate-500">描述视频内容，避免出现真人或受版权保护的 IP 形象</p>
                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onFocus={() => setFocusMode(true)}
                        onBlur={() => setFocusMode(false)}
                        placeholder="例如：一个精致的咖啡杯放在木质桌面上，阳光透过窗户洒在杯口，蒸汽缓缓升起..."
                        maxLength={2000}
                        rows={2}
                        className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-white placeholder:text-slate-600 outline-none"
                        style={{ minHeight: '48px', maxHeight: '240px' }}
                      />
                      <div className="pointer-events-none absolute -bottom-1 left-0 right-0">
                        <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/5">
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: "linear-gradient(90deg, transparent, #a78bfa, #f472b6, #a78bfa, transparent)",
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

                {/* ── 参数工具栏 ── */}
                <div className="mt-4 sm:mt-5 border-t border-white/[0.06] pt-3 sm:pt-4 space-y-4">
                  <div className="overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <div className="inline-flex items-center gap-2">
                      {/* 方向 */}
                      <motion.div {...pillSpring}>
                        <Select
                          value={videoParams.orientation}
                          onValueChange={(v) => setVideoParams((p) => ({ ...p, orientation: v as VideoOrientation }))}
                        >
                          <SelectTrigger className="h-8 w-auto gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-3 text-xs font-medium text-violet-200 hover:bg-violet-500/10">
                            <Layout className="h-3.5 w-3.5 text-violet-400" />
                            <SelectValue placeholder="方向" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="portrait">竖屏 9:16 (720p)</SelectItem>
                            <SelectItem value="landscape">横屏 16:9 (720p)</SelectItem>
                          </SelectContent>
                        </Select>
                      </motion.div>

                      {/* 时长 */}
                      <motion.div {...pillSpring}>
                        <Select
                          value={String(videoParams.duration)}
                          onValueChange={(v) => setVideoParams((p) => ({ ...p, duration: Number(v) }))}
                        >
                          <SelectTrigger className="h-8 w-auto gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-200 hover:bg-white/10">
                            <Clock className="h-3.5 w-3.5 text-emerald-400" />
                            <SelectValue placeholder="时长" />
                          </SelectTrigger>
                          <SelectContent>
                            {DURATION_OPTIONS.map((d) => (
                              <SelectItem key={d} value={String(d)}>{d} 秒 ({d * costPerSecond} 积分)</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </motion.div>

                      {/* 水印开关 */}
                      {/* <motion.div {...pillSpring}>
                        <button
                          onClick={() => setVideoParams((p) => ({ ...p, watermark: !p.watermark }))}
                          className={`h-8 rounded-full border px-3 text-xs font-medium transition-all ${videoParams.watermark
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                              : "border-white/10 bg-white/5 text-slate-400"
                            }`}
                        >
                          {videoParams.watermark ? "去水印" : "带水印"}
                        </button>
                      </motion.div> */}
                    </div>
                  </div>

                  {/* 进度条 + 费用 + 发送 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="h-1.5 w-16 sm:w-24 overflow-hidden rounded-full bg-white/5 shrink-0">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500/50 via-fuchsia-500/50 to-violet-500/50"
                          animate={{ width: `${progress * 100}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-slate-500 whitespace-nowrap">{promptLen}/2000</span>
                      <span className="text-xs text-violet-400 font-medium whitespace-nowrap hidden sm:inline">预估: {estimatedCost} 积分</span>
                      <span className="text-xs text-violet-400 font-medium sm:hidden">{estimatedCost}分</span>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      {/* 字数不足提示 */}
                      <AnimatePresence>
                        {charsNeeded > 0 && promptLen > 0 && (
                          <motion.span
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            className="text-[10px] text-slate-500 whitespace-nowrap hidden sm:inline"
                          >
                            还需 {charsNeeded} 字
                          </motion.span>
                        )}
                      </AnimatePresence>

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

                      <motion.div
                        whileHover={canSend && !isSubmitting ? { scale: 1.08, y: -1 } : {}}
                        whileTap={canSend && !isSubmitting ? { scale: 0.92 } : {}}
                      >
                        <Button
                          disabled={!canSend || isSubmitting}
                          onClick={handleSubmit}
                          title={charsNeeded > 0 ? `还需输入 ${charsNeeded} 个字符` : "发送 (Ctrl+Enter)"}
                          className={[
                            "group relative h-10 w-10 rounded-full p-0 shadow-lg transition-all duration-300",
                            canSend && !isSubmitting
                              ? "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white hover:shadow-violet-500/30 hover:shadow-xl"
                              : "bg-white/10 text-white/30 cursor-not-allowed",
                          ].join(" ")}
                        >
                          {canSend && !isSubmitting && (
                            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-400/20 to-fuchsia-500/20 animate-ping opacity-20" />
                          )}
                          {isSubmitting ? (
                            <Loader2 className="relative h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="relative h-4 w-4 stroke-[2px]" />
                          )}
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── 生成结果（处理中时上移到控制台紧下方） ── */}
            <VideoResultCard
              result={result}
              submitPhase={submitPhase}
              isTaskActive={isTaskActive}
              onRetry={() => { setResult(null); handleSubmit() }}
              onReset={() => setResult(null)}
            />

            {/* ── 示例提示词（可收起面板，输入/生成中时保持可访问） ── */}
            <div className="mt-6">
              <button
                onClick={() => setExamplesCollapsed(!examplesCollapsed)}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors mb-3"
              >
                <span className="text-[10px]">{examplesCollapsed ? "▶" : "▼"}</span>
                <span>示例提示词</span>
              </button>
              {!examplesCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {EXAMPLE_PROMPTS.map((text, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setPrompt(text)}
                      className="text-left rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-all hover:border-violet-500/20 hover:bg-violet-500/5 group"
                    >
                      <p className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 line-clamp-2">{text}</p>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* ── 使用说明 ── */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={5}
              className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
            >
              {[
                { icon: ImageIcon, title: "上传参考图", desc: "可选，帮助 AI 更好理解你的意图" },
                { icon: Zap, title: "描述画面", desc: "详细描述视频内容、场景、动作" },
                { icon: Play, title: "生成视频", desc: "等待 2-5 分钟即可获得 720p 高质量视频" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-violet-500/20 hover:bg-violet-500/5"
                >
                  <div className="rounded-lg bg-violet-500/10 p-2">
                    <item.icon className="h-4 w-4 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">{item.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}
