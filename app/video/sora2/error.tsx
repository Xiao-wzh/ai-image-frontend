"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function VideoError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[SORA2] 页面错误:", error)
  }, [error])

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
      <div className="text-center space-y-4 max-w-md px-6">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
        <h2 className="text-xl font-semibold">页面出现了问题</h2>
        <p className="text-sm text-slate-400">视频页面加载时发生错误，请尝试刷新页面</p>
        <Button onClick={reset} className="bg-gradient-to-r from-violet-500 to-fuchsia-600">
          重试
        </Button>
      </div>
    </div>
  )
}
