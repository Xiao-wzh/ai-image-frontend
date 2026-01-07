"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    Shield,
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    Image as ImageIcon,
    X,
    Loader2
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Sidebar } from "@/components/sidebar"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

type Appeal = {
    id: string
    userId: string
    generationId: string
    reason: string
    status: "PENDING" | "APPROVED" | "REJECTED"
    refundAmount: number
    adminNote: string | null
    createdAt: string
    user: {
        id: string
        name: string | null
        username: string | null
        email: string
    }
    generation: {
        id: string
        productName: string
        productType: string
        productTypeDescription?: string | null
        generatedImages: string[]
        generatedImage: string | null
        originalImage: string[]
        hasUsedDiscountedRetry: boolean
        createdAt: string
    }
}

type Stats = {
    pending: number
    approved: number
    rejected: number
    total: number
}

export default function AdminAppealsPage() {
    const router = useRouter()
    const [appeals, setAppeals] = useState<Appeal[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>("all")

    // Preview dialog
    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewImages, setPreviewImages] = useState<string[]>([])
    const [previewTitle, setPreviewTitle] = useState("")

    // Reject dialog
    const [rejectOpen, setRejectOpen] = useState(false)
    const [rejectingAppeal, setRejectingAppeal] = useState<Appeal | null>(null)
    const [rejectNote, setRejectNote] = useState("")
    const [processing, setProcessing] = useState<string | null>(null)

    const fetchAppeals = useCallback(async () => {
        try {
            const params = new URLSearchParams()
            if (statusFilter !== "all") params.set("status", statusFilter)

            const res = await fetch(`/api/admin/appeals?${params.toString()}`)
            if (!res.ok) throw new Error("获取失败")

            const data = await res.json()
            setAppeals(data.appeals || [])
            setStats(data.stats || null)
        } catch (err) {
            toast.error("获取申诉列表失败")
        } finally {
            setLoading(false)
        }
    }, [statusFilter])

    useEffect(() => {
        fetchAppeals()
    }, [fetchAppeals])

    const handleApprove = async (appeal: Appeal) => {
        if (!confirm(`确认通过申诉？将退还 ${appeal.refundAmount} 积分给用户 ${appeal.user.email}`)) {
            return
        }

        setProcessing(appeal.id)
        try {
            const res = await fetch("/api/admin/appeals/resolve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    appealId: appeal.id,
                    action: "APPROVE",
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "操作失败")

            toast.success(`申诉已通过，已退还 ${appeal.refundAmount} 积分`)
            fetchAppeals()
        } catch (err: any) {
            toast.error(err.message || "操作失败")
        } finally {
            setProcessing(null)
        }
    }

    const handleReject = async () => {
        if (!rejectingAppeal) return
        if (rejectNote.trim().length < 5) {
            toast.error("拒绝理由至少需要5个字符")
            return
        }

        setProcessing(rejectingAppeal.id)
        try {
            const res = await fetch("/api/admin/appeals/resolve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    appealId: rejectingAppeal.id,
                    action: "REJECT",
                    adminNote: rejectNote.trim(),
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "操作失败")

            toast.success("申诉已拒绝")
            setRejectOpen(false)
            setRejectingAppeal(null)
            setRejectNote("")
            fetchAppeals()
        } catch (err: any) {
            toast.error(err.message || "操作失败")
        } finally {
            setProcessing(null)
        }
    }

    const openPreview = (appeal: Appeal) => {
        const images = appeal.generation.generatedImages?.length
            ? appeal.generation.generatedImages
            : appeal.generation.originalImage
        setPreviewImages(images || [])
        setPreviewTitle(appeal.generation.productName)
        setPreviewOpen(true)
    }

    const openRejectDialog = (appeal: Appeal) => {
        setRejectingAppeal(appeal)
        setRejectNote("")
        setRejectOpen(true)
    }

    const statusBadge = (status: string) => {
        switch (status) {
            case "PENDING":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                        <Clock className="w-3 h-3" />
                        待处理
                    </span>
                )
            case "APPROVED":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        已通过
                    </span>
                )
            case "REJECTED":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                        <XCircle className="w-3 h-3" />
                        已拒绝
                    </span>
                )
            default:
                return null
        }
    }

    return (
        <div className="flex min-h-screen bg-slate-950">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto">
                {/* Aurora background */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-10 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                    <div className="absolute top-10 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">申诉管理</h1>
                                <p className="text-slate-400 text-sm">审核用户申诉请求</p>
                            </div>
                        </div>

                        <Button
                            onClick={() => router.push("/admin/prompts")}
                            variant="outline"
                            className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                        >
                            返回管理后台
                        </Button>
                    </div>

                    {/* Stats Cards */}
                    {stats && (
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="glass rounded-xl p-4 border border-white/10">
                                <div className="text-2xl font-bold text-white">{stats.total}</div>
                                <div className="text-xs text-slate-400">总申诉</div>
                            </div>
                            <div className="glass rounded-xl p-4 border border-yellow-500/20">
                                <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
                                <div className="text-xs text-slate-400">待处理</div>
                            </div>
                            <div className="glass rounded-xl p-4 border border-green-500/20">
                                <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
                                <div className="text-xs text-slate-400">已通过</div>
                            </div>
                            <div className="glass rounded-xl p-4 border border-red-500/20">
                                <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
                                <div className="text-xs text-slate-400">已拒绝</div>
                            </div>
                        </div>
                    )}

                    {/* Filter Tabs */}
                    <div className="flex gap-2 mb-6">
                        {[
                            { value: "all", label: "全部" },
                            { value: "PENDING", label: "待处理" },
                            { value: "APPROVED", label: "已通过" },
                            { value: "REJECTED", label: "已拒绝" },
                        ].map((tab) => (
                            <button
                                key={tab.value}
                                onClick={() => setStatusFilter(tab.value)}
                                className={`px-4 py-2 rounded-xl text-sm transition-all ${statusFilter === tab.value
                                    ? "bg-purple-600 text-white"
                                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="glass rounded-2xl border border-white/10 overflow-hidden">
                        {loading ? (
                            <div className="p-6 space-y-4">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <Skeleton className="w-16 h-16 rounded-lg bg-white/10" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-1/3 bg-white/10" />
                                            <Skeleton className="h-3 w-1/4 bg-white/10" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : appeals.length === 0 ? (
                            <div className="p-12 text-center">
                                <AlertTriangle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                                <div className="text-slate-400">暂无申诉记录</div>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">用户</th>
                                        <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">原图</th>
                                        <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">类型</th>
                                        <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">生成结果</th>
                                        <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">申诉原因</th>
                                        <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">退款</th>
                                        <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">状态</th>
                                        <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">时间</th>
                                        <th className="text-left p-4 text-xs font-medium text-slate-400 uppercase">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence>
                                        {appeals.map((appeal) => (
                                            <motion.tr
                                                key={appeal.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="border-b border-white/5 hover:bg-white/5"
                                            >
                                                {/* User */}
                                                <td className="p-4">
                                                    <div className="text-sm text-white">{appeal.user.name || appeal.user.username || "用户"}</div>
                                                    <div className="text-xs text-slate-500">{appeal.user.email}</div>
                                                </td>

                                                {/* Original Image (User uploaded) */}
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        {appeal.generation.originalImage?.[0] ? (
                                                            <div
                                                                className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 cursor-pointer hover:ring-2 hover:ring-purple-500/50"
                                                                onClick={() => {
                                                                    setPreviewImages(appeal.generation.originalImage)
                                                                    setPreviewTitle(`原图 - ${appeal.generation.productName}`)
                                                                    setPreviewOpen(true)
                                                                }}
                                                            >
                                                                <img
                                                                    src={appeal.generation.originalImage[0]}
                                                                    alt="用户上传"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center">
                                                                <ImageIcon className="w-5 h-5 text-slate-600" />
                                                            </div>
                                                        )}
                                                        <span className="text-xs text-slate-500">
                                                            {appeal.generation.originalImage?.length || 0}张
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Product Type / Platform */}
                                                <td className="p-4">
                                                    <div className="text-sm text-white">
                                                        {appeal.generation.productTypeDescription || appeal.generation.productType || "-"}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {appeal.generation.hasUsedDiscountedRetry ? "优惠重试" : "正常生成"}
                                                    </div>
                                                </td>

                                                {/* Generated Result */}
                                                <td className="p-4">
                                                    <div
                                                        onClick={() => openPreview(appeal)}
                                                        className="flex items-center gap-3 cursor-pointer group"
                                                    >
                                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
                                                            {appeal.generation.generatedImages?.[0] ? (
                                                                <img
                                                                    src={appeal.generation.generatedImages[0]}
                                                                    alt=""
                                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <ImageIcon className="w-5 h-5 text-slate-600" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm text-white group-hover:text-purple-400 transition-colors truncate max-w-[120px]">
                                                                {appeal.generation.productName}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Reason */}
                                                <td className="p-4">
                                                    <div className="text-sm text-slate-300 max-w-[200px] line-clamp-2" title={appeal.reason}>
                                                        {appeal.reason}
                                                    </div>
                                                </td>

                                                {/* Refund */}
                                                <td className="p-4">
                                                    <span className="text-purple-400 font-semibold">{appeal.refundAmount}</span>
                                                    <span className="text-slate-500 text-xs ml-1">积分</span>
                                                </td>

                                                {/* Status */}
                                                <td className="p-4">
                                                    {statusBadge(appeal.status)}
                                                    {appeal.status === "REJECTED" && appeal.adminNote && (
                                                        <div className="text-xs text-slate-500 mt-1 truncate max-w-[120px]" title={appeal.adminNote}>
                                                            {appeal.adminNote}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Date */}
                                                <td className="p-4">
                                                    <div className="text-sm text-slate-400">
                                                        {new Date(appeal.createdAt).toLocaleDateString("zh-CN")}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {new Date(appeal.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="p-4">
                                                    {appeal.status === "PENDING" ? (
                                                        <div className="flex gap-2">
                                                            <Button
                                                                onClick={() => handleApprove(appeal)}
                                                                disabled={processing === appeal.id}
                                                                size="sm"
                                                                className="bg-green-600 hover:bg-green-700 text-white text-xs"
                                                            >
                                                                {processing === appeal.id ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                                        通过
                                                                    </>
                                                                )}
                                                            </Button>
                                                            <Button
                                                                onClick={() => openRejectDialog(appeal)}
                                                                disabled={processing === appeal.id}
                                                                size="sm"
                                                                variant="outline"
                                                                className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs"
                                                            >
                                                                <XCircle className="w-3 h-3 mr-1" />
                                                                拒绝
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-500">已处理</span>
                                                    )}
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Preview Dialog */}
                <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                    <DialogContent className="max-w-3xl bg-slate-950 border-white/10">
                        <DialogHeader>
                            <DialogTitle className="text-white">{previewTitle}</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-3 gap-2 mt-4">
                            {previewImages.map((img, i) => (
                                <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-800">
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Reject Dialog */}
                <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                    <DialogContent className="max-w-md bg-slate-950 border-white/10">
                        <DialogHeader>
                            <DialogTitle className="text-white">拒绝申诉</DialogTitle>
                        </DialogHeader>
                        <div className="mt-4 space-y-4">
                            <div>
                                <label className="text-sm text-slate-400 block mb-2">拒绝理由 *</label>
                                <textarea
                                    value={rejectNote}
                                    onChange={(e) => setRejectNote(e.target.value)}
                                    placeholder="请输入拒绝理由（至少5个字符）..."
                                    className="w-full h-24 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <Button
                                    onClick={() => setRejectOpen(false)}
                                    variant="outline"
                                    className="border-white/10 text-slate-400 hover:text-white"
                                >
                                    取消
                                </Button>
                                <Button
                                    onClick={handleReject}
                                    disabled={processing === rejectingAppeal?.id}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    {processing === rejectingAppeal?.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : null}
                                    确认拒绝
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    )
}

