"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Video,
  Sparkles,
  Image as ImageIcon,
  X,
  Send,
  Clock,
  Layout,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Download,
  RefreshCw,
  Film,
  Zap,
  Settings,
  Timer,
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
import { toast } from "sonner"
import { ALLOWED_IMAGE_TYPES, MAX_REFERENCE_IMAGE_SIZE } from "@/lib/video/constants"

type VideoOrientation = "portrait" | "landscape"

type VideoParams = {
  orientation: VideoOrientation
  duration: number
  watermark: boolean
}

type VideoResult = {
  id: string                   // 数据库记录 ID
  taskId?: string              // 远程任务 ID（可选）
  status: "pending" | "processing" | "completed" | "failed" | "timeout"
  progress?: number            // 进度 0-100
  videoUrl?: string
  cost?: number
  costPerSecond?: number
  message?: string
}

const DURATION_OPTIONS = [4, 8, 12]

// 示例提示词
const EXAMPLE_PROMPTS = [
  "一杯热咖啡放在木质桌面，蒸汽缓缓升起，背景是模糊的窗景",
  "化妆品瓶身特写，金色光线下缓缓旋转，水滴在瓶身上滑落",
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

/**
 * 调整图片尺寸以匹配目标分辨率
 * 使用 Canvas 进行居中裁剪
 */
async function resizeImageToTarget(
  file: File,
  targetWidth: number,
  targetHeight: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = targetWidth
      canvas.height = targetHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("无法创建 Canvas 上下文"))
        return
      }

      const srcRatio = img.width / img.height
      const targetRatio = targetWidth / targetHeight

      let sx = 0, sy = 0, sw = img.width, sh = img.height

      if (srcRatio > targetRatio) {
        sw = img.height * targetRatio
        sx = (img.width - sw) / 2
      } else {
        sh = img.width / targetRatio
        sy = (img.height - sh) / 2
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("图片转换失败"))
            return
          }
          const resizedFile = new File([blob], file.name, {
            type: file.type || "image/jpeg",
            lastModified: Date.now(),
          })
          resolve(resizedFile)
        },
        file.type || "image/jpeg",
        0.92
      )
    }
    img.onerror = () => reject(new Error("图片加载失败"))
    img.src = URL.createObjectURL(file)
  })
}

