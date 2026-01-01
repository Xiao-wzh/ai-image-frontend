"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { ProductTypeLabel } from "@/lib/constants"

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

  const typeLabel = item.productType
    ? (ProductTypeLabel as any)[item.productType] || item.productType
    : ""

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        // 强制卡片宽度占满 grid 单元格，flex-col 使内部元素垂直排列
        "group w-full relative text-left rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 hover:border-white/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all flex flex-col",
        className,
      )}
    >
      {/* 图片容器：强制正方形比例 */}
      <div className="relative aspect-square w-full bg-black/20 overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={item.productName || "历史作品"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-500">无封面</div>
        )}

        <div className="absolute top-3 left-3">
          <Badge className="bg-white/10 text-white border-white/10 backdrop-blur-sm">9 Images</Badge>
        </div>

        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
      </div>

      <div className="p-4 w-full">
        {/* 标题：强制单行截断 */}
        <div className="font-semibold text-white text-sm truncate w-full block" title={item.productName}>
          {item.productName || "未命名"}
        </div>

        <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
          <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: zhCN })}</span>
          {/* 类型中文名 */}
          {typeLabel && (
            <span className="opacity-60 text-[10px] border border-white/10 px-1.5 py-0.5 rounded">
              {typeLabel}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  )
}
