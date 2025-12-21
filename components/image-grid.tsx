"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { Download, Heart } from "lucide-react"

export function ImageGrid() {
  // 使用骨架屏模拟加载状态
  const isLoading = true

  return (
    <div className="glass rounded-3xl p-8 glass-hover">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">历史生成记录</h2>
        <span className="text-sm text-slate-400">共 9 张图片</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card
            key={i}
            className="group relative overflow-hidden bg-white/5 border border-white/10 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 rounded-xl backdrop-blur-sm"
          >
            {isLoading ? (
              <div className="aspect-square">
                <Skeleton className="w-full h-full rounded-none bg-white/10" />
              </div>
            ) : (
              <div className="aspect-square relative">
                <img
                  src={`/ai-generated-art.png?height=400&width=400&query=AI generated art ${i + 1}`}
                  alt={`生成图片 ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
                    <button className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-white/20 hover:scale-110 transition-all">
                      <Heart className="w-4 h-4 text-white" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-white/20 hover:scale-110 transition-all">
                      <Download className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
