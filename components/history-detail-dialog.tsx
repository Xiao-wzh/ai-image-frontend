"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import JSZip from "jszip"
import {
  Download,
  Grid,
  Image as ImageIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { HistoryItem } from "@/components/history-card"

export function HistoryDetailDialog({
  open,
  onOpenChange,
  items,
  initialIndex,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  items: HistoryItem[]
  initialIndex: number
}) {
  const [index, setIndex] = useState(initialIndex)
  const [viewMode, setViewMode] = useState<"grid" | "full">("grid")
  const [isDownloading, setIsDownloading] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isDownloadingSingle, setIsDownloadingSingle] = useState(false)

  async function handleDownload(url: string, filename: string) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`下载失败: ${res.status}`)
    const blob = await res.blob()
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  useEffect(() => {
    if (open) setIndex(initialIndex)
  }, [open, initialIndex])

  const item = items[index]
  const generatedImages = item?.generatedImages ?? []
  const fullImageUrl = item?.generatedImage ?? null
  const productName = item?.productName ?? "generated-images"

  const canPrev = index > 0
  const canNext = index < items.length - 1

  const title = useMemo(() => item?.productName || "作品详情", [item])

  async function handleDownloadSingle(url: string) {
    setIsDownloadingSingle(true)
    try {
      const name = `${productName || "image"}-${Date.now()}.png`
      await handleDownload(url, name)
    } finally {
      setIsDownloadingSingle(false)
    }
  }

  const handleDownloadAll = async () => {
    if (!generatedImages.length) return

    setIsDownloading(true)
    try {
      const zip = new JSZip()
      const folderName = productName || "generated-images"
      const folder = zip.folder(folderName)
      if (!folder) throw new Error("创建文件夹失败")

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Image Preview Overlay */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="relative w-full max-w-6xl max-h-[90vh]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={previewImage} 
                alt="Preview" 
                className="max-w-full max-h-[80vh] md:max-h-[85vh] object-contain"
              />
              
              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPreviewImage(null)
                }}
                className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
                aria-label="Close preview"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              
              {/* Download Button */}
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  await handleDownloadSingle(previewImage)
                }}
                disabled={isDownloadingSingle}
                className="absolute top-0 right-0 translate-y-[-3.25rem] flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                {isDownloadingSingle ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    下载中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    下载图片
                  </>
                )}
              </button>
            </motion.div>
            
            {/* Click outside to close */}
            <div 
              className="absolute inset-0 -z-10"
              onClick={() => setPreviewImage(null)}
            />
          </div>
        )}
      </AnimatePresence>

      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0 bg-slate-950/95 border-white/10 overflow-hidden">
        {/* Header（预留右侧 X 按钮空间，避免重叠） */}
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
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-green-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              生成完成
            </div>

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
                  九宫格视图
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

          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {viewMode === "grid" ? (
                <div className="grid grid-cols-3 gap-2 rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 p-2">
                  {generatedImages.map((img, i) => (
                    <motion.div
                      key={i}
                      className="relative aspect-square group overflow-hidden rounded-lg"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      whileHover={{ scale: 1.03 }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Generated ${i + 1}`} className="w-full h-full object-cover cursor-zoom-in" />
                      <div
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        onClick={() => setPreviewImage(img)}
                      >
                        <ZoomIn className="w-8 h-8 text-white" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div
                  className="relative group rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 flex items-center justify-center"
                  whileHover={{ scale: 1.01 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fullImageUrl || ""}
                    alt="Generated Full"
                    className="max-w-full max-h-[70vh] object-contain cursor-zoom-in"
                  />
                  <div
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    onClick={() => setPreviewImage(fullImageUrl || "")}
                  >
                    <ZoomIn className="w-8 h-8 text-white" />
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 shrink-0">
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
            {isDownloading ? "下载中..." : "下载全部图片"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

