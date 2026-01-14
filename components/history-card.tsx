"use client"

import { motion } from "framer-motion"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { ProductTypeLabel } from "@/lib/constants"
import { AlertCircle, Loader2, Pencil } from "lucide-react"

export type HistoryItem = {
  id: string
  productName: string
  productType: string
  taskType?: string // MAIN_IMAGE / DETAIL_PAGE
  generatedImages: string[]
  generatedImage?: string | null
  createdAt: string | Date
  status: string
  originalImage: string[]
  hasUsedDiscountedRetry?: boolean
  isWatermarkUnlocked?: boolean
  editingImageIndexes?: number[] // Images currently being edited
  appeal?: {
    id: string
    status: string
  } | null
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

  const status = (item.status || "COMPLETED").toUpperCase()
  const isPending = status === "PENDING"
  const isFailed = status === "FAILED"
  const isDetailPage = item.taskType === "DETAIL_PAGE"
  const isEditing = (item.editingImageIndexes?.length || 0) > 0

  const handleClick = () => {
    if (isPending) {
      toast.message("正在生成中...", { description: "请稍后刷新或等待自动更新" })
      return
    }
    if (isFailed) {
      toast.error("生成失败", { description: "该任务未生成成功，积分已退回（如未退回请联系申诉）" })
      return
    }
    onClick?.()
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileHover={isPending || isFailed ? undefined : { scale: 1.02 }}
      whileTap={isPending || isFailed ? undefined : { scale: 0.98 }}
      disabled={isPending}
      className={cn(
        // 强制卡片宽度占满 grid 单元格，flex-col 使内部元素垂直排列
        "group w-full relative text-left rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 hover:border-white/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all flex flex-col disabled:opacity-90 disabled:cursor-not-allowed",
        isFailed && "border-red-500/20 bg-red-950/20 hover:border-red-400/30",
        className,
      )}
    >
      {/* 图片容器：强制正方形比例 */}
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden",
          isFailed ? "bg-gradient-to-br from-slate-900/60 to-red-950/40" : "bg-black/20",
        )}
      >
        {isPending ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
            <div className="text-sm font-medium text-slate-200">正在生成中...</div>
            <div className="text-[11px] text-slate-500">预计 1-3 分钟</div>
          </div>
        ) : isFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <div className="text-sm font-semibold text-red-200">生成失败</div>
            <Badge className="bg-white/10 text-slate-200 border-white/10">已退款</Badge>
          </div>
        ) : cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={item.productName || "历史作品"}
            className={cn(
              "h-full w-full",
              isDetailPage ? "object-cover object-top" : "object-cover"
            )}
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-500">无封面</div>
        )}

        {/* <div className="absolute top-3 left-3">
          {status === "COMPLETED" ? (
            <Badge className="bg-white/10 text-white border-white/10 backdrop-blur-sm">9 Images</Badge>
          ) : (
            <Badge className="bg-white/10 text-white border-white/10 backdrop-blur-sm">{status}</Badge>
          )}
        </div> */}

        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 via-black/0 to-black/0" />

        {/* Editing indicator - top left badge */}
        {isEditing && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/80 backdrop-blur-sm border border-purple-400/30">
            <Pencil className="w-3 h-3 text-white animate-pulse" />
            <span className="text-[10px] text-white font-medium">重绘中</span>
          </div>
        )}
      </div>

      <div className="p-4 w-full">
        {/* 标题：强制单行截断 */}
        <div className="font-semibold text-white text-sm truncate w-full block" title={item.productName}>
          {item.productName || "未命名"}
        </div>

        <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
          <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: zhCN })}</span>
          <div className="flex items-center gap-1">
            {/* taskType badge */}
            {isDetailPage ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                详情页
              </span>
            ) : item.taskType === "MAIN_IMAGE" ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                主图
              </span>
            ) : null}
            {/* 类型中文名 */}
            {typeLabel && (
              <span className="opacity-60 text-[10px] border border-white/10 px-1.5 py-0.5 rounded">
                {typeLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  )
}
