"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, RefreshCw, ZoomIn, Grid, Image as ImageIcon, Loader2 } from "lucide-react"
import JSZip from 'jszip'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface GenerationResultProps {
  generatedImages: string[]
  fullImageUrl: string | null
  productName: string
  onTryAnother: () => void
  onPreview: (url: string) => void
}

export function GenerationResult({
  generatedImages,
  fullImageUrl,
  productName,
  onTryAnother,
  onPreview,
}: GenerationResultProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'full'>('grid')
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    if (generatedImages.length === 0) return

    setIsDownloading(true)
    try {
      const zip = new JSZip()

      // 创建以商品名称命名的文件夹
      const folderName = productName || 'generated-images'
      const folder = zip.folder(folderName)

      if (!folder) {
        throw new Error('创建文件夹失败')
      }

      console.log(`开始通过后端下载 ${generatedImages.length} 张图片...`)

      // 调用后端API下载图片（绕过CORS）
      const response = await fetch('/api/download-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: generatedImages }),
      })

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success || !Array.isArray(data.images)) {
        throw new Error('API返回数据格式错误')
      }

      let successCount = 0

      // 将Base64图片添加到ZIP
      data.images.forEach((imageData: any, index: number) => {
        if (imageData.success && imageData.data) {
          const fileExtension = imageData.contentType?.split('/')[1] || 'png'
          const fileName = `${index + 1}.${fileExtension}`

          // 将base64转换为blob
          const binaryString = atob(imageData.data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }

          folder.file(fileName, bytes)
          successCount++
          console.log(`第 ${index + 1} 张图片已添加到ZIP`)
        } else {
          console.error(`第 ${index + 1} 张图片下载失败:`, imageData.error)
        }
      })

      console.log(`成功添加 ${successCount}/${generatedImages.length} 张图片到ZIP`)

      if (successCount === 0) {
        throw new Error('所有图片下载失败')
      }

      // 生成 ZIP 文件并下载
      console.log('正在生成ZIP文件...')
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      console.log(`ZIP文件生成成功，大小: ${zipBlob.size} bytes`)

      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${folderName}-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      if (successCount < generatedImages.length) {
        alert(`下载完成！成功下载 ${successCount}/${generatedImages.length} 张图片`)
      }
    } catch (error) {
      console.error('生成压缩包失败:', error)
      alert(`下载失败: ${error instanceof Error ? error.message : '未知错误'}\n\n请查看浏览器控制台获取详细信息`)
    } finally {
      setIsDownloading(false)
    }
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
          生成完成
        </motion.div>

        {fullImageUrl && (
          <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
            <Button
              size="sm"
              onClick={() => setViewMode('grid')}
              className={cn(
                "h-8 rounded-lg text-xs",
                viewMode === 'grid' 
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                  : "bg-transparent text-slate-400 hover:bg-white/10 hover:text-white"
              )}
            >
              <Grid className="w-4 h-4 mr-2" />
              九宫格视图
            </Button>
            {/* <Button
              size="sm"
              onClick={() => setViewMode('full')}
              className={cn(
                "h-8 rounded-lg text-xs",
                viewMode === 'full' 
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                  : "bg-transparent text-slate-400 hover:bg-white/10 hover:text-white"
              )}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              拼接原图
            </Button> */}
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
          {viewMode === 'grid' ? (
            // Grid View
            <div className="grid grid-cols-3 gap-2 rounded-2xl overflow-hidden border border-white/20 backdrop-blur-sm bg-slate-900/50 p-2 max-h-[62vh] overflow-y-auto">
              {generatedImages.map((img, i) => (
                <motion.div
                  key={i}
                  className="relative aspect-square group overflow-hidden rounded-lg"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                >
                  <img src={img} alt={`Generated slice ${i + 1}`} className="w-full h-full object-cover" />
                  <div 
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    onClick={() => onPreview(img)}
                  >
                    <ZoomIn className="w-8 h-8 text-white" />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            // Full Image View
            <motion.div
              className="relative group rounded-2xl overflow-hidden border border-white/20 backdrop-blur-sm flex items-center justify-center bg-slate-900/50"
              whileHover={{ scale: 1.02 }}
            >
              <img
                src={fullImageUrl || ''}
                alt="Generated Full Image"
                className="max-w-full max-h-[70vh] object-contain"
              />
              <div 
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                onClick={() => onPreview(fullImageUrl || '')}
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
        className="grid grid-cols-2 gap-3"
      >
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          variant="outline"
          className="h-12 rounded-xl border-white/20 bg-white/5 hover:bg-white/10 text-white backdrop-blur-sm transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 300 }}>
            {isDownloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
          </motion.div>
          {isDownloading ? '下载中...' : '下载全部图片'}
        </Button>

        <Button
          onClick={onTryAnother}
          className="h-12 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 transition-all group"
        >
          <motion.div whileHover={{ rotate: 180 }} transition={{ type: "spring", stiffness: 200 }}>
            <RefreshCw className="w-4 h-4 mr-2" />
          </motion.div>
          再生成一张
        </Button>
      </motion.div>
    </motion.div>
  )
}
