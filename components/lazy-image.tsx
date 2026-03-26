"use client"

import { useEffect, useRef, useState } from "react"

interface LazyImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    src: string | null | undefined
    placeholder?: string
    rootMargin?: string
}

/**
 * 懒加载图片组件
 * 只有当图片进入视口时才加载，减少并发请求数量
 */
export function LazyImage({
    src,
    placeholder,
    rootMargin = "100px",
    className,
    ...props
}: LazyImageProps) {
    const imgRef = useRef<HTMLDivElement>(null)
    const [shouldLoad, setShouldLoad] = useState(false)
    const [hasError, setHasError] = useState(false)

    useEffect(() => {
        if (!src) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setShouldLoad(true)
                        observer.disconnect()
                    }
                })
            },
            { rootMargin }
        )

        if (imgRef.current) {
            observer.observe(imgRef.current)
        }

        return () => observer.disconnect()
    }, [src, rootMargin])

    const actualSrc = src ?? undefined

    return (
        <div ref={imgRef} className={`w-full h-full ${className || ""}`}>
            {shouldLoad && actualSrc ? (
                <img
                    src={actualSrc}
                    className={`w-full h-full ${className || ""}`}
                    onError={() => setHasError(true)}
                    {...props}
                />
            ) : (
                <div className="w-full h-full bg-slate-800/50 animate-pulse" />
            )}
            {hasError && (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                    <span className="text-slate-500 text-[10px]">加载失败</span>
                </div>
            )}
        </div>
    )
}