export default function Sora2VideoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // 从后端获取实时单价
  const costPerSecond = useCost("VIDEO_SORA2_COST_PER_SECOND")

  // 状态
  const [refFiles, setRefFiles] = React.useState<File[]>([])
  const [refPreviews, setRefPreviews] = React.useState<string[]>([])
  const [prompt, setPrompt] = React.useState("")
  const [videoParams, setVideoParams] = React.useState<VideoParams>({
    orientation: "portrait",
    duration: 12,
    watermark: true,
  })
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [result, setResult] = React.useState<VideoResult | null>(null)
  const [focusMode, setFocusMode] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const pollingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // 权限检查
  React.useEffect(() => {
    if (status === "loading") return
    if (!session?.user) {
      router.replace("/login")
    }
  }, [session, status, router])

  // 页面加载时自动恢复未完成的任务（PENDING / PROCESSING）
  React.useEffect(() => {
    if (status !== "authenticated" || !session?.user) return
    let cancelled = false
    ;(async () => {
      try {
        // 查询最近的视频任务，手动筛选未完成的
        const res = await fetch("/api/history?type=video&limit=5")
        if (!res.ok) return
        const data = await res.json()
        const items: any[] = data.items ?? []
        if (cancelled) return
        // 找到最新的未完成任务
        const pending = items.find((item: any) => {
          const s = (item.status || "").toUpperCase()
          return s === "PENDING" || s === "PROCESSING"
        })
        if (!pending) {
          return
        }
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
    })()
    return () => { cancelled = true }
  // startPolling 是稳定的 useCallback([])，无需加入依赖
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

  // 组件卸载时清理轮询
  React.useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current)
      }
    }
  }, [])

  const promptLen = prompt.length
  const progress = clamp(promptLen / 2000, 0, 1)
  const canSend = prompt.trim().length >= 10

  // 预估费用（实时单价）
  const estimatedCost = videoParams.duration * costPerSecond

  // 提交视频生成
  const handleSubmit = React.useCallback(async () => {
    if (!canSend || isSubmitting) return

    // 提交前积分预检
    const totalCredits = (session?.user?.credits ?? 0) + (session?.user?.bonusCredits ?? 0)
    if (totalCredits < estimatedCost) {
      toast.error(`积分不足（需要 ${estimatedCost}，当前 ${totalCredits}）`)
      return
    }

    setIsSubmitting(true)
    setResult(null)

    try {
      const fd = new FormData()
      fd.append("model", "sora-2")
      fd.append("prompt", prompt)
      fd.append("seconds", String(videoParams.duration))

      // Sora-2 仅支持 720p
      const resolution = videoParams.orientation === 'landscape' ? '1280x720' : '720x1280'
      fd.append("size", resolution)

      if (refFiles.length > 0) {
        const file = refFiles[0]
        // 前端文件校验
        if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
          toast.error(`参考图格式不支持，仅支持 JPG/PNG/WebP`)
          return
        }
        if (file.size > MAX_REFERENCE_IMAGE_SIZE) {
          toast.error(`参考图文件过大（最大 4MB），当前 ${(file.size / 1024 / 1024).toFixed(1)}MB`)
          return
        }
        const [width, height] = resolution.split('x').map(Number)
        const resizedFile = await resizeImageToTarget(file, width, height)
        fd.append("input_reference", resizedFile)
      }

      const res = await fetch("/api/video/sora2", {
        method: "POST",
        body: fd,
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "生成失败")
      }

      setResult(data.data)

      // 开始指数退避轮询
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
    }
  }, [canSend, isSubmitting, prompt, refFiles, videoParams, session?.user?.credits, session?.user?.bonusCredits, estimatedCost])

  // 指数退避轮询
  const startPolling = React.useCallback((taskId: string) => {
    let interval = 5000           // 初始 5 秒
    const maxInterval = 30000     // 最大 30 秒
    const maxDuration = 5 * 60 * 1000  // 最多轮询 5 分钟
    const startTime = Date.now()

    const poll = async () => {
      // 超时检查
      if (Date.now() - startTime > maxDuration) {
        setResult(prev => prev ? { ...prev, status: "timeout" as const } : null)
        return
      }

      try {
        const res = await fetch(`/api/video/sora2/${taskId}`)
        const data = await res.json()
        if (!res.ok || !data.success) {
          console.error("[SORA2] 轮询失败:", data.error)
          // 不立即停止，继续重试
        } else {
          setResult(data.data)

          // 终态停止轮询
          if (data.data.status === 'completed' || data.data.status === 'failed') {
            return
          }
        }

        // 指数退避：每次轮询间隔 × 1.5，上限 30 秒
        interval = Math.min(interval * 1.5, maxInterval)
        pollingTimerRef.current = setTimeout(poll, interval)
      } catch {
        // 网络错误，继续重试
        pollingTimerRef.current = setTimeout(poll, interval)
      }
    }

    pollingTimerRef.current = setTimeout(poll, interval)
  }, [])

  const getStatusIcon = (status: VideoResult["status"]) => {
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

  const getStatusText = (status: VideoResult["status"]) => {
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

  return (
    <div className="relative flex h-screen bg-slate-950 text-white">
      {/* ── 极光背景 ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
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

        <header className="absolute top-0 right-0 z-50 flex items-center gap-3 p-6">
          {status === "loading" ? (
            <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
          ) : session?.user ? (
            <UserAccountNav user={session.user} />
          ) : null}
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="mx-auto max-w-4xl px-8 py-12">
            {/* ── 标题区域 ── */}
            <motion.div initial="hidden" animate="visible" className="mb-10 space-y-3">
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
                className="text-3xl font-bold tracking-tight"
                style={{
                  background: "linear-gradient(135deg, #a78bfa 0%, #f472b6 50%, #fb923c 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AI 视频生成
              </motion.h1>

              <motion.p variants={fadeUp} custom={2} className="text-base text-slate-400 max-w-xl">
                上传参考图并描述你想要的视频画面，Sora 2 将为你生成高质量 720p 视频
              </motion.p>
            </motion.div>

            {/* ── 主控制台 ── */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={3}
              className={[
                "relative rounded-[28px] border backdrop-blur-xl shadow-2xl overflow-hidden",
                "transition-all duration-500",
                focusMode
                  ? "border-violet-500/30 bg-slate-900/60"
                  : "border-white/10 bg-slate-900/40",
              ].join(" ")}
            >
              {/* 玻璃高光层 */}
              <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-b from-white/[0.07] via-transparent to-transparent opacity-60" />
              <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-violet-500/10 blur-[60px] animate-aurora" />

              <div className="relative p-5">
                <div className="flex items-start gap-5">
                  {/* 左侧：图片上传 */}
                  <motion.div
                    className="relative shrink-0"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {refPreviews.length > 0 ? (
                      <div className="group relative h-24 w-24 overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-inner">
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
                          <button className="group flex h-24 w-24 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-500/20 bg-violet-500/[0.03] shadow-inner transition-all duration-300 hover:bg-violet-500/[0.08] hover:border-violet-500/30 hover:shadow-violet-500/10 hover:shadow-lg">
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
                  <div className="flex-1 space-y-3">
                    <p className="text-xs text-slate-500">描述视频内容，避免出现真人或受版权保护的 IP 形象</p>
                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onFocus={() => setFocusMode(true)}
                        onBlur={() => setFocusMode(false)}
                        placeholder="例如：一个精致的咖啡杯放在木质桌面上，阳光透过窗户洒在杯口，蒸汽缓缓升起..."
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
                <div className="mt-5 border-t border-white/[0.06] pt-4 space-y-4">
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
                      <motion.div {...pillSpring}>
                        <button
                          onClick={() => setVideoParams((p) => ({ ...p, watermark: !p.watermark }))}
                          className={`h-8 rounded-full border px-3 text-xs font-medium transition-all ${videoParams.watermark
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                              : "border-white/10 bg-white/5 text-slate-400"
                            }`}
                        >
                          {videoParams.watermark ? "无水印" : "有水印"}
                        </button>
                      </motion.div>
                    </div>
                  </div>

                  {/* 进度条 + 费用 + 发送 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500/50 via-fuchsia-500/50 to-violet-500/50"
                          animate={{ width: `${progress * 100}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-slate-500">{promptLen}/2000</span>
                      <span className="text-xs text-violet-400 font-medium">预估: {estimatedCost} 积分</span>
                    </div>

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

                      <motion.div
                        whileHover={canSend && !isSubmitting ? { scale: 1.08, y: -1 } : {}}
                        whileTap={canSend && !isSubmitting ? { scale: 0.92 } : {}}
                      >
                        <Button
                          disabled={!canSend || isSubmitting}
                          onClick={handleSubmit}
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

            {/* ── 生成结果 ── */}
            <AnimatePresence mode="wait">
              {result && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mt-8"
                >
                  <div className="rounded-[24px] border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      {getStatusIcon(result.status)}
                      <span className="text-sm font-medium">{getStatusText(result.status)}</span>
                      {result.cost != null && (
                        <span className="text-xs text-violet-400 ml-2">消耗 {result.cost} 积分</span>
                      )}
                      {result.taskId && (
                        <span className="text-xs text-slate-500 ml-auto">ID: {result.taskId.slice(0, 16)}...</span>
                      )}
                    </div>

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
                            onClick={() => setResult(null)}
                            className="border-white/10 bg-white/5 hover:bg-white/10"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            重新生成
                          </Button>
                        </div>
                      </div>
                    )}

                    {(result.status === "failed" || result.status === "timeout") && (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-400">{result.message || "生成失败，请重试"}</p>
                        <Button
                          onClick={() => {
                            setResult(null)
                            handleSubmit()
                          }}
                          className="bg-gradient-to-r from-violet-500 to-fuchsia-600"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          重试
                        </Button>
                      </div>
                    )}

                    {(result.status === "pending" || result.status === "processing") && (
                      <div className="flex items-center gap-3 text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">视频生成中，预计需要 2-5 分钟，请耐心等待...</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── 示例提示词 ── */}
            {prompt.trim().length === 0 && (
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={4}
                className="mt-6"
              >
                <p className="text-xs text-slate-500 mb-3">不知道怎么写？试试这些示例：</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              </motion.div>
            )}

            {/* ── 使用说明 ── */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={4}
              className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4"
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
