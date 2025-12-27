"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CascaderPanel, type CascaderPlatformItem } from "@/components/cascader-panel"
import { ImageUploadZone } from "./image-upload-zone"
import { GenerationLoading } from "./generation-loading"
import { GenerationResult } from "./generation-result"
import { useSession } from "next-auth/react"
import { useLoginModal } from "@/hooks/use-login-modal"
import { ProductTypeLabel, ProductTypeKey } from "@/lib/constants"

const GENERATION_COST = 199

type PlatformTreeItem = CascaderPlatformItem

interface UploadZoneProps {
  isAuthenticated?: boolean
}

export function UploadZone({ isAuthenticated = false }: UploadZoneProps) {
  const { data: session, update } = useSession()
  const loginModal = useLoginModal()

  /* ──────────────── state ──────────────── */
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

  /* ──────────────── load platform config ──────────────── */
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/config/platforms")
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error("加载平台配置失败")
        if (!cancelled) {
          const list = Array.isArray(data) ? (data as PlatformTreeItem[]) : []
          setPlatforms(list)
          const first = list.length > 0 ? list[0].value : "SHOPEE"
          setPlatformKey(first)
        }
      } catch {
        if (!cancelled) setPlatforms([])
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedPlatform = useMemo(() => {
    return (platforms || []).find((p) => p.value === platformKey) || null
  }, [platforms, platformKey])

  const typeOptions = useMemo(() => {
    return selectedPlatform?.types || []
  }, [selectedPlatform])

  // 平台切换时，重置 productType（避免旧类型不在新平台列表中）
  useEffect(() => {
    setProductType("")
  }, [platformKey])

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

  /* ──────────────── submit ──────────────── */
  const onSubmit = useCallback(async () => {
    if (!isAuthenticated) {
      toast.info("请先登录以使用生成功能")
      loginModal.open()
      return
    }

    if (!productName.trim()) {
      toast.error("请填写商品名称")
      return
    }
    if (!productType) {
      toast.error("请选择风格")
      return
    }
    if (files.length === 0) {
      toast.error("请至少上传 1 张图片")
      return
    }

    const currentCredits = session?.user?.credits ?? 0
    const currentBonusCredits = session?.user?.bonusCredits ?? 0
    const currentTotalCredits = currentCredits + currentBonusCredits

    if (currentTotalCredits < GENERATION_COST) {
      toast.error(`余额不足（需要 ${GENERATION_COST} 积分），请充值`)
      return
    }

    try {
      setIsSubmitting(true)
      setGeneratedImages([])
      setFullImageUrl(null)

      const fd = new FormData()
      fd.append("productName", productName.trim())
      fd.append("productType", productType)
      // 传参保持不变：platformKey + productType
      fd.append("platformKey", platformKey)
      files.forEach((f) => fd.append("images", f))

      // 1. 乐观更新 UI（优先扣 bonusCredits，再扣 credits）
      const deductBonus = Math.min(currentBonusCredits, GENERATION_COST)
      const deductPaid = GENERATION_COST - deductBonus

      await update({
        ...session,
        user: {
          ...session?.user,
          bonusCredits: currentBonusCredits - deductBonus,
          credits: currentCredits - deductPaid,
        },
      })

      const res = await fetch("/api/generate", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || `请求失败: ${res.status}`)
      }

      if (!data.generatedImages || data.generatedImages.length === 0) {
        toast.warning("生成成功但未返回图片数据")
      } else {
        setGeneratedImages(data.generatedImages)
        setFullImageUrl(data.fullImageUrl || null)
        toast.success("生成完成")
      }

      // 2. 用后端返回的真实余额同步 UI
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

      // 3. 失败回滚乐观更新
      await update({
        ...session,
        user: {
          ...(session?.user || {}),
          credits: currentCredits,
          bonusCredits: currentBonusCredits,
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    isAuthenticated,
    loginModal,
    productName,
    productType,
    files,
    session,
    update,
    platformKey,
  ])

  const handleTryAnother = useCallback(() => {
    setGeneratedImages([])
    setFullImageUrl(null)
    setFiles([])
    setPreviewUrls([])
    setProductName("")
    setProductType("")
  }, [])

  const typeSelectDisabled = typeOptions.length === 0

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">创建您的作品</h3>
            <p className="text-sm text-slate-400">上传图片并选择风格，让 AI 为您生成专业主图</p>
          </div>
          {session?.user && (
            <motion.div whileHover={{ scale: 1.05 }} className="glass rounded-xl px-4 py-2">
              <div className="text-xs text-slate-400 mb-1">剩余积分</div>
              <div className="text-xl font-bold gradient-text-alt">{(session.user.credits ?? 0) + (session.user.bonusCredits ?? 0)}</div>
            </motion.div>
          )}
        </motion.div>

        {/* Form */}
        <AnimatePresence mode="wait">
          {!isSubmitting && generatedImages.length === 0 ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* 平台/风格（联级：下拉展开面板） + 商品名称 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }} className="md:col-span-2">
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
                            const typeLabel = t?.label || (ProductTypeLabel as any)[productType] || productType || "请选择"
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
                          // 选中风格后自动关闭面板
                          if (next.productType) setIsCascaderOpen(false)
                        }}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {typeSelectDisabled && (
                    <div className="mt-2 text-xs text-slate-500">当前平台暂无可用风格</div>
                  )}
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="md:col-span-1">
                  <label className="block text-sm font-medium text-slate-300 mb-2">商品名称</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="例如：银河猫咪贴纸"
                    className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                  />
                </motion.div>
              </div>

              {/* Upload Zone */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <label className="block text-sm font-medium text-slate-300 mb-3">上传商品图片</label>
                <ImageUploadZone files={files} previewUrls={previewUrls} onFilesChange={handleFilesChange} maxFiles={8} />
              </motion.div>

              {/* Pricing Info */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">生成价格</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">75% OFF</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 line-through">800</span>
                    <span className="text-2xl font-bold gradient-text">199</span>
                    <span className="text-sm text-slate-400">积分</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  一次生成即得 9 张精选商品图
                </p>
              </motion.div>

              {/* Generate Button */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <Button
                  onClick={onSubmit}
                  disabled={isSubmitting || typeSelectDisabled}
                  className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold text-base shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-purple relative overflow-hidden group"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.5 }}
                  />
                  <span className="relative flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    生成图像
                  </span>
                </Button>
              </motion.div>
            </motion.div>
          ) : isSubmitting ? (
            <GenerationLoading key="loading" />
          ) : generatedImages.length > 0 ? (
            <GenerationResult
              key="result"
              generatedImages={generatedImages}
              fullImageUrl={fullImageUrl}
              productName={productName}
              onTryAnother={handleTryAnother}
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
              <img src={previewImage} alt="预览" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" />
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
