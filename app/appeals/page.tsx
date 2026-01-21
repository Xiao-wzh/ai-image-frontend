"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
    FileText,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Image as ImageIcon,
    MessageSquare,
    Loader2,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

import { Skeleton } from "@/components/ui/skeleton"
import { Sidebar } from "@/components/sidebar"
import { TopBanner } from "@/components/top-banner"
import { cn } from "@/lib/utils"

type Appeal = {
    id: string
    reason: string | null
    status: "PENDING" | "APPROVED" | "REJECTED"
    refundAmount: number
    adminNote: string | null
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

export default function AppealsPage() {
    const [appeals, setAppeals] = useState<Appeal[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchAppeals() {
            try {
                const res = await fetch("/api/user/appeal")
                if (!res.ok) throw new Error("获取失败")
                const data = await res.json()
                setAppeals(data.appeals || [])
            } catch (err) {
                console.error("获取售后记录失败:", err)
            } finally {
                setLoading(false)
            }
        }
        fetchAppeals()
    }, [])

    const statusBadge = (status: string, adminNote?: string | null) => {
        switch (status) {
            case "PENDING":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                        <Clock className="w-3 h-3" />
                        审核中
                    </span>
                )
            case "APPROVED":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        <CheckCircle className="w-3 h-3" />
                        已退款
                    </span>
                )
            case "REJECTED":
                return (
                    <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 w-fit">
                            <XCircle className="w-3 h-3" />
                            已驳回
                        </span>
                        {adminNote && (
                            <div className="flex items-start gap-1.5 mt-1">
                                <MessageSquare className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                                <span className="text-xs text-slate-500 line-clamp-2" title={adminNote}>
                                    {adminNote}
                                </span>
                            </div>
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
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">售后记录</h1>
                                <p className="text-slate-400 text-sm">查看您的申诉与退款历史</p>
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
                                                        {statusBadge(appeal.status, appeal.adminNote)}
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
                        {!loading && appeals.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mt-6 flex gap-4 justify-center"
                            >
                                <div className="glass rounded-xl px-4 py-2 border border-white/10 text-center">
                                    <div className="text-lg font-bold text-white">{appeals.length}</div>
                                    <div className="text-xs text-slate-400">总记录</div>
                                </div>
                                <div className="glass rounded-xl px-4 py-2 border border-yellow-500/20 text-center">
                                    <div className="text-lg font-bold text-yellow-400">
                                        {appeals.filter(a => a.status === "PENDING").length}
                                    </div>
                                    <div className="text-xs text-slate-400">审核中</div>
                                </div>
                                <div className="glass rounded-xl px-4 py-2 border border-green-500/20 text-center">
                                    <div className="text-lg font-bold text-green-400">
                                        {appeals.filter(a => a.status === "APPROVED").length}
                                    </div>
                                    <div className="text-xs text-slate-400">已退款</div>
                                </div>
                                <div className="glass rounded-xl px-4 py-2 border border-red-500/20 text-center">
                                    <div className="text-lg font-bold text-red-400">
                                        {appeals.filter(a => a.status === "REJECTED").length}
                                    </div>
                                    <div className="text-xs text-slate-400">已驳回</div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

