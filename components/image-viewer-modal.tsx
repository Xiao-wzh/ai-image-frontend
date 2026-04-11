"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { X, ChevronLeft, ChevronRight, Download, Pencil, RotateCcw, Loader2 } from "lucide-react"
import { downloadImage } from "@/lib/utils"
import { getThumbnailUrl } from "@/lib/cdnUrl"

interface ImageViewerModalProps {
  images: string[]
  currentIndex: number
  productName?: string
  onClose: () => void
  onIndexChange: (index: number) => void
  onEdit?: (imageUrl: string, index: number) => void
}

export function ImageViewerModal({
  images,
  currentIndex,
  productName = "image",
  onClose,
  onIndexChange,
  onEdit,
}: ImageViewerModalProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const transformRef = useRef<any>(null)

  const canPrev = currentIndex > 0
  const canNext = currentIndex < images.length - 1
  const currentUrl = images[currentIndex] || ""
  // 始终使用 1200px 缩略图查看（下载时用原图），避免多次加载
  const displayUrl = getThumbnailUrl(currentUrl, 1200) || currentUrl

  // 切换图片时重置加载状态
  useEffect(() => {
    setImgLoaded(false)
    setImgError(false)
  }, [currentIndex])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          e.stopPropagation()
          if (canPrev) {
            onIndexChange(currentIndex - 1)
            transformRef.current?.resetTransform()
          }
          break
        case "ArrowRight":
          e.preventDefault()
          e.stopPropagation()
          if (canNext) {
            onIndexChange(currentIndex + 1)
            transformRef.current?.resetTransform()
          }
          break
        case "Escape":
          e.preventDefault()
          e.stopPropagation()
          onClose()
          break
        case "+":
        case "=":
          e.preventDefault()
          transformRef.current?.zoomIn()
          break
        case "-":
          e.preventDefault()
          transformRef.current?.zoomOut()
          break
        case "0":
          e.preventDefault()
          transformRef.current?.resetTransform()
          break
      }
    }
    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [canPrev, canNext, currentIndex, onIndexChange, onClose])

  // 移动端滑动手势
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length !== 1) return
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y

    // 只在水平滑动距离 > 50px 且大于垂直距离时触发（避免和拖拽冲突）
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      // 缩放状态下不切换（scale ≈ 1 时才切换）
      const scale = transformRef.current?.state?.scale
      if (scale && Math.abs(scale - 1) > 0.1) return

      if (dx < 0 && canNext) {
        onIndexChange(currentIndex + 1)
        transformRef.current?.resetTransform()
      } else if (dx > 0 && canPrev) {
        onIndexChange(currentIndex - 1)
        transformRef.current?.resetTransform()
      }
    }
    touchStartRef.current = null
  }, [canPrev, canNext, currentIndex, onIndexChange])

  const handleDownload = () => {
    downloadImage(currentUrl, `${productName}-${currentIndex + 1}`)
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit(currentUrl, currentIndex)
    }
  }

  if (typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex flex-col bg-black/95 pointer-events-auto isolate"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="text-white/70 text-sm">
          <span className="text-white font-semibold">{currentIndex + 1}</span>
          <span className="mx-1">/</span>
          <span>{images.length}</span>
        </div>

        {/* 左右切换按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (canPrev) {
                onIndexChange(currentIndex - 1)
                transformRef.current?.resetTransform()
              }
            }}
            disabled={!canPrev}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (canNext) {
                onIndexChange(currentIndex + 1)
                transformRef.current?.resetTransform()
              }
            }}
            disabled={!canNext}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 图片主体 - 直接用 img，不包裹额外 div */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <TransformWrapper
          ref={transformRef}
          initialScale={1}
          minScale={0.5}
          maxScale={5}
          doubleClick={{ mode: "toggle", step: 2 }}
          wheel={{ step: 0.2 }}
          pinch={{ step: 0.5 }}
          panning={{ disabled: false }}
        >
          <TransformComponent
            wrapperClass="!w-full !h-full"
            contentClass="!w-full !h-full flex items-center justify-center"
          >
            {/* 加载中指示器 */}
            {!imgLoaded && !imgError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
              </div>
            )}
            {/* 加载失败 */}
            {imgError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm text-white/50">图片加载失败</span>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayUrl}
              alt={`图片 ${currentIndex + 1}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
              style={{ opacity: imgLoaded && !imgError ? 1 : 0, transition: 'opacity 150ms' }}
            />
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* 底部工具栏 */}
      <div className="flex items-center justify-center gap-1 py-3 px-4 bg-black/60 backdrop-blur-sm shrink-0">
        <ToolBtn icon={<Download className="w-4 h-4" />} label="下载" onClick={handleDownload} />
        {onEdit && (
          <ToolBtn icon={<Pencil className="w-4 h-4" />} label="编辑" onClick={handleEdit} />
        )}
        <ToolBtn
          icon={<RotateCcw className="w-4 h-4" />}
          label="还原"
          onClick={() => transformRef.current?.resetTransform()}
        />
        <ToolBtn icon={<X className="w-4 h-4" />} label="关闭" onClick={onClose} />
      </div>
    </div>,
    document.body
  )
}

function ToolBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white min-w-[60px]"
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  )
}
