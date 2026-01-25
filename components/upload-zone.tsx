"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CascaderPanel, type CascaderPlatformItem } from "@/components/cascader-panel"
import { ImageUploadZone } from "./image-upload-zone"
import { GenerationLoading } from "./generation-loading"
import { GenerationResult } from "./generation-result"
import { useSession } from "next-auth/react"
import { useLoginModal } from "@/hooks/use-login-modal"
import { ProductTypeLabel, ProductTypeKey, GENERATION_LANGUAGES, GenerationLanguage, DEFAULT_OUTPUT_LANGUAGE } from "@/lib/constants"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCosts } from "@/hooks/use-costs"

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
  const { data: session, update } = useSession()
  const { costs } = useCosts()
  const loginModal = useLoginModal()

  /* ──────────────── state ──────────────── */
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

  // Combo mode state - only visible when taskType is MAIN_IMAGE
  const [isComboMode, setIsComboMode] = useState(false)

  // Output language state - 用label不用value
  const [outputLanguage, setOutputLanguage] = useState<GenerationLanguage>(DEFAULT_OUTPUT_LANGUAGE)
  const [isLanguageOpen, setIsLanguageOpen] = useState(false)

  // Detail batch state - A for first 6 screens, B for last 6 screens
  const [detailBatch, setDetailBatch] = useState<"A" | "B">("A")
  const [isDetailBatchOpen, setIsDetailBatchOpen] = useState(false)

  // Clone Mode state
  const [generationMode, setGenerationMode] = useState<"CREATIVE" | "CLONE">("CREATIVE")
  const [features, setFeatures] = useState("") // 卖点
  const [refFiles, setRefFiles] = useState<File[]>([])
  const [refPreviewUrls, setRefPreviewUrls] = useState<string[]>([])

  useEffect(() => {
    if (taskType === "MAIN_IMAGE" && generationMode === "CLONE") {
      setGenerationMode("CREATIVE")
      setProductType("")
    }
  }, [taskType, generationMode])

  // Calculate costs
  const baseCost = taskType === "DETAIL_PAGE" ? costs.DETAIL_PAGE_STANDARD_COST : costs.MAIN_IMAGE_STANDARD_COST
  const comboAddOnCost = costs.DETAIL_PAGE_RETRY_COST
  const totalCost = isComboMode && taskType === "MAIN_IMAGE" ? baseCost + comboAddOnCost : baseCost

  /* ──────────────── load platform config ──────────────── */
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const modeForConfig = taskType === "MAIN_IMAGE" ? "CREATIVE" : generationMode
        const res = await fetch(`/api/config/platforms?taskType=${taskType}&mode=${modeForConfig}`)
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error("加载平台配置失败")
        if (!cancelled) {
          const list = Array.isArray(data) ? (data as PlatformTreeItem[]) : []
          setPlatforms(list)
          // Try to preserve current platformKey if available
          const found = list.find((p) => p.value === platformKey)
          if (!found && list.length > 0) {
            setPlatformKey(list[0].value)
          }
          // Reset productType to first available or empty
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
    return () => {
      cancelled = true
    }
  }, [taskType, generationMode])

  const selectedPlatform = useMemo(() => {
    return (platforms || []).find((p) => p.value === platformKey) || null
  }, [platforms, platformKey])

  const typeOptions = useMemo(() => {
    return selectedPlatform?.types || []
  }, [selectedPlatform])

  // 当平台变化时，仅在当前已选风格不属于该平台时才清空
  useEffect(() => {
    if (!productType) return
    const belongsToPlatform = typeOptions.some((t) => t.value === productType)
    if (!belongsToPlatform) setProductType("")
  }, [platformKey, typeOptions, productType])

  /* ──────────────── file management ──────────────── */
  const handleFilesChange = useCallback(
    (newFiles: File[]) => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
      const urls = newFiles.map((file) => URL.createObjectURL(file))
      setFiles(newFiles)
      setPreviewUrls(urls)
    },
    [previewUrls],
  )

  // Clone Mode: Reference images handler
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
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      }),
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

  /* ──────────────── submit logic ──────────────── */
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
        user: {
          ...session?.user,
          bonusCredits: currentBonusCredits - deductBonus,
          credits: currentCredits - deductPaid,
        },
      })

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data?.error || `请求失败: ${res.status}`)
        }

        if (!data.generatedImages || data.generatedImages.length === 0) {
          toast.success("生成完成")
        } else {
          setGeneratedImages(data.generatedImages)
          setFullImageUrl(data.fullImageUrl || null)
          setCurrentGenerationId(data.id)
          toast.success("生成完成")
        }

        if (typeof data.credits === "number" && typeof data.bonusCredits === "number") {
          await update({
            ...session,
            user: {
              ...(session?.user || {}),
              credits: data.credits,
              bonusCredits: data.bonusCredits,
            },
          })
        }
      } catch (e: any) {
        toast.error(e?.message || "生成失败")
        // 回滚余额
        await update({
          ...session,
          user: {
            ...(session?.user || {}),
            credits: currentCredits,
            bonusCredits: currentBonusCredits,
          },
        })
        throw e // Re-throw to be caught by caller
      } finally {
        setIsSubmitting(false)
      }
    },
    [session, update],
  )

  const onSubmit = useCallback(async () => {
    if (!isAuthenticated) {
      loginModal.open()
      return
    }

    // Common validation for both modes - productType is now required for both
    if (!productName.trim()) {
      toast.error("请填写商品名称")
      return
    }
    if (!productType) {
      toast.error("请选择平台/风格")
      return
    }
    if (files.length === 0) {
      toast.error("请上传商品图片")
      return
    }

    // Clone mode requires reference images
    if (taskType === "DETAIL_PAGE" && generationMode === "CLONE" && refFiles.length === 0) {
      toast.error("克隆模式需要上传参考图")
      return
    }

    setIsSubmitting(true)
    try {
      // Upload product images
      const uploadedUrls = await Promise.all(
        files.map(async (file) => {
          const { uploadUrl, publicUrl } = await signOne(file)
          await uploadToTos(uploadUrl, file)
          return publicUrl
        }),
      )

      // Upload reference images for Clone Mode
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

      await handleGeneration(
        {
          productName: productName.trim(),
          productType,
          platformKey,
          taskType,
          images: uploadedUrls,
          mode: taskType === "MAIN_IMAGE" ? "CREATIVE" : generationMode,
          features: taskType === "DETAIL_PAGE" && generationMode === "CLONE" ? features : undefined,
          refImages: taskType === "DETAIL_PAGE" && generationMode === "CLONE" ? uploadedRefUrls : undefined,
          withDetailCombo: isComboMode && taskType === "MAIN_IMAGE" && generationMode === "CREATIVE",
          outputLanguage,
          detailBatch: taskType === "DETAIL_PAGE" ? detailBatch : undefined,
        },
        totalCost,
      )
    } catch (e) {
      // Error is already handled and toasted inside handleGeneration
    } finally {
      setIsSubmitting(false)
    }
  }, [
    isAuthenticated,
    loginModal,
    productName,
    productType,
    files,
    refFiles,
    platformKey,
    taskType,
    generationMode,
    features,
    isComboMode,
    totalCost,
    outputLanguage,
    detailBatch,
    handleGeneration,
  ])

  const handleDiscountRetry = useCallback(
    async (retryFromId: string) => {
      try {
        await handleGeneration({ retryFromId }, costs.MAIN_IMAGE_RETRY_COST)
      } catch (e) {
        // Error is handled inside
      }
    },
    [handleGeneration],
  )

  const handleTryAnother = useCallback(() => {
    setGeneratedImages([])
    setFullImageUrl(null)
    setCurrentGenerationId(null)
    setFiles([])
    setPreviewUrls([])
    setProductName("")
    setProductType("")
    // Reset Clone Mode state
    setGenerationMode("CREATIVE")
    setFeatures("")
    setRefFiles([])
    setRefPreviewUrls([])
  }, [])

  const typeSelectDisabled = typeOptions.length === 0

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
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
            <motion.div whileHover={{ scale: 1.05 }} className="glass rounded-xl px-4 py-2">
              <div className="text-xs text-slate-400 mb-1">剩余积分</div>
              <div className="text-xl font-bold gradient-text-alt">
                {(session.user.credits ?? 0) + (session.user.bonusCredits ?? 0)}
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Task Type Tabs */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs value={taskType} onValueChange={(v) => {
            setTaskType(v as "MAIN_IMAGE" | "DETAIL_PAGE")
            // Reset to form view when switching tabs during generation
            if (isSubmitting || generatedImages.length > 0) {
              setIsSubmitting(false)
              setGeneratedImages([])
              setFullImageUrl(null)
              setCurrentGenerationId(null)
            }
          }}>
            <TabsList className="bg-slate-800/50 border border-white/10 p-1">
              <TabsTrigger
                value="MAIN_IMAGE"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white px-6"
              >
                主图生成
              </TabsTrigger>
              <TabsTrigger
                value="DETAIL_PAGE"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white px-6"
              >
                详情页
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Generation Mode Tabs - only show for DETAIL_PAGE */}
        {taskType === "DETAIL_PAGE" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Tabs value={generationMode} onValueChange={(v) => {
              setGenerationMode(v as "CREATIVE" | "CLONE")
              // Reset productType when switching modes (different modes have different product types)
              setProductType("")
              // Reset images when switching modes
              if (generatedImages.length > 0) {
                setGeneratedImages([])
                setFullImageUrl(null)
                setCurrentGenerationId(null)
              }
            }}>
              <TabsList className="bg-slate-800/50 border border-white/10 p-1">
                <TabsTrigger
                  value="CREATIVE"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white px-5 gap-1.5"
                >
                  ✨ 创意模式
                </TabsTrigger>
                <TabsTrigger
                  value="CLONE"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-600 data-[state=active]:text-white px-5 gap-1.5"
                >
                  ⚡ 克隆模式
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {generationMode === "CLONE" && (
              <p className="text-xs text-amber-400/80 mt-2">
                克隆模式将复制参考图的构图风格，适合快速生成相似风格的图片
              </p>
            )}
          </motion.div>
        )}

        {/* Form */}
        <AnimatePresence mode="wait">
          {!isSubmitting && generatedImages.length === 0 ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* 平台/风格 + 商品名称 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Platform/Style selector - ALWAYS VISIBLE for both modes */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                  className="md:col-span-2"
                >
                  <label className="block text-sm font-medium text-slate-300 mb-2">平台 / 风格</label>
                  <DropdownMenu open={isCascaderOpen} onOpenChange={setIsCascaderOpen}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-full h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all flex items-center justify-between"
                      >
                        <span className="truncate">
                          {(() => {
                            const p = selectedPlatform
                            const t = typeOptions.find((x) => x.value === productType)
                            const platformLabel = p?.label || platformKey
                            const typeLabel =
                              t?.label || (ProductTypeLabel as any)[productType] || productType || "请选择"
                            return `${platformLabel} / ${typeLabel}`
                          })()}
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent sideOffset={8} className="p-0">
                      <CascaderPanel
                        items={platforms || []}
                        value={{ platformKey, productType: productType || undefined }}
                        onChange={(next) => {
                          setPlatformKey(next.platformKey)
                          setProductType((next.productType as ProductTypeKey) || "")
                          if (next.productType) setIsCascaderOpen(false)
                        }}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {typeSelectDisabled && (
                    <div className="mt-2 text-xs text-slate-500">当前平台暂无可用风格</div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="md:col-span-1"
                >
                  <label className="block text-sm font-medium text-slate-300 mb-2">商品名称</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="例如：银河猫咪贴纸"
                    className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                  />
                </motion.div>

                {/* Clone Mode: Selling Points textarea */}
                {taskType === "DETAIL_PAGE" && generationMode === "CLONE" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 }}
                    className="md:col-span-3"
                  >
                    <label className="block text-sm font-medium text-amber-300 mb-2">
                      商品卖点 <span className="text-amber-400/60 font-normal">(可选，用于生成文案)</span>
                    </label>
                    <textarea
                      value={features}
                      onChange={(e) => setFeatures(e.target.value)}
                      placeholder="例如：防水、耐磨、轻便透气、100%纯棉..."
                      rows={2}
                      className="w-full rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-500 focus:bg-amber-500/10 focus:ring-2 focus:ring-amber-500/20 transition-all backdrop-blur-sm resize-none"
                    />
                  </motion.div>
                )}

                {/* Language Selector */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                  className="md:col-span-2"
                >
                  <label className="block text-sm font-medium text-slate-300 mb-2">输出文字语言</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                      className="w-full flex items-center justify-between h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white hover:bg-white/10 transition-all backdrop-blur-sm"
                    >
                      <span>{outputLanguage}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isLanguageOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {isLanguageOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 mt-2 w-full bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-xl"
                        >
                          {GENERATION_LANGUAGES.map(lang => (
                            <button
                              key={lang.label}
                              type="button"
                              onClick={() => {
                                setOutputLanguage(lang.label)
                                setIsLanguageOpen(false)
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors ${outputLanguage === lang.label ? "bg-blue-500/20 text-blue-400" : "text-white"
                                }`}
                            >
                              {lang.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                {/* Detail Batch Selector - only show for detail page */}
                {taskType === "DETAIL_PAGE" && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="md:col-span-1"
                  >
                    <label className="block text-sm font-medium text-slate-300 mb-2">生成批次</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsDetailBatchOpen(!isDetailBatchOpen)}
                        className="w-full flex items-center justify-between h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white hover:bg-white/10 transition-all backdrop-blur-sm"
                      >
                        <span>{detailBatch === "A" ? "前六屏" : "后六屏"}</span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDetailBatchOpen ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {isDetailBatchOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 mt-2 w-full bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-xl"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setDetailBatch("A")
                                setIsDetailBatchOpen(false)
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors ${detailBatch === "A" ? "bg-purple-500/20 text-purple-400" : "text-white"}`}
                            >
                              前六屏
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDetailBatch("B")
                                setIsDetailBatchOpen(false)
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors ${detailBatch === "B" ? "bg-purple-500/20 text-purple-400" : "text-white"}`}
                            >
                              后六屏
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Upload Zone */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <label className="block text-sm font-medium text-slate-300">
                    {generationMode === "CLONE" ? "商品图片" : "上传商品图片"}
                  </label>
                  <div className="text-xs text-slate-500">
                    提示：图片越清晰、角度越完整，生成结果越贴近实物，货不对板概率越小
                  </div>
                </div>

                <div className="mt-3">
                  <ImageUploadZone
                    files={files}
                    previewUrls={previewUrls}
                    onFilesChange={handleFilesChange}
                    maxFiles={8}
                  />
                </div>
              </motion.div>

              {/* Reference Image Upload Zone - Only for Clone Mode */}
              {taskType === "DETAIL_PAGE" && generationMode === "CLONE" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <div className="flex items-end justify-between gap-3 flex-wrap">
                    <label className="block text-sm font-medium text-amber-300">
                      参考图片 <span className="text-amber-400/60 font-normal">(用于复制构图，总共生成6张，有几张参考图就会复制几张，其余张数会根据参考图风格自动生成)</span>
                    </label>
                    <div className="text-xs text-amber-400/60">
                      上传您想要复制风格/构图的参考图
                    </div>
                  </div>

                  <div className="mt-3">
                    <ImageUploadZone
                      files={refFiles}
                      previewUrls={refPreviewUrls}
                      onFilesChange={handleRefFilesChange}
                      maxFiles={6}
                    />
                  </div>
                </motion.div>
              )}

              {/* Combo Offer Card - Only show for MAIN_IMAGE Creative mode */}
              {taskType === "MAIN_IMAGE" && generationMode === "CREATIVE" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="relative rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 p-4 mb-4"
                >
                  {/* Top Badge */}
                  <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-white text-[10px] font-bold shadow-lg">
                    🔥 限时特惠
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    {/* Left: Checkbox + Label */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isComboMode}
                        onChange={(e) => setIsComboMode(e.target.checked)}
                        className="w-4 h-4 rounded border-amber-400/50 bg-amber-500/20 text-amber-500 focus:ring-amber-500/50 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-white">同时生成详情页（默认前六屏）</span>
                    </label>

                    {/* Middle: Description */}
                    <div className="hidden sm:block text-[11px] text-slate-400">
                      赠送水印解锁 <span className="text-emerald-400 font-medium">(立省 100 积分)</span>
                    </div>

                    {/* Right: Price */}
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-sm line-through">{costs.DETAIL_PAGE_STANDARD_COST}</span>
                      <span className="text-amber-400 text-lg font-bold">+{comboAddOnCost}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Generate Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="relative pt-4"
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-yellow-400 rounded-full text-slate-900 text-xs font-bold shadow-lg z-10">
                  🔥 2.5折特惠 <span className="line-through opacity-70 ml-1">原价 800</span>
                </div>
                <Button
                  onClick={onSubmit}
                  disabled={isSubmitting || typeSelectDisabled}
                  className="w-full h-16 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-purple relative overflow-hidden group flex flex-col items-center justify-center"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.5 }}
                  />
                  <div className="relative flex items-center justify-center gap-2 text-base">
                    <Sparkles className="w-5 h-5" />
                    <span>{isComboMode && taskType === "MAIN_IMAGE" ? "立即生成双份" : "生成图像"}</span>
                  </div>
                  <div className="relative text-xs opacity-70 mt-1">费用 {totalCost} 积分</div>
                </Button>
                <p className="text-xs text-slate-500 text-center mt-3 flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {isComboMode && taskType === "MAIN_IMAGE" ? "一次生成主图 + 详情页" : "一次生成即得 9 张精选图"}
                </p>
              </motion.div>
            </motion.div>
          ) : isSubmitting ? (
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
            />
          ) : null}
        </AnimatePresence>
      </div>

      {/* Preview Modal */}
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
    </>
  )
}
