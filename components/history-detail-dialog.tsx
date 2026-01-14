"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import JSZip from "jszip"
import {
  ChevronLeft,
  ChevronRight,
  Grid,
  Image as ImageIcon,
  Download,
  Loader2,
  X,
  RefreshCw,
  Sparkles as SparklesIcon,
  Flag,
  Lock,
  Unlock,
  Droplets,
  Settings,
  Check,
  Smartphone,
  LayoutGrid,
  Eye,
  AlertTriangle,
  Pencil,
} from "lucide-react"


import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, downloadImage } from "@/lib/utils"
import { getWatermarkedUrl, WatermarkParams } from "@/lib/tos-watermark"
import { useCosts } from "@/hooks/use-costs"
import type { HistoryItem } from "@/components/history-card"
import { ImageEditorModal } from "@/components/image-editor-modal"



type WatermarkTemplate = {
  id: string
  name: string
  type: "IMAGE" | "TEXT"
  content: string
  opacity: number
  rotate: number
  scale: number
  position: string
  xOffset: number
  yOffset: number
  isTiled: boolean
  fontSize: number | null
  fontColor: string | null
  fontName: string | null
}

export function HistoryDetailDialog({
  open,
  onOpenChange,
  items,
  initialIndex,
  onGenerateSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  items: HistoryItem[]
  initialIndex: number
  onGenerateSuccess: () => void
}) {
  const { data: session } = useSession()
  const { costs } = useCosts()
  const [index, setIndex] = useState(initialIndex)
  const [viewMode, setViewMode] = useState<"grid" | "full">("grid")
  const [isDownloading, setIsDownloading] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)

  const [showDiscountConfirm, setShowDiscountConfirm] = useState(false)
  const [showAppealModal, setShowAppealModal] = useState(false)
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false)
  const [appealReason, setAppealReason] = useState("")

  // Watermark states
  const [isWatermarkUnlocked, setIsWatermarkUnlocked] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false)
  const [watermarkTemplates, setWatermarkTemplates] = useState<WatermarkTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Detail Page specific view mode (SCROLL = mobile preview, SLICES = grid of slices)
  const [detailViewMode, setDetailViewMode] = useState<"SCROLL" | "SLICES">("SCROLL")

  // Preview modal for zooming into a single slice
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Image editor modal state
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)

  // In-place editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      setIndex(initialIndex)
      // Reset detail view mode when opening
      setDetailViewMode("SCROLL")
      // Default to 'full' view for Detail Pages
      const currentItem = items[initialIndex]
      if (currentItem?.taskType === "DETAIL_PAGE") {
        setViewMode("full")
      } else {
        setViewMode("grid")
      }
    }
  }, [open, initialIndex, items])

  const item = items[index]

  // Sync watermark unlock state from item
  useEffect(() => {
    if (item) {
      setIsWatermarkUnlocked(item.isWatermarkUnlocked ?? false)
    }
  }, [item])

  // Fetch watermark templates when unlocked
  const fetchTemplates = useCallback(async () => {
    if (!isWatermarkUnlocked) return
    setLoadingTemplates(true)
    try {
      const res = await fetch("/api/user/watermarks")
      if (res.ok) {
        const data = await res.json()
        setWatermarkTemplates(data.templates || [])
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingTemplates(false)
    }
  }, [isWatermarkUnlocked])

  useEffect(() => {
    if (open && isWatermarkUnlocked) {
      fetchTemplates()
    }
  }, [open, isWatermarkUnlocked, fetchTemplates])

  const generatedImages = item?.generatedImages ?? []
  const fullImageUrl = item?.generatedImage ?? null
  const productName = item?.productName ?? "generated-images"
  const originalImages = item?.originalImage ?? []

  const canPrev = index > 0
  const canNext = index < items.length - 1

  const title = useMemo(() => item?.productName || "作品详情", [item])

  // Get selected template object
  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId || selectedTemplateId === "none") return null
    return watermarkTemplates.find(t => t.id === selectedTemplateId) || null
  }, [selectedTemplateId, watermarkTemplates])

  // Apply watermark to images
  const displayImages = useMemo(() => {
    if (!selectedTemplate || !generatedImages.length) {
      return generatedImages
    }

    const params: WatermarkParams = {
      type: selectedTemplate.type,
      content: selectedTemplate.content,
      opacity: selectedTemplate.opacity,
      rotate: selectedTemplate.rotate,
      scale: selectedTemplate.scale,
      position: selectedTemplate.position,
      xOffset: selectedTemplate.xOffset,
      yOffset: selectedTemplate.yOffset,
      isTiled: selectedTemplate.isTiled,
      fontSize: selectedTemplate.fontSize,
      fontColor: selectedTemplate.fontColor,
      fontName: selectedTemplate.fontName,
    }

    return generatedImages.map(url => {
      const watermarkedUrl = getWatermarkedUrl(url, params)
      console.log("[水印下载URL]", watermarkedUrl)
      return watermarkedUrl
    })
  }, [generatedImages, selectedTemplate])

  // Handle unlock watermark
  const handleUnlockWatermark = async () => {
    if (!item) return
    setIsUnlocking(true)
    try {
      const res = await fetch("/api/generation/unlock-watermark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: item.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "解锁失败")

      setIsWatermarkUnlocked(true)
      setShowUnlockConfirm(false)
      toast.success("水印功能已解锁！")
      // Update item in parent
      if (item) item.isWatermarkUnlocked = true
      onGenerateSuccess() // Refresh list
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "解锁失败"
      toast.error(message)
    } finally {
      setIsUnlocking(false)
    }
  }

  const handleRegenerate = async () => {
    if (!item) return

    const paid = (session?.user as any)?.credits ?? 0
    const bonus = (session?.user as any)?.bonusCredits ?? 0
    const total = paid + bonus

    const standardCost = item.taskType === "DETAIL_PAGE" ? costs.DETAIL_PAGE_STANDARD_COST : costs.MAIN_IMAGE_STANDARD_COST
    if (total < standardCost) {
      toast.error("余额不足", { description: `再次生成需要 ${standardCost} 积分，请先充值` })
      return
    }

    setShowRegenerateConfirm(false)
    toast.success("正在重新生成...", { description: "新任务已提交" })
    onOpenChange(false)
    onGenerateSuccess()

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: item.productName,
          productType: item.productType,
          taskType: item.taskType || "MAIN_IMAGE",
          images: item.originalImage,
          platformKey: "SHOPEE",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || `请求失败: ${res.status}`)
      }
    } catch (e: any) {
      toast.error(e?.message || "提交失败")
    }
  }

  const handleDiscountRetry = async () => {
    if (!item) return

    const paid = (session?.user as any)?.credits ?? 0
    const bonus = (session?.user as any)?.bonusCredits ?? 0
    const total = paid + bonus

    if (total < 99) {
      toast.error("余额不足", { description: "优惠重试需要 99 积分，请先充值" })
      return
    }

    setShowDiscountConfirm(false)
    toast.success("优惠重试任务已提交", { description: "新任务已加入队列" })

    // Optimistically update the discount flag to prevent double usage
    if (item) {
      item.hasUsedDiscountedRetry = true
    }

    onOpenChange(false)
    onGenerateSuccess()

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retryFromId: item.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || `请求失败: ${res.status}`)
      }
    } catch (e: any) {
      toast.error(e?.message || "优惠重试提交失败")
    }
  }

  const handleAppealSubmit = async () => {
    if (!item) return

    setIsSubmittingAppeal(true)
    try {
      const res = await fetch("/api/user/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId: item.id,
          reason: appealReason.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "申诉提交失败")
      }
      toast.success("申诉已提交", { description: "请等待管理员审核" })
      setShowAppealModal(false)
      setAppealReason("") // 重置输入
      onGenerateSuccess()
    } catch (e: any) {
      toast.error(e?.message || "申诉提交失败")
    } finally {
      setIsSubmittingAppeal(false)
    }
  }

  const canAppeal = useMemo(() => {
    if (!item) return false
    if (item.status !== "COMPLETED") return false
    if (!item.appeal) return true
    return item.appeal.status === "REJECTED"
  }, [item])

  const appealStatusText = useMemo(() => {
    if (!item?.appeal) return null
    switch (item.appeal.status) {
      case "PENDING": return "申诉审核中"
      case "APPROVED": return "申诉已通过"
      case "REJECTED": return "申诉被拒绝"
      default: return null
    }
  }, [item])

  const handleDownloadAll = async () => {
    if (!displayImages.length) return

    setIsDownloading(true)
    try {
      const zip = new JSZip()
      const folderName = productName || "generated-images"
      const folder = zip.folder(folderName)
      if (!folder) throw new Error("创建文件夹失败")

      const response = await fetch("/api/download-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls: displayImages }),
      })

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`)
      }

      const data = await response.json()
      if (!data.success || !Array.isArray(data.images)) {
        throw new Error("API返回数据格式错误")
      }

      let successCount = 0
      data.images.forEach((imageData: any, idx: number) => {
        if (imageData.success && imageData.data) {
          const fileExtension = imageData.contentType?.split("/")[1] || "png"
          const fileName = `${idx + 1}.${fileExtension}`

          const binaryString = atob(imageData.data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }

          folder.file(fileName, bytes)
          successCount++
        }
      })

      if (successCount === 0) throw new Error("所有图片下载失败")

      const zipBlob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${folderName}-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setIsDownloading(false)
    }
  }

  const downloadOne = (imgUrl: string, idx: number) => {
    downloadImage(imgUrl, `${productName || "image"}-${idx + 1}`)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(
          "max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0 bg-slate-950/95 border-white/10 overflow-hidden",
          (showRegenerateConfirm || showDiscountConfirm || showUnlockConfirm) && "pointer-events-none"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 pr-12 shrink-0">
            <DialogTitle className="text-white">
              <span className="truncate block">{title}</span>
            </DialogTitle>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="border-white/10 bg-white/5 hover:bg-white/10"
                disabled={!canPrev}
                onClick={() => setIndex((v) => Math.max(0, v - 1))}
                title="上一条"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="border-white/10 bg-white/5 hover:bg-white/10"
                disabled={!canNext}
                onClick={() => setIndex((v) => Math.min(items.length - 1, v + 1))}
                title="下一条"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Watermark Bar */}
            <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white">水印功能</span>
                </div>

                {!isWatermarkUnlocked ? (
                  // Locked state
                  <Button
                    size="sm"
                    onClick={() => setShowUnlockConfirm(true)}
                    className="h-8 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
                  >
                    <Lock className="w-3.5 h-3.5 mr-1.5" />
                    解锁水印 ({costs.WATERMARK_UNLOCK_COST}积分)
                  </Button>
                ) : (
                  // Unlocked state - show template selector
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-green-400">
                      <Unlock className="w-3 h-3" />
                      <span>已解锁</span>
                    </div>
                    <Select
                      value={selectedTemplateId || "none"}
                      onValueChange={setSelectedTemplateId}
                    >
                      <SelectTrigger className="w-[180px] h-8 bg-white/5 border-white/10 text-white text-xs">
                        <SelectValue placeholder="选择水印模板" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10">
                        <SelectItem value="none" className="text-white text-xs">
                          无水印
                        </SelectItem>
                        {loadingTemplates ? (
                          <div className="px-2 py-1 text-xs text-slate-400">加载中...</div>
                        ) : watermarkTemplates.length === 0 ? (
                          <div className="px-2 py-1 text-xs text-slate-400">暂无模板</div>
                        ) : (
                          watermarkTemplates.map((tpl) => (
                            <SelectItem key={tpl.id} value={tpl.id} className="text-white text-xs">
                              {tpl.name}
                            </SelectItem>
                          ))
                        )}
                        <div className="border-t border-white/10 mt-1 pt-1">
                          <a
                            href="/settings/watermark"
                            target="_blank"
                            className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-white/5 rounded"
                          >
                            <Settings className="w-3 h-3" />
                            管理模板
                          </a>
                        </div>
                      </SelectContent>
                    </Select>
                    {selectedTemplate && (
                      <div className="flex items-center gap-1 text-xs text-cyan-400">
                        <Check className="w-3 h-3" />
                        <span>已应用</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-green-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                生成完成
                {item?.taskType === "DETAIL_PAGE" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 ml-2">
                    详情页
                  </span>
                )}
              </div>

              {/* View Mode Toggle - Different for Detail Pages */}
              {item?.taskType === "DETAIL_PAGE" ? (
                <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
                  <Button
                    size="sm"
                    onClick={() => setDetailViewMode("SCROLL")}
                    className={cn(
                      "h-8 rounded-lg text-xs",
                      detailViewMode === "SCROLL"
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                        : "bg-transparent text-slate-400 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Smartphone className="w-4 h-4 mr-2" />
                    预览 (长图)
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => setDetailViewMode("SLICES")}
                    className={cn(
                      "h-8 rounded-lg text-xs",
                      detailViewMode === "SLICES"
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                        : "bg-transparent text-slate-400 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <LayoutGrid className="w-4 h-4 mr-2" />
                    切片 (素材)
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
                  <Button
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "h-8 rounded-lg text-xs",
                      viewMode === "grid"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                        : "bg-transparent text-slate-400 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Grid className="w-4 h-4 mr-2" />
                    九宫格视图
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => setViewMode("full")}
                    disabled={!fullImageUrl}
                    className={cn(
                      "h-8 rounded-lg text-xs",
                      viewMode === "full"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                        : "bg-transparent text-slate-400 hover:bg-white/10 hover:text-white",
                      !fullImageUrl && "opacity-50 cursor-not-allowed",
                    )}
                    title={!fullImageUrl ? "该记录没有拼接原图" : "查看拼接原图"}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    拼接原图
                  </Button>
                </div>
              )}
            </div>

            {/* 原始参考图 */}
            <div className="mt-6">
              <div className="text-sm font-semibold text-white mb-3">原始参考图</div>
              {originalImages.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {originalImages.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-slate-900/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Original ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">无原始参考图</div>
              )}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={(item?.taskType === "DETAIL_PAGE" ? detailViewMode : viewMode) + (selectedTemplateId || 'none')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="mt-4"
              >
                {/* Detail Page: SCROLL Mode (Mobile Simulator) */}
                {item?.taskType === "DETAIL_PAGE" && detailViewMode === "SCROLL" ? (
                  <div className="w-full bg-slate-900/50 rounded-2xl border border-white/10 p-4 flex justify-center">
                    <div
                      className="w-full max-w-[480px] shadow-2xl rounded-xl overflow-hidden overflow-y-auto max-h-[70vh]"
                      style={{ scrollBehavior: 'smooth' }}
                    >
                      {displayImages.map((img, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: i * 0.02 }}
                          className="w-full"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt={`Slice ${i + 1}`}
                            className="w-full h-auto block"
                            style={{ marginBottom: '-1px' }}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : item?.taskType === "DETAIL_PAGE" && detailViewMode === "SLICES" ? (
                  /* Detail Page: SLICES Mode (Grid) - with edit functionality */
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4 rounded-2xl border border-white/10 bg-slate-900/40">
                    {displayImages.map((img, i) => (
                      <motion.button
                        key={i}
                        type="button"
                        className="relative aspect-[2/3] group overflow-hidden rounded-xl border border-white/10 bg-black/20 cursor-pointer"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        whileHover={editingIndex === i ? undefined : { scale: 1.02 }}
                        onClick={() => {
                          if (editingIndex !== null) return
                          setSelectedImage(img)
                          setSelectedImageIndex(i)
                        }}
                        disabled={editingIndex !== null}
                        title={editingIndex === i ? "重绘中..." : "点击查看/编辑"}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={`Slice ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />

                        {/* Editing overlay */}
                        {editingIndex === i ? (
                          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                            <span className="text-xs text-white/80">重绘中...</span>
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <Pencil className="w-6 h-6 text-white mb-1" />
                            <span className="text-xs text-white/80">点击编辑</span>
                          </div>
                        )}

                        <div className="absolute bottom-2 right-2 text-[10px] text-white/60 bg-black/40 px-2 py-0.5 rounded">
                          {i + 1}/{displayImages.length}
                        </div>
                      </motion.button>
                    ))}
                  </div>

                ) : viewMode === "grid" ? (
                  /* Main Image: Grid Mode */
                  <div className="grid grid-cols-3 gap-2 rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 p-2">
                    {displayImages.map((img, i) => (
                      <motion.button
                        key={i}
                        type="button"
                        className="relative aspect-square group overflow-hidden rounded-lg cursor-pointer"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        whileHover={editingIndex === i ? undefined : { scale: 1.03 }}
                        onClick={() => {
                          if (editingIndex !== null) return // Disable click while editing
                          setSelectedImage(img)
                          setSelectedImageIndex(i)
                        }}
                        disabled={editingIndex !== null}
                        title={editingIndex === i ? "重绘中..." : "点击查看/编辑"}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={`Generated ${i + 1}`} className="w-full h-full object-cover" />

                        {/* Editing overlay */}
                        {editingIndex === i ? (
                          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                            <span className="text-xs text-white/80">重绘中...</span>
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                            <Pencil className="w-6 h-6 text-white drop-shadow-md" />
                            <span className="text-xs text-white/80">点击编辑</span>
                          </div>
                        )}

                      </motion.button>
                    ))}
                  </div>
                ) : (
                  /* Main Image: Full Mode */
                  <motion.div
                    className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 flex items-center justify-center p-4"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fullImageUrl || ""}
                      alt="Generated Full"
                      className="max-w-full max-h-[70vh] object-contain"
                    />
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 shrink-0 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {!item?.hasUsedDiscountedRetry ? (
                <Button
                  onClick={() => setShowDiscountConfirm(true)}
                  variant="outline"
                  className="h-11 rounded-xl border-yellow-400/50 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300"
                >
                  <SparklesIcon className="w-4 h-4 mr-2" />
                  重新生成 ({item?.taskType === "DETAIL_PAGE" ? costs.DETAIL_PAGE_RETRY_COST : costs.MAIN_IMAGE_RETRY_COST}积分)
                </Button>
              ) : (
                <Button
                  onClick={() => setShowRegenerateConfirm(true)}
                  variant="outline"
                  className="h-11 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white"
                >
                  🔄 重新生成 ({item?.taskType === "DETAIL_PAGE" ? costs.DETAIL_PAGE_STANDARD_COST : costs.MAIN_IMAGE_STANDARD_COST}积分)
                </Button>
              )}

              {item?.status === "COMPLETED" && (
                canAppeal ? (
                  <Button
                    onClick={() => setShowAppealModal(true)}
                    variant="outline"
                    className="h-11 rounded-xl border-orange-400/50 bg-orange-400/10 hover:bg-orange-400/20 text-orange-300"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    申诉
                  </Button>
                ) : appealStatusText ? (
                  <span className={cn(
                    "text-xs px-3 py-2 rounded-xl",
                    item.appeal?.status === "PENDING" && "bg-yellow-500/20 text-yellow-400",
                    item.appeal?.status === "APPROVED" && "bg-green-500/20 text-green-400",
                    item.appeal?.status === "REJECTED" && "bg-red-500/20 text-red-400",
                  )}>
                    {appealStatusText}
                  </span>
                ) : null
              )}
            </div>

            <Button
              onClick={handleDownloadAll}
              disabled={isDownloading}
              variant="outline"
              className="h-11 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isDownloading ? "下载中..." : selectedTemplate ? "下载带水印图片" : "下载全部图片"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unlock Watermark Confirmation Modal */}
      {typeof document !== 'undefined' && showUnlockConfirm && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowUnlockConfirm(false)
            }
          }}
          onMouseDownCapture={(e) => e.stopPropagation()}
          onPointerDownCapture={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-6 max-w-sm w-full mx-4 border border-white/10 relative pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-cyan-400" />
              解锁水印功能
            </h4>
            <p className="text-sm text-slate-400 mb-4">
              支付 <span className="text-cyan-400 font-semibold">{costs.WATERMARK_UNLOCK_COST} 积分</span> 解锁本组作品的水印编辑权限。
              <br />
              <span className="text-xs text-slate-500">解锁后永久可用，可随时添加或更换水印。</span>
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowUnlockConfirm(false)}
                className="flex-1 border-white/10 bg-white/5 hover:bg-white/10 text-white"
              >
                取消
              </Button>
              <Button
                onClick={handleUnlockWatermark}
                disabled={isUnlocking}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                {isUnlocking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                确认解锁
              </Button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Regenerate Confirmation Modal */}
      {typeof document !== 'undefined' && showRegenerateConfirm && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRegenerateConfirm(false)
            }
          }}
          onMouseDownCapture={(e) => e.stopPropagation()}
          onPointerDownCapture={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-6 max-w-sm w-full mx-4 border border-white/10 relative pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-semibold text-white mb-2">确认重新生成</h4>
            <p className="text-sm text-slate-400 mb-4">
              将使用相同参数重新生成图片，消耗 <span className="text-purple-400 font-semibold">{item?.taskType === "DETAIL_PAGE" ? costs.DETAIL_PAGE_STANDARD_COST : costs.MAIN_IMAGE_STANDARD_COST} 积分</span>。
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowRegenerateConfirm(false)}
                className="flex-1 border-white/10 bg-white/5 hover:bg-white/10 text-white"
              >
                取消
              </Button>
              <Button
                onClick={() => handleRegenerate()}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90"
              >
                确认生成
              </Button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Discount Retry Confirmation Modal */}
      {typeof document !== 'undefined' && showDiscountConfirm && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDiscountConfirm(false)
            }
          }}
          onMouseDownCapture={(e) => e.stopPropagation()}
          onPointerDownCapture={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-6 max-w-sm w-full mx-4 border border-white/10 relative pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-semibold text-white mb-2">确认优惠重试</h4>
            <p className="text-sm text-slate-400 mb-4">
              使用优惠价格重新生成图片，消耗 <span className="text-yellow-400 font-semibold">{item?.taskType === "DETAIL_PAGE" ? costs.DETAIL_PAGE_RETRY_COST : costs.MAIN_IMAGE_RETRY_COST} 积分</span>。
              <br />
              <span className="text-xs text-slate-500">（每条记录仅限一次优惠机会）</span>
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDiscountConfirm(false)}
                className="flex-1 border-white/10 bg-white/5 hover:bg-white/10 text-white"
              >
                取消
              </Button>
              <Button
                onClick={() => handleDiscountRetry()}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:opacity-90"
              >
                确认优惠重试
              </Button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Appeal Modal */}
      {typeof document !== 'undefined' && showAppealModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAppealModal(false)
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-6 max-w-sm w-full mx-4 border border-white/10 relative pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              确认申诉
            </h4>
            <p className="text-sm text-slate-400 mb-3">
              如果生成出来的图片货不对版，可以提交申诉申请退还积分。
              <br />
              <span className="text-orange-400 font-medium">预计退还 {item?.hasUsedDiscountedRetry ? 99 : 199} 积分</span>
            </p>
            <textarea
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              placeholder="请尽量告知哪里不一样，感谢！"
              rows={3}
              className="w-full mb-4 p-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm resize-none focus:outline-none focus:border-orange-400/50"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowAppealModal(false)}
                className="flex-1 border-white/10 bg-white/5 hover:bg-white/10 text-white"
              >
                取消
              </Button>
              <Button
                onClick={handleAppealSubmit}
                disabled={isSubmittingAppeal}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSubmittingAppeal ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                确认申诉
              </Button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Preview Image Modal */}
      {previewImage && (
        <PreviewImageModal
          src={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {/* Image Editor Modal */}
      {/* Image Editor Modal */}
      {selectedImage && selectedImageIndex !== null && (
        <ImageEditorModal
          imageUrl={selectedImage}
          productName={productName}
          onClose={() => {
            setSelectedImage(null)
            setSelectedImageIndex(null)
          }}
          onEdit={async (prompt) => {
            // Close modal first
            const imgIndex = selectedImageIndex
            const imgUrl = selectedImage
            setSelectedImage(null)
            setSelectedImageIndex(null)

            // Set editing state
            setEditingIndex(imgIndex)

            try {
              const res = await fetch("/api/generate/edit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  generationId: item?.id,
                  imageIndex: imgIndex,
                  prompt,
                  originalImageUrl: imgUrl,
                }),
              })

              const data = await res.json()

              if (!res.ok) {
                throw new Error(data.error || "编辑失败")
              }

              // Update local state with new image
              if (data.newImageUrl && item) {
                const newImages = [...item.generatedImages]
                newImages[imgIndex] = data.newImageUrl
                item.generatedImages = newImages
              }

              toast.success("图片已更新")
              onGenerateSuccess() // Refresh to get updated credits
            } catch (err) {
              const message = err instanceof Error ? err.message : "编辑失败"
              toast.error(message)
            } finally {
              setEditingIndex(null)
            }
          }}
        />
      )}
    </>
  )
}

// Preview Image Modal component - rendered within the parent
function PreviewImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative max-w-[90vw] max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
        >
          <X className="w-5 h-5" />
        </Button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Preview"
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
      </motion.div>
    </div>,
    document.body
  )
}
