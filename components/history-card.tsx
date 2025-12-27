"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

export type HistoryItem = {
  id: string
  productName: string
  productType: string
  generatedImages: string[]
  generatedImage?: string | null
  createdAt: string | Date
}

export function HistoryCard({
  item,
  onClick,
  className,
}: {
  item: HistoryItem
  onClick?: () => void
  className?: string
}) {
  const cover = item.generatedImages?.[0]

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group text-left rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 hover:border-white/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all",
        className,
      )}
    >
      <div className="relative aspect-square bg-black/20">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={item.productName || "历史作品"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-500">
            无封面
          </div>
        )}

        <div className="absolute top-3 left-3">
          <Badge className="bg-white/10 text-white border-white/10">9 Images</Badge>
        </div>

        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
      </div>

      <div className="p-4">
        <div className="font-semibold text-white truncate">{item.productName || "未命名"}</div>
        <div className="text-xs text-slate-400 mt-1">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: zhCN })}
        </div>
      </div>
    </motion.button>
  )
}

