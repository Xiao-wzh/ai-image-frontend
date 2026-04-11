"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface ImageWithLoaderProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  aspectRatio?: string // 例如 "1/1" | "2/3" | "3/4"
}

/**
 * 带加载状态和 shimmer 动画的图片组件
 * - 加载中：深灰背景 + shimmer 光效
 * - 加载完成：淡入显示
 * - 加载失败：灰色占位 + "加载失败" 文字
 */
export function ImageWithLoader({
  aspectRatio,
  className,
  onLoad,
  onError,
  alt = "",
  ...props
}: ImageWithLoaderProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <div
      className={cn("relative overflow-hidden bg-slate-800", className)}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* Shimmer 占位动画 */}
      {!loaded && !error && (
        <div className="absolute inset-0 shimmer-bg" />
      )}

      {/* 加载失败占位 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
          <span className="text-xs text-slate-500">加载失败</span>
        </div>
      )}

      {/* 实际图片 */}
      <img
        {...props}
        alt={alt}
        onLoad={(e) => {
          setLoaded(true)
          setError(false)
          onLoad?.(e)
        }}
        onError={(e) => {
          setError(true)
          setLoaded(true)
          onError?.(e)
        }}
        className={cn(
          "transition-opacity duration-150",
          loaded && !error ? "opacity-100" : "opacity-0",
          !aspectRatio && "w-full h-full"
        )}
      />

      <style jsx>{`
        .shimmer-bg {
          background: linear-gradient(
            90deg,
            rgba(30, 41, 59, 1) 0%,
            rgba(51, 65, 85, 0.6) 50%,
            rgba(30, 41, 59, 1) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
