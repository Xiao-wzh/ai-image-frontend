"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Download,
  RefreshCw,
  ZoomIn,
  Grid,
  Image as ImageIcon,
  Loader2,
  Sparkles as SparklesIcon,
  Flag,
  Crown,
  AlertTriangle,
} from "lucide-react"
import JSZip from "jszip"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useCosts } from "@/hooks/use-costs"
import { getThumbnailUrl } from "@/lib/cdnUrl"

interface GenerationResultProps {
  generationId: string
  generatedImages: string[]
  fullImageUrl: string | null
  productName: string
  onTryAnother: () => void
  onDiscountRetry: (generationId: string) => void
  onPreview: (url: string) => void
  qualityMode?: string  // STANDARD / PRO
  imageCount?: number   // PRO: 用户指定生成张数
  costPerImage?: number // PRO: 单张成本（用于显示重试费用）
}

export function GenerationResult({
  generationId,
  generatedImages,
  fullImageUrl,
  productName,
  onTryAnother,
  onDiscountRetry,
  onPreview,
  qualityMode = "STANDARD",
  imageCount = 9,
  costPerImage,
}: GenerationResultProps) {
  const { costs } = useCosts()
  const [viewMode, setViewMode] = useState<"grid" | "full">("grid")
  const [isDownloading, setIsDownloading] = useState(false)
  const [hasUsedRetry, setHasUsedRetry] = useState(false)
  const isPro = qualityMode === "PRO"
  const totalExpected = isPro ? imageCount : generatedImages.length
  const failedCount = Math.max(totalExpected - generatedImages.length, 0)

  // PRO 自适应网格布局
  const gridColsClass = isPro
    ? totalExpected === 1 ? "grid-cols-1" : totalExpected === 2 ? "grid-cols-2" : "grid-cols-2"
    : "grid-cols-3"

  const handleDownload = async () => {
    if (generatedImages.length === 0) return

    setIsDownloading(true)
    try {
      const zip = new JSZip()
      const folderName = productName || "generated-images"
      const folder = zip.folder(folderName)

      if (!folder) {
        throw new Error("创建文件夹失败")
      }

      const response = await fetch("/api/download-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls: generatedImages }),
      })

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success || !Array.isArray(data.images)) {
        throw new Error("API返回数据格式错误")
      }

      let successCount = 0
      data.images.forEach((imageData: any, index: number) => {
        if (imageData.success && imageData.data) {
          const fileExtension = imageData.contentType?.split("/")[1] || "png"
          const fileName = `${index + 1}.${fileExtension}`
          folder.file(fileName, atob(imageData.data), { binary: true })
          successCount++
        }
      })

      if (successCount === 0) {
        throw new Error("所有图片下载失败")
      }

      const zipBlob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${folderName}-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("生成压缩包失败:", error)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDiscountRetryClick = () => {
    setHasUsedRetry(true) // Optimistically hide the button
    onDiscountRetry(generationId)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-3xl mx-auto space-y-5"
    >
      {/* Success & View Toggle */}
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => toast.success("反馈已收到，客服审核确认后会返还积分")}
          className="h-8 rounded-lg text-xs text-slate-500 hover:text-slate-200 hover:bg-white/5"
        >
          <Flag className="w-4 h-4 mr-2" />
          图片与实物不符？点击申述退还积分
        </Button>
        {/* PRO Badge */}
        {isPro && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30"
          >
            <Crown className="w-3.5 h-3.5 text-white" />
            <span className="text-xs text-white font-bold">PRO</span>
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 text-sm text-green-400"
        >
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: 3 }}
            className="w-2 h-2 rounded-full bg-green-500"
          />
          {failedCount > 0 ? "部分生成完成" : "生成完成"}
        </motion.div>

        {fullImageUrl && (
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
              {isPro ? "图片列表" : "九宫格视图"}
            </Button>
            <Button
              size="sm"
              onClick={() => setViewMode("full")}
              className={cn(
                "h-8 rounded-lg text-xs",
                viewMode === "full"
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                  : "bg-transparent text-slate-400 hover:bg-white/10 hover:text-white",
              )}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              拼接原图
            </Button>
          </div>
        )}
      </div>

      {/* Image Display Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {viewMode === "grid" ? (
            <div className={`grid ${gridColsClass} gap-2 rounded-2xl overflow-hidden border border-white/20 backdrop-blur-sm bg-slate-900/50 p-2 max-h-[62vh] overflow-y-auto`}>
              {generatedImages.map((img, i) => (
                <motion.div
                  key={i}
                  className="relative aspect-square group overflow-hidden rounded-lg"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                >
                  {/* <img src={img} alt={`生成图片 ${i + 1}`} className={`w-full h-full ${isPro ? "object-contain" : "object-cover"}`} /> */}
                  {/* 将原来的 <img src={img} ... /> 修改为： */}
                  <img
                    src={getThumbnailUrl(img, 400) || img}
                    alt={`生成图片 ${i + 1}`}
                    className={`w-full h-full ${isPro ? "object-contain" : "object-cover"}`}
                    loading="lazy"
                  />
                  <div
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    // onClick={() => onPreview(img)}
                    onClick={() => onPreview(getThumbnailUrl(img, 1500) || img)}
                  >
                    <ZoomIn className="w-8 h-8 text-white" />
                  </div>
                </motion.div>
              ))}

              {/* 失败占位块 */}
              {failedCount > 0 && Array.from({ length: failedCount }).map((_, i) => (
                <motion.div
                  key={`failed-${i}`}
                  className="relative aspect-square rounded-lg bg-slate-800/60 border border-dashed border-slate-600/50 flex flex-col items-center justify-center gap-2"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: (generatedImages.length + i) * 0.05 }}
                >
                  <AlertTriangle className="w-6 h-6 text-slate-500" />
                  <span className="text-[11px] text-slate-500 text-center px-2">生成失败，已退还积分</span>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              className="relative group rounded-2xl overflow-hidden border border-white/20 backdrop-blur-sm flex items-center justify-center bg-slate-900/50"
              whileHover={{ scale: 1.02 }}
            >
              {/* <img
                src={fullImageUrl || ""}
                alt="Generated Full Image"
                className="max-w-full max-h-[70vh] object-contain"
              /> */}
              {/* 将原来的 <img src={fullImageUrl || ""} ... /> 修改为： */}
              <img
                src={getThumbnailUrl(fullImageUrl, 1500) || fullImageUrl || ""}
                alt="Generated Full Image"
                className="max-w-full max-h-[70vh] object-contain"
              />
              <div
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                onClick={() => onPreview(fullImageUrl || "")}
              >
                <ZoomIn className="w-8 h-8 text-white" />
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-3 gap-3"
      >
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          variant="outline"
          className="h-12 rounded-xl border-white/20 bg-white/5 hover:bg-white/10 text-white backdrop-blur-sm transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2 transition-transform group-hover:-translate-y-0.5" />
          )}
          {isDownloading ? "下载中..." : "下载全部"
          }
        </Button>

        {/* PRO 模式重试按钮 */}
        {isPro && !hasUsedRetry && (
          <Button
            onClick={handleDiscountRetryClick}
            variant="outline"
            className="h-12 rounded-xl border-amber-400/50 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 backdrop-blur-sm transition-all group"
          >
            <Crown className="w-4 h-4 mr-2 transition-transform group-hover:scale-110" />
            PRO 重试 ({(costPerImage ?? costs.PRO_COST_PER_IMAGE) * imageCount}积分)
          </Button>
        )}

        {/* STANDARD 模式优惠重试按钮 */}
        {!hasUsedRetry && !isPro && (
          <Button
            onClick={handleDiscountRetryClick}
            variant="outline"
            className="h-12 rounded-xl border-yellow-400/50 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 backdrop-blur-sm transition-all group"
          >
            <SparklesIcon className="w-4 h-4 mr-2 transition-transform group-hover:scale-110" />
            优惠重试 ({costs.MAIN_IMAGE_RETRY_COST}积分)
          </Button>

        )}

        <Button
          onClick={onTryAnother}
          className="h-12 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 transition-all group"
        >
          <RefreshCw className="w-4 h-4 mr-2 transition-transform group-hover:rotate-180" />
          再来一次
        </Button>
      </motion.div>
    </motion.div>
  )
}
