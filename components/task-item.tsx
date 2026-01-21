"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { AlertCircle, Eye, Loader2, RefreshCw, Pencil } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ProductTypeLabel } from "@/lib/constants"
import { useCosts } from "@/hooks/use-costs"
import type { HistoryItem } from "@/components/history-card"

interface TaskItemProps {
    item: HistoryItem
    onViewDetails: () => void
    onRegenerateSuccess: () => void
}

export function TaskItem({ item, onViewDetails, onRegenerateSuccess }: TaskItemProps) {
    const { data: session } = useSession()
    const { costs } = useCosts()
    const [regenerating, setRegenerating] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const status = (item.status || "COMPLETED").toUpperCase()
    const isPending = status === "PENDING" || status === "PROCESSING"
    const isFailed = status === "FAILED"
    const isCompleted = status === "COMPLETED"
    const isEditing = (item.editingImageIndexes?.length || 0) > 0

    const typeLabel = item.productTypeDescription
        || (item.productType ? (ProductTypeLabel as any)[item.productType] : null)
        || item.productType
        || ""

    // Get cover image based on status
    const getCoverImage = () => {
        if (isCompleted) {
            return item.generatedImages?.[0] || item.originalImage?.[0] || null
        }
        return null
    }
    const cover = getCoverImage()

    const handleRegenerate = async () => {
        if (!item) return

        const paid = (session?.user as any)?.credits ?? 0
        const bonus = (session?.user as any)?.bonusCredits ?? 0
        const total = paid + bonus

        // Determine cost based on discount availability and task type
        const isDiscountAvailable = !item.hasUsedDiscountedRetry
        const isDetailPage = item.taskType === "DETAIL_PAGE"
        const standardCost = isDetailPage ? costs.DETAIL_PAGE_STANDARD_COST : costs.MAIN_IMAGE_STANDARD_COST
        const retryCost = isDetailPage ? costs.DETAIL_PAGE_RETRY_COST : costs.MAIN_IMAGE_RETRY_COST
        const cost = isDiscountAvailable ? retryCost : standardCost

        if (total < cost) {
            toast.error("余额不足", { description: `重新生成需要 ${cost} 积分，请先充值` })
            return
        }

        // Close modal immediately and show toast
        setShowConfirm(false)
        toast.success("正在重新生成...", { description: "新任务已提交，请等待处理" })

        // Optimistically update the discount flag to prevent double usage
        if (isDiscountAvailable) {
            item.hasUsedDiscountedRetry = true
        }

        onRegenerateSuccess()

        // Make API call in background
        try {
            // If discount is available, use the retry endpoint which only needs retryFromId
            const requestBody = isDiscountAvailable
                ? { retryFromId: item.id }
                : {
                    productName: item.productName,
                    productType: item.productType,
                    taskType: item.taskType || "MAIN_IMAGE",
                    images: item.originalImage,
                    platformKey: "SHOPEE",
                    outputLanguage: item.outputLanguage || "繁体中文",
                }

            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data?.error || `请求失败: ${res.status}`)
            }
        } catch (e: any) {
            toast.error(e?.message || "提交失败")
        }
    }

    const handleViewDetails = () => {
        if (isPending) {
            toast.message("正在生成中...", { description: "请稍后刷新或等待自动更新" })
            return
        }
        if (isFailed) {
            toast.error("生成失败", { description: "该任务未生成成功，积分已退回" })
            return
        }
        onViewDetails()
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-slate-900/40 hover:border-white/20 hover:bg-slate-900/60 transition-all",
                    isFailed && "border-red-500/20 bg-red-950/20 hover:border-red-400/30"
                )}
            >
                {/* Left: Thumbnail */}
                <div
                    className={cn(
                        "relative w-20 h-20 rounded-xl overflow-hidden shrink-0 flex items-center justify-center",
                        isPending && "bg-gradient-to-br from-slate-800/80 to-slate-900/80",
                        isFailed && "bg-gradient-to-br from-slate-900/60 to-red-950/40",
                        isCompleted && "bg-black/20"
                    )}
                >
                    {isPending ? (
                        <div className="flex flex-col items-center justify-center gap-1">
                            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                            <span className="text-[10px] text-slate-400">生成中</span>
                        </div>
                    ) : isFailed ? (
                        <div className="flex flex-col items-center justify-center gap-1">
                            <AlertCircle className="w-6 h-6 text-red-400" />
                            <span className="text-[10px] text-red-400">失败</span>
                        </div>
                    ) : cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={cover}
                            alt={item.productName || "任务缩略图"}
                            className={cn(
                                "w-full h-full object-cover",
                                item.taskType === "DETAIL_PAGE" && "object-top"
                            )}
                            loading="lazy"
                        />
                    ) : (
                        <div className="text-slate-500 text-xs">无图</div>
                    )}
                </div>

                {/* Middle: Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white text-sm truncate" title={item.productName}>
                            {item.productName || "未命名"}
                        </h3>
                        {/* Status Badge */}
                        {isPending && (
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-1.5 py-0">
                                进行中
                            </Badge>
                        )}
                        {isCompleted && (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">
                                已完成
                            </Badge>
                        )}
                        {isFailed && (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0">
                                失败
                            </Badge>
                        )}
                        {/* Editing indicator */}
                        {isEditing && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-400/30 text-[10px] px-1.5 py-0 flex items-center gap-1">
                                <Pencil className="w-2.5 h-2.5 animate-pulse" />
                                重绘中
                            </Badge>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                        {/* taskType badge */}
                        {item.taskType === "DETAIL_PAGE" ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                详情页
                            </span>
                        ) : item.taskType === "MAIN_IMAGE" ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                主图
                            </span>
                        ) : null}
                        {typeLabel && (
                            <span className="border border-white/10 px-1.5 py-0.5 rounded text-[10px]">
                                {typeLabel}
                            </span>
                        )}
                        <span>
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: zhCN })}
                        </span>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleViewDetails}
                        disabled={isPending}
                        className="text-xs text-slate-300 hover:text-white hover:bg-white/10 gap-1.5"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        查看详情
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowConfirm(true)}
                        disabled={regenerating}
                        className="text-xs text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 gap-1.5"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", regenerating && "animate-spin")} />
                        重新生成
                    </Button>
                </div>
            </motion.div>

            {/* Confirm Dialog - shows different price based on discount availability */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass rounded-2xl p-6 max-w-sm w-full mx-4 border border-white/10"
                    >
                        {!item.hasUsedDiscountedRetry ? (
                            <>
                                <h4 className="text-lg font-semibold text-white mb-2">确认重新生成</h4>
                                <p className="text-sm text-slate-400 mb-4">
                                    将使用相同参数重新生成图片，消耗 <span className="text-yellow-400 font-semibold">{item.taskType === "DETAIL_PAGE" ? costs.DETAIL_PAGE_RETRY_COST : costs.MAIN_IMAGE_RETRY_COST} 积分</span>。
                                    <br />
                                    <span className="text-xs text-slate-500">（每条记录仅限一次优惠机会）</span>
                                </p>
                            </>
                        ) : (
                            <>
                                <h4 className="text-lg font-semibold text-white mb-2">确认重新生成</h4>
                                <p className="text-sm text-slate-400 mb-4">
                                    将使用相同参数重新生成图片，消耗 <span className="text-purple-400 font-semibold">{item.taskType === "DETAIL_PAGE" ? costs.DETAIL_PAGE_STANDARD_COST : costs.MAIN_IMAGE_STANDARD_COST} 积分</span>。
                                </p>
                            </>
                        )}
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 border-white/10 bg-white/5 hover:bg-white/10 text-white"
                            >
                                取消
                            </Button>
                            <Button
                                onClick={handleRegenerate}
                                disabled={regenerating}
                                className={cn(
                                    "flex-1 text-white hover:opacity-90",
                                    !item.hasUsedDiscountedRetry
                                        ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                                        : "bg-gradient-to-r from-blue-600 to-purple-600"
                                )}
                            >
                                {regenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        处理中...
                                    </>
                                ) : (
                                    "确认生成"
                                )}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </>
    )
}
