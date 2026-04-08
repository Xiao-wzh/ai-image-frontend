"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import * as Tooltip from "@radix-ui/react-tooltip"
import {
    FileText,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Image as ImageIcon,
    Info,
    ChevronLeft,
    ChevronRight,
    Bot,
    MessageCircle,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/sidebar"
import { TopBanner } from "@/components/top-banner"
import { cn } from "@/lib/utils"

type Appeal = {
    id: string
    reason: string | null
    status: "PENDING" | "PROCESSING" | "PENDING_MANUAL_REVIEW" | "APPROVED" | "REJECTED"
    refundAmount: number
    adminNote: string | null
    aiAnalysis?: string | null
    userMessage?: string | null
    createdAt: string
    generation: {
        id: string
        productName: string
        productType: string
        originalImage: string[]
        generatedImages: string[]
        hasUsedDiscountedRetry: boolean
        createdAt: string
    }
}

type Pagination = {
    total: number
    page: number
    limit: number
    totalPages: number
}

export default function AppealsPage() {
    const [appeals, setAppeals] = useState<Appeal[]>([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 0 })

    const fetchAppeals = useCallback(async (page: number) => {
        try {
            setLoading(true)
            const params = new URLSearchParams({ page: String(page), limit: "10" })
            const res = await fetch(`/api/user/appeal?${params}`)
            if (!res.ok) throw new Error("获取失败")
            const data = await res.json()
            setAppeals(data.appeals || [])
            setPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 0 })
        } catch (err) {
            console.error("获取售后记录失败:", err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchAppeals(pagination.page)
    }, [pagination.page])

    const goToPage = (newPage: number) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            setPagination(prev => ({ ...prev, page: newPage }))
        }
    }

    const statusBadge = (
        status: string,
        adminNote?: string | null,
        userMessage?: string | null,
        aiAnalysis?: string | null
    ) => {
        // 获取要显示的消息（优先 aiAnalysis，其次 userMessage）
        const displayMessage = aiAnalysis || userMessage
        const hasMessage = Boolean(displayMessage || adminNote)

        // 组合消息内容
        const tooltipContent = [
            displayMessage,
            adminNote ? `管理员备注: ${adminNote}` : null
        ].filter(Boolean).join('\n')

        switch (status) {
            case "PENDING":
            case "PROCESSING":
            case "PENDING_MANUAL_REVIEW":
                return (
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            AI 审核中
                        </span>
                    </div>
                )
            case "APPROVED":
                return (
                    <div className="flex items-center gap-1.5">
                        <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 w-fit">
                                <CheckCircle className="w-3 h-3" />
                                已退款
                            </span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Bot className="w-2.5 h-2.5" />
                                AI 审核通过
                            </span>
                        </div>
                        {hasMessage && (
                            <Tooltip.Provider delayDuration={200}>
                                <Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                        <button className="p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer">
                                            <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-300" />
                                        </button>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal>
                                        <Tooltip.Content
                                            className="max-w-xs px-3 py-2 text-xs text-white bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50"
                                            sideOffset={5}
                                        >
                                            <div className="whitespace-pre-wrap">{tooltipContent}</div>
                                            <Tooltip.Arrow className="fill-slate-800" />
                                        </Tooltip.Content>
                                    </Tooltip.Portal>
                                </Tooltip.Root>
                            </Tooltip.Provider>
                        )}
                    </div>
                )
            case "REJECTED":
                return (
                    <div className="flex items-center gap-1.5">
                        <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20 w-fit">
                                <XCircle className="w-3 h-3" />
                                已驳回
                            </span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Bot className="w-2.5 h-2.5" />
                                AI 审核判定
                            </span>
                        </div>
                        {hasMessage && (
                            <Tooltip.Provider delayDuration={200}>
                                <Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                        <button className="p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer">
                                            <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-300" />
                                        </button>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal>
                                        <Tooltip.Content
                                            className="max-w-xs px-3 py-2 text-xs text-white bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50"
                                            sideOffset={5}
                                        >
                                            <div className="whitespace-pre-wrap">{tooltipContent}</div>
                                            <Tooltip.Arrow className="fill-slate-800" />
                                        </Tooltip.Content>
                                    </Tooltip.Portal>
                                </Tooltip.Root>
                            </Tooltip.Provider>
                        )}
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <div className="flex h-screen bg-slate-950">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <TopBanner />
                <div className="flex-1 overflow-auto p-6 md:p-8">
                    {/* Aurora background */}
                    <div className="fixed inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute -top-10 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
                        <div className="absolute top-10 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                    </div>

                    <div className="relative max-w-5xl mx-auto">
                        {/* Header */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">售后记录</h1>
                                <p className="text-slate-400 text-sm">查看您的申诉与退款历史</p>
                            </div>
                        </div>

                        {/* AI 审核说明卡片 */}
                        <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/20 flex-shrink-0">
                                    <Bot className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-blue-300">AI 智能审核说明</span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30">自动审核</span>
                                    </div>
                                    <div className="text-xs text-slate-400 space-y-1.5">
                                        <p>• 审核由 <span className="text-blue-300">AI 自动完成</span>，可能存在误判情况，属正常现象</p>
                                        <p>• 评判标准：<span className="text-white">生成图与原图的主体是否一致</span>（人物/商品等核心元素）</p>
                                        <p>• 若申诉图片中<span className="text-amber-400">夹带有主体一致的图片</span>，误判驳回的概率会增大</p>
                                        <p className="flex items-center gap-1.5">
                                            • 如有误判，请联系
                                            <span className="inline-flex items-center gap-1 text-emerald-400">
                                                <MessageCircle className="w-3.5 h-3.5" />
                                                右下角客服微信
                                            </span>
                                            进行人工复核
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
                            {loading ? (
                                <div className="p-6 space-y-4">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <Skeleton className="w-14 h-14 rounded-lg bg-white/10" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-1/3 bg-white/10" />
                                                <Skeleton className="h-3 w-1/4 bg-white/10" />
                                            </div>
                                            <Skeleton className="w-20 h-6 rounded-full bg-white/10" />
                                        </div>
                                    ))}
                                </div>
                            ) : appeals.length === 0 ? (
                                <div className="p-16 text-center">
                                    <AlertCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                                    <div className="text-lg font-medium text-slate-400 mb-2">暂无售后记录</div>
                                    <p className="text-sm text-slate-500">
                                        您还没有提交过任何申诉
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-white/10 bg-white/5">
                                                <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">作品</th>
                                                <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">申诉原因</th>
                                                <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">退款金额</th>
                                                <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">状态</th>
                                                <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">时间</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {appeals.map((appeal, index) => (
                                                <motion.tr
                                                    key={appeal.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                                >
                                                    {/* Product */}
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
                                                                {appeal.generation.generatedImages?.[0] ? (
                                                                    <img
                                                                        src={appeal.generation.generatedImages[0]}
                                                                        alt=""
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : appeal.generation.originalImage?.[0] ? (
                                                                    <img
                                                                        src={appeal.generation.originalImage[0]}
                                                                        alt=""
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <ImageIcon className="w-5 h-5 text-slate-600" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm text-white font-medium truncate max-w-[150px]">
                                                                    {appeal.generation.productName}
                                                                </div>
                                                                <div className="text-xs text-slate-500">
                                                                    {appeal.generation.hasUsedDiscountedRetry ? "优惠重试" : "正常生成"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Reason */}
                                                    <td className="p-4">
                                                        <div
                                                            className={cn(
                                                                "text-sm max-w-[180px] line-clamp-2",
                                                                appeal.reason ? "text-slate-300" : "text-slate-500 italic"
                                                            )}
                                                            title={appeal.reason || undefined}
                                                        >
                                                            {appeal.reason || "未填写"}
                                                        </div>
                                                    </td>

                                                    {/* Refund Amount */}
                                                    <td className="p-4">
                                                        <span className="text-purple-400 font-semibold">{appeal.refundAmount}</span>
                                                        <span className="text-slate-500 text-xs ml-1">积分</span>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="p-4">
                                                        {statusBadge(appeal.status, appeal.adminNote, appeal.userMessage, appeal.aiAnalysis)}
                                                    </td>

                                                    {/* Date */}
                                                    <td className="p-4">
                                                        <div className="text-sm text-slate-400">
                                                            {formatDistanceToNow(new Date(appeal.createdAt), {
                                                                addSuffix: true,
                                                                locale: zhCN,
                                                            })}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            {new Date(appeal.createdAt).toLocaleDateString("zh-CN")}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Summary (if has records) */}
                        {!loading && pagination.total > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mt-6 flex gap-4 justify-center flex-wrap"
                            >
                                <div className="glass rounded-xl px-4 py-2 border border-white/10 text-center">
                                    <div className="text-lg font-bold text-white">{pagination.total}</div>
                                    <div className="text-xs text-slate-400">总记录</div>
                                </div>
                                <div className="glass rounded-xl px-4 py-2 border border-amber-500/20 text-center">
                                    <div className="text-lg font-bold text-amber-400">
                                        {appeals.filter(a => ["PENDING", "PROCESSING", "PENDING_MANUAL_REVIEW"].includes(a.status)).length}
                                    </div>
                                    <div className="text-xs text-slate-400">审核中</div>
                                </div>
                                <div className="glass rounded-xl px-4 py-2 border border-emerald-500/20 text-center">
                                    <div className="text-lg font-bold text-emerald-400">
                                        {appeals.filter(a => a.status === "APPROVED").length}
                                    </div>
                                    <div className="text-xs text-slate-400">已退款</div>
                                </div>
                                <div className="glass rounded-xl px-4 py-2 border border-rose-500/20 text-center">
                                    <div className="text-lg font-bold text-rose-400">
                                        {appeals.filter(a => a.status === "REJECTED").length}
                                    </div>
                                    <div className="text-xs text-slate-400">已驳回</div>
                                </div>
                            </motion.div>
                        )}

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="p-4 border-t border-white/10 flex items-center justify-center gap-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => goToPage(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                    className="text-slate-400 hover:text-white disabled:opacity-40"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-1" />
                                    上一页
                                </Button>
                                <span className="text-sm text-slate-400">
                                    第 <span className="text-white font-medium">{pagination.page}</span> 页 / 共 <span className="text-white font-medium">{pagination.totalPages}</span> 页
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => goToPage(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.totalPages}
                                    className="text-slate-400 hover:text-white disabled:opacity-40"
                                >
                                    下一页
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
