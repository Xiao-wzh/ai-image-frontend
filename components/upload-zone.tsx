"use client"

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Crown, Zap, BookOpen, Plus, Wallet } from "lucide-react"
import { ModeCompareModal } from "./mode-compare-modal"
import { toast } from "sonner"
import type { CascaderPlatformItem } from "@/components/cascader-panel"
import { GenerationLoading } from "./generation-loading"
import { GenerationResult } from "./generation-result"
import { StandardForm } from "./standard-form"
import { ProForm } from "./pro-form"
import { useSession } from "next-auth/react"
import { useLoginModal } from "@/hooks/use-login-modal"
import { ProductTypeKey, GenerationLanguage, DEFAULT_OUTPUT_LANGUAGE } from "@/lib/constants"
import { useCosts } from "@/hooks/use-costs"
import { PricingModal } from "./pricing-modal"
import type { CockpitFormProps } from "./cockpit-types"

type PlatformTreeItem = CascaderPlatformItem

type SignResponse = {
  uploadUrl: string
  publicUrl: string
  objectKey: string
}

interface UploadZoneProps {
  isAuthenticated?: boolean
}

export function UploadZone({ isAuthenticated = false }: UploadZoneProps) {
  const router = useRouter()
  const { data: session, update } = useSession()
  const { costs } = useCosts()
  const loginModal = useLoginModal()

  /* ══════════════════ ALL STATE — 提升至父层 ══════════════════ */
  const [taskType, setTaskType] = useState<"MAIN_IMAGE" | "DETAIL_PAGE">("MAIN_IMAGE")
  const [platforms, setPlatforms] = useState<PlatformTreeItem[] | null>(null)
  const [platformKey, setPlatformKey] = useState<string>("SHOPEE")
  const [isCascaderOpen, setIsCascaderOpen] = useState(false)
  const [productName, setProductName] = useState("")
  const [productType, setProductType] = useState<ProductTypeKey | "">("")
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)

  // Combo mode — 仅 Standard 使用
  const [isComboMode, setIsComboMode] = useState(false)

  // 语言 & 批次
  const [outputLanguage, setOutputLanguage] = useState<GenerationLanguage>(DEFAULT_OUTPUT_LANGUAGE)
  const [detailBatch, setDetailBatch] = useState<"A" | "B">("A")

  // 克隆模式
  const [generationMode, setGenerationMode] = useState<"CREATIVE" | "CLONE">("CREATIVE")
  const [features, setFeatures] = useState("")
  const [refFiles, setRefFiles] = useState<File[]>([])
  const [refPreviewUrls, setRefPreviewUrls] = useState<string[]>([])

  // 模式对比弹窗
  const [isModeCompareOpen, setIsModeCompareOpen] = useState(false)

  // 充值弹窗
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)

  // PRO 模式 — qualityMode 是全局开关
  const [qualityMode, setQualityMode] = useState<"STANDARD" | "PRO">("STANDARD")
  const [proImageCount, setProImageCount] = useState<number>(1)
  const [proAspectRatio, setProAspectRatio] = useState("1:1")
  const [proPollingId, setProPollingId] = useState<string | null>(null)
  const [proFeatures, setProFeatures] = useState("")
  const [proStyle, setProStyle] = useState("")

  // 防抖
  const lastSubmitTimeRef = useRef<number>(0)
  const SUBMIT_DEBOUNCE_MS = 2000

  /* ──────────────── PRO 模式轮询 ──────────────── */
  useEffect(() => {
    if (!proPollingId) return

    const PRO_POLL_INTERVAL = 5000 // 每 5 秒轮询一次
    const PRO_POLL_TIMEOUT = 15 * 60 * 1000 // 最长等 15 分钟
    const startTime = Date.now()

    const timer = setInterval(async () => {
      // 超时放弃轮询
      if (Date.now() - startTime > PRO_POLL_TIMEOUT) {
        clearInterval(timer)
        setProPollingId(null)
        toast.error("PRO 任务等待超时，请前往历史记录查看结果")
        return
      }

      try {
        const res = await fetch(`/api/generation/status?id=${proPollingId}`)
        if (!res.ok) return // 网络抖动，继续等待

        const data = await res.json()
        const { status, generatedImages: imgs, generatedImage: fullImg, refundAmount } = data

        if (status === "COMPLETED" || status === "PARTIAL_SUCCESS") {
          clearInterval(timer)
          setProPollingId(null)
          setGeneratedImages(imgs || [])
          setFullImageUrl(fullImg || null)
          if (status === "PARTIAL_SUCCESS" && refundAmount > 0) {
            toast.success(`PRO 生成完成（部分失败，已退还 ${refundAmount} 积分）`)
          } else {
            toast.success("PRO 生成完成！")
          }
          // 刷新用户积分余额
          await update()
        } else if (status === "FAILED") {
          clearInterval(timer)
          setProPollingId(null)
          toast.error("PRO 生成失败，积分已退回")
        }
        // PENDING / PROCESSING 继续等待
      } catch {
        // 忽略单次网络错误，继续轮询
      }
    }, PRO_POLL_INTERVAL)

    return () => clearInterval(timer)
  }, [proPollingId, update])

  useEffect(() => {
    if (taskType === "MAIN_IMAGE" && generationMode === "CLONE") {
      setGenerationMode("CREATIVE")
      setProductType("")
    }
  }, [taskType, generationMode])

  /* ──────────────── 费用计算 ──────────────── */
  const baseCost = taskType === "DETAIL_PAGE" ? costs.DETAIL_PAGE_STANDARD_COST : costs.MAIN_IMAGE_STANDARD_COST
  const comboAddOnCost = costs.DETAIL_PAGE_RETRY_COST
  // PRO 模式: 9 张特惠 500 积分，其他按原价
  const proCost = proImageCount === 9 ? 500 : (costs.PRO_COST_PER_IMAGE * proImageCount)
  const totalCost = qualityMode === "PRO"
    ? proCost
    : (isComboMode && taskType === "MAIN_IMAGE" ? baseCost + comboAddOnCost : baseCost)

  /* ──────────────── 平台配置加载 ──────────────── */
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const modeForConfig = taskType === "MAIN_IMAGE" ? "CREATIVE" : generationMode
        const res = await fetch(`/api/config/platforms?taskType=${taskType}&mode=${modeForConfig}&qualityMode=${qualityMode}`)
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error("加载平台配置失败")
        if (!cancelled) {
          const list = Array.isArray(data) ? (data as PlatformTreeItem[]) : []
          setPlatforms(list)
          const found = list.find((p) => p.value === platformKey)
          if (!found && list.length > 0) setPlatformKey(list[0].value)
          const typesForPlatform = (found || list[0])?.types || []
          if (productType && !typesForPlatform.find((t) => t.value === productType)) {
            setProductType(typesForPlatform[0]?.value as ProductTypeKey || "")
          }
        }
      } catch {
        if (!cancelled) setPlatforms([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [taskType, generationMode, qualityMode])

  const selectedPlatform = useMemo(() => {
    return (platforms || []).find((p) => p.value === platformKey) || null
  }, [platforms, platformKey])

  const typeOptions = useMemo(() => {
    return selectedPlatform?.types || []
  }, [selectedPlatform])

  useEffect(() => {
    if (!productType) return
    const belongsToPlatform = typeOptions.some((t) => t.value === productType)
    if (!belongsToPlatform) setProductType("")
  }, [platformKey, typeOptions, productType])

  /* ──────────────── 文件管理 ──────────────── */
  const handleFilesChange = useCallback(
    (newFiles: File[]) => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
      const urls = newFiles.map((file) => URL.createObjectURL(file))
      setFiles(newFiles)
      setPreviewUrls(urls)
    },
    [previewUrls],
  )

  const handleRefFilesChange = useCallback(
    (newFiles: File[]) => {
      refPreviewUrls.forEach((url) => URL.revokeObjectURL(url))
      const urls = newFiles.map((file) => URL.createObjectURL(file))
      setRefFiles(newFiles)
      setRefPreviewUrls(urls)
    },
    [refPreviewUrls],
  )

  async function signOne(file: File): Promise<SignResponse> {
    const res = await fetch("/api/tos/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || `签名失败: ${res.status}`)
    return data as SignResponse
  }

  async function uploadToTos(uploadUrl: string, file: File) {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    })
    if (!res.ok) throw new Error(`上传失败: ${res.status}`)
  }

  /* ──────────────── 提交逻辑 ──────────────── */
  const handleGeneration = useCallback(
    async (payload: Record<string, any>, cost: number) => {
      const currentCredits = session?.user?.credits ?? 0
      const currentBonusCredits = session?.user?.bonusCredits ?? 0
      const currentTotalCredits = currentCredits + currentBonusCredits

      if (currentTotalCredits < cost) {
        toast.error(`余额不足（需要 ${cost} 积分），请充值`)
        throw new Error("余额不足")
      }

      setIsSubmitting(true)

      const deductBonus = Math.min(currentBonusCredits, cost)
      const deductPaid = cost - deductBonus

      await update({
        ...session,
        user: { ...session?.user, bonusCredits: currentBonusCredits - deductBonus, credits: currentCredits - deductPaid },
      })

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `请求失败: ${res.status}`)

        if (data.isCombo) {
          // 套餐模式完成，重置表单防止重复提交
          const allFailed = data.results?.every((r: any) => r.status === "FAILED")
          if (allFailed) {
            toast.error("套餐生成失败，积分已退回")
          } else {
            toast.success("套餐生成完成！请前往历史记录查看主图和详情页")
            // 跳转到任务队列页面
            router.push("/tasks")
          }
          setGeneratedImages([])
          setFullImageUrl(null)
          setCurrentGenerationId(null)
          setFiles([])
          setPreviewUrls([])
          setProductName("")
          setProductType("")
          setGenerationMode("CREATIVE")
          setFeatures("")
          setRefFiles([])
          setRefPreviewUrls([])
          setIsComboMode(false)
        } else if (!data.generatedImages || data.generatedImages.length === 0) {
          if (data.status === "PROCESSING" && data.qualityMode === "PRO" && data.id) {
            toast.success("PRO 任务已提交，正在生成中...")
            setCurrentGenerationId(data.id)
            setProPollingId(data.id)
            // 跳转到任务队列页面
            router.push("/tasks")
          } else if (data.status === "PENDING" || data.status === "PROCESSING") {
            // 标准模式异步生成
            toast.success("任务已提交，正在生成中...")
            setCurrentGenerationId(data.id)
            // 跳转到任务队列页面
            router.push("/tasks")
          } else {
            toast.success("生成完成")
          }
        } else {
          setGeneratedImages(data.generatedImages)
          setFullImageUrl(data.fullImageUrl || null)
          setCurrentGenerationId(data.id)
          toast.success("生成完成")
          // 跳转到任务队列页面
          router.push("/tasks")
        }

        if (typeof data.credits === "number" && typeof data.bonusCredits === "number") {
          await update({
            ...session,
            user: { ...(session?.user || {}), credits: data.credits, bonusCredits: data.bonusCredits },
          })
        }
      } catch (e: any) {
        toast.error(e?.message || "生成失败")
        await update({
          ...session,
          user: { ...(session?.user || {}), credits: currentCredits, bonusCredits: currentBonusCredits },
        })
        throw e
      } finally {
        setIsSubmitting(false)
      }
    },
    [session, update, router],
  )

  const onSubmit = useCallback(async () => {
    const now = Date.now()
    if (now - lastSubmitTimeRef.current < SUBMIT_DEBOUNCE_MS) {
      toast.warning("请稍等片刻再点击")
      return
    }
    lastSubmitTimeRef.current = now

    if (!isAuthenticated) { loginModal.open(); return }
    if (!productName.trim()) { toast.error("请填写商品名称"); return }
    if (!productType) { toast.error("请选择平台/风格"); return }
    if (files.length === 0) { toast.error("请上传商品图片"); return }
    if (taskType === "DETAIL_PAGE" && generationMode === "CLONE" && refFiles.length === 0) {
      toast.error("克隆模式需要上传参考图"); return
    }

    setIsSubmitting(true)
    try {
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const uploadedUrls = await Promise.all(
        files.map(async (file) => {
          const { uploadUrl, publicUrl } = await signOne(file)
          await uploadToTos(uploadUrl, file)
          return publicUrl
        }),
      )

      let uploadedRefUrls: string[] = []
      if (taskType === "DETAIL_PAGE" && generationMode === "CLONE" && refFiles.length > 0) {
        uploadedRefUrls = await Promise.all(
          refFiles.map(async (file) => {
            const { uploadUrl, publicUrl } = await signOne(file)
            await uploadToTos(uploadUrl, file)
            return publicUrl
          }),
        )
      }

      // ★ Payload 净化：根据当前 qualityMode 防御性构建参数
      const isPro = qualityMode === "PRO"
      await handleGeneration(
        {
          requestId,
          productName: productName.trim(),
          productType,
          platformKey,
          taskType,
          images: uploadedUrls,
          mode: taskType === "MAIN_IMAGE" ? "CREATIVE" : generationMode,
          features: taskType === "DETAIL_PAGE" && generationMode === "CLONE" ? features : undefined,
          refImages: taskType === "DETAIL_PAGE" && generationMode === "CLONE" ? uploadedRefUrls : undefined,
          // STANDARD: 不传 combo 如果是 PRO
          withDetailCombo: !isPro && isComboMode && taskType === "MAIN_IMAGE" && generationMode === "CREATIVE",
          outputLanguage,
          detailBatch: taskType === "DETAIL_PAGE" ? detailBatch : undefined,
          // 画质模式 — 始终传
          qualityMode,
          // PRO 专属参数：仅在 PRO 模式传递，STANDARD 时强制不传 (防止脏数据)
          ...(isPro
            ? {
              imageCount: proImageCount,
              aspectRatio: proAspectRatio,
              proFeatures: proFeatures || undefined,
              proStyle: proStyle || undefined,
            }
            : {}
          ),
        },
        totalCost,
      )
    } catch (e) {
      // handled inside handleGeneration
    } finally {
      setIsSubmitting(false)
    }
  }, [
    isAuthenticated, loginModal, productName, productType, files, refFiles,
    platformKey, taskType, generationMode, features, isComboMode, totalCost,
    outputLanguage, detailBatch, qualityMode, proImageCount, proAspectRatio,
    handleGeneration,
  ])

  const handleDiscountRetry = useCallback(
    async (retryFromId: string) => {
      // PRO 按张计费，STANDARD 使用固定优惠价
      const retryCost = qualityMode === "PRO"
        ? costs.PRO_COST_PER_IMAGE * proImageCount
        : costs.MAIN_IMAGE_RETRY_COST
      try {
        await handleGeneration({ retryFromId }, retryCost)
      } catch (e) { /* handled */ }
    },
    [handleGeneration, qualityMode, proImageCount, costs],
  )

  const handleTryAnother = useCallback(() => {
    setGeneratedImages([])
    setFullImageUrl(null)
    setCurrentGenerationId(null)
    setFiles([])
    setPreviewUrls([])
    setProductName("")
    setProductType("")
    setGenerationMode("CREATIVE")
    setFeatures("")
    setRefFiles([])
    setRefPreviewUrls([])
    setQualityMode("STANDARD")
    setProPollingId(null)
    setProFeatures("")
    setProStyle("")
  }, [])

  const typeSelectDisabled = typeOptions.length === 0

  /* ──────────────── 子组件共享 Props ──────────────── */
  const cockpitProps: CockpitFormProps = {
    taskType,
    productName, setProductName,
    platformKey, setPlatformKey,
    productType, setProductType,
    platforms, isCascaderOpen, setIsCascaderOpen,
    selectedPlatform, typeOptions, typeSelectDisabled,
    generationMode, setGenerationMode,
    features, setFeatures,
    outputLanguage, setOutputLanguage,
    detailBatch, setDetailBatch,
    files, previewUrls, onFilesChange: handleFilesChange,
    refFiles, refPreviewUrls, onRefFilesChange: handleRefFilesChange,
    isComboMode, setIsComboMode,
    proImageCount, setProImageCount,
    proAspectRatio, setProAspectRatio,
    proFeatures, setProFeatures,
    proStyle, setProStyle,
    costs, totalCost,
    isSubmitting, onSubmit,
    generatedImages, setGeneratedImages,
    setFullImageUrl, setCurrentGenerationId,
  }

  /* ══════════════════ RENDER ══════════════════ */
  const totalCredits = (session?.user?.credits ?? 0) + (session?.user?.bonusCredits ?? 0)

  return (
    <>
      <div className="space-y-6 relative">
        {/* 使用教程按钮 - 居中置顶 */}
        <motion.a
          href="/guide"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-1/2 -translate-x-1/2 -top-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl
            bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20
            border border-white/10 hover:border-purple-500/40
            text-sm text-slate-300 hover:text-white
            transition-all duration-300 cursor-pointer
            shadow-lg hover:shadow-purple-500/10 z-10"
        >
          <BookOpen className="w-4 h-4 text-purple-400" />
          <span className="font-medium">使用教程</span>
        </motion.a>

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">创建您的作品</h3>
            <p className="text-sm text-slate-400">上传图片并选择风格，让 AI 为您生成专业主图</p>
          </div>
          {session?.user && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-3 glass rounded-xl px-4 py-3 border border-white/10"
            >
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="text-xs text-slate-400">剩余积分</div>
                  <div className="text-xl font-bold gradient-text-alt">
                    {totalCredits}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsPricingModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                  bg-gradient-to-r from-purple-600 to-pink-600
                  hover:from-purple-500 hover:to-pink-500
                  text-white text-xs font-semibold
                  transition-all duration-200 cursor-pointer
                  shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
              >
                <Plus className="w-3.5 h-3.5" />
                充值
              </button>
            </motion.div>
          )}
        </motion.div>

        {/* ── 第一步：生成模式选择（最优先决策） ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">① 选择生成模式</p>
            <button
              type="button"
              onClick={() => setIsModeCompareOpen(true)}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-400 transition-colors group"
            >
              <span className="group-hover:text-amber-400 transition-colors">✨</span>
              <span className="underline underline-offset-2 decoration-dotted">查看模式对比</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* 标准极速卡片 */}
            <button
              type="button"
              onClick={() => setQualityMode("STANDARD")}
              className={`relative flex flex-col gap-2 p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                qualityMode === "STANDARD"
                  ? "border-blue-500/50 bg-blue-950/30 shadow-lg shadow-blue-500/10"
                  : "border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg transition-colors ${qualityMode === "STANDARD" ? "bg-blue-500/20" : "bg-white/10"}`}>
                    <Zap className={`w-4 h-4 transition-colors ${qualityMode === "STANDARD" ? "text-blue-400" : "text-slate-400"}`} />
                  </div>
                  <span className={`text-sm font-bold transition-colors ${qualityMode === "STANDARD" ? "text-white" : "text-slate-400"}`}>标准极速</span>
                </div>
                <motion.div
                  animate={{ scale: qualityMode === "STANDARD" ? 1 : 0, opacity: qualityMode === "STANDARD" ? 1 : 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-2 h-2 rounded-full bg-blue-400 shadow-lg shadow-blue-400/60"
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">快速出图，适合批量操作</p>
              <div className={`text-xs font-semibold transition-colors ${qualityMode === "STANDARD" ? "text-blue-400" : "text-slate-600"}`}>
                {costs.MAIN_IMAGE_STANDARD_COST} 积分起
              </div>
              {qualityMode === "STANDARD" && (
                <div className="absolute inset-0 rounded-xl ring-1 ring-blue-500/40 pointer-events-none" />
              )}
            </button>

            {/* PRO 增强卡片 */}
            <button
              type="button"
              onClick={() => setQualityMode("PRO")}
              className={`relative flex flex-col gap-2 p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                qualityMode === "PRO"
                  ? "border-amber-500/50 bg-amber-950/20 shadow-lg shadow-amber-500/10"
                  : "border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg transition-colors ${qualityMode === "PRO" ? "bg-amber-500/20" : "bg-white/10"}`}>
                    <Crown className={`w-4 h-4 transition-colors ${qualityMode === "PRO" ? "text-amber-400" : "text-slate-400"}`} />
                  </div>
                  <span className={`text-sm font-bold transition-colors ${qualityMode === "PRO" ? "text-amber-300" : "text-slate-400"}`}>PRO 增强</span>
                </div>
                <motion.div
                  animate={{ scale: qualityMode === "PRO" ? 1 : 0, opacity: qualityMode === "PRO" ? 1 : 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/60"
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">高画质精品，按张计费</p>
              <div className={`text-xs font-semibold transition-colors ${qualityMode === "PRO" ? "text-amber-400" : "text-slate-600"}`}>
                {costs.PRO_COST_PER_IMAGE} 积分 / 张
              </div>
              {qualityMode === "PRO" && (
                <div className="absolute inset-0 rounded-xl ring-1 ring-amber-500/40 pointer-events-none" />
              )}
            </button>
          </div>
        </motion.div>

        {/* ── 第二步：内容类型选择 ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-3"
        >
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest shrink-0">② 生成内容</p>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800/50 border border-white/10">
            {([
              { value: "MAIN_IMAGE" as const, label: "主图生成", icon: <Zap className="w-3.5 h-3.5" /> },
              { value: "DETAIL_PAGE" as const, label: "详情页", icon: <Sparkles className="w-3.5 h-3.5" /> },
            ]).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setTaskType(tab.value)
                  // PRO 模式下切换任务类型时，更新默认比例
                  setProAspectRatio(tab.value === "DETAIL_PAGE" ? "9:16" : "1:1")
                  if (isSubmitting || generatedImages.length > 0) {
                    setIsSubmitting(false)
                    setGeneratedImages([])
                    setFullImageUrl(null)
                    setCurrentGenerationId(null)
                  }
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  taskType === tab.value
                    ? qualityMode === "PRO"
                      ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md"
                      : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── 驾驶舱切换区 ── */}
        <AnimatePresence mode="wait">
          {!isSubmitting && generatedImages.length === 0 && !proPollingId ? (
            qualityMode === "STANDARD" ? (
              <StandardForm key="standard-cockpit" {...cockpitProps} />
            ) : (
              <ProForm key="pro-cockpit" {...cockpitProps} />
            )
          ) : isSubmitting || proPollingId ? (
            <GenerationLoading key="loading" />
          ) : generatedImages.length > 0 ? (
            <GenerationResult
              key={currentGenerationId}
              generationId={currentGenerationId!}
              generatedImages={generatedImages}
              fullImageUrl={fullImageUrl}
              productName={productName}
              onTryAnother={handleTryAnother}
              onDiscountRetry={handleDiscountRetry}
              onPreview={(url: string) => setPreviewImage(url)}
              qualityMode={qualityMode}
              imageCount={proImageCount}
              costPerImage={costs.PRO_COST_PER_IMAGE}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {/* ── Preview Modal ── */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-[90vw] max-h-[90vh] cursor-default"
            >
              <img
                src={previewImage}
                alt="预览"
                className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
              />
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <span className="text-gray-700 text-2xl">×</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 模式对比弹窗 */}
      <ModeCompareModal open={isModeCompareOpen} onClose={() => setIsModeCompareOpen(false)} />

      {/* 充值弹窗 */}
      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
    </>
  )
}
