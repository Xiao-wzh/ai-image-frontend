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
    Loader2,
    Crown,
    Eye,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Sparkles,
    Bot,
    FileText,
    Users,
    AlertCircle,
    Search,
    Calendar,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Sidebar } from "@/components/sidebar"
import { ProductTypeLabel } from "@/lib/constants"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { AppealComparisonModal } from "@/components/admin/appeal-comparison-modal"
import { getThumbnailUrl } from "@/lib/cdnUrl"
import { LazyImage } from "@/components/lazy-image"

type Appeal = {
    id: string
    userId: string
    generationId: string
    reason: string
    status: "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" | "PENDING_MANUAL_REVIEW"
    refundAmount: number
    adminNote: string | null
    appealedImages: string[]  // 新增：申诉的具体图片
    // AI 审核相关字段
    aiConfidence: number | null
    aiAnalysis: string | null
    userMessage: string | null  // AI 给用户的简短提示
    reviewedBy: string | null
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
        outputLanguage?: string | null
        qualityMode?: string | null      // PRO / STANDARD
        imageCount?: number | null       // PRO: 期望张数
        costPerImage?: number | null     // PRO: 单张成本快照
        totalCost?: number | null        // 总费用
        refundAmount?: number | null     // 已退款金额
        generatedImages: string[]
        generatedImage: string | null
        originalImage: string[]
        refImages: string[]
        mode: string  // CREATIVE / CLONE
        hasUsedDiscountedRetry: boolean
        createdAt: string
    }
}

type Stats = {
    pending: number
    processing: number
    manualReview: number  // API 返回 manualReview
    approved: number
    rejected: number
    total: number
}

type TodayStats = {
    total: number
    approved: number
    rejected: number
    approvedRefund: number
}

export default function AdminAppealsPage() {
    const router = useRouter()
    const [appeals, setAppeals] = useState<Appeal[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [todayStats, setTodayStats] = useState<TodayStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>("all")

    // 搜索
    const [searchKeyword, setSearchKeyword] = useState("")
    const [searchInput, setSearchInput] = useState("") // 输入框的值

    // 分页
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [jumpPage, setJumpPage] = useState("") // 跳转页码输入
    const limit = 10

    // Comparison modal
    const [comparisonOpen, setComparisonOpen] = useState(false)
    const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null)

    // Preview dialog
    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewImages, setPreviewImages] = useState<string[]>([])
    const [previewTitle, setPreviewTitle] = useState("")

    // Reject dialog
    const [rejectOpen, setRejectOpen] = useState(false)
    const [rejectingAppeal, setRejectingAppeal] = useState<Appeal | null>(null)
    const [rejectNote, setRejectNote] = useState("")
    const [processing, setProcessing] = useState<string | null>(null)

    // Approve dialog
    const [approveOpen, setApproveOpen] = useState(false)
    const [approvingAppeal, setApprovingAppeal] = useState<Appeal | null>(null)
    const [approveNote, setApproveNote] = useState("")

    const fetchAppeals = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.set("limit", String(limit))
            params.set("offset", String((page - 1) * limit))
            if (statusFilter !== "all") params.set("status", statusFilter)
            if (searchKeyword) params.set("search", searchKeyword)

            const res = await fetch(`/api/admin/appeals?${params.toString()}`)
            if (!res.ok) throw new Error("获取失败")

            const data = await res.json()
            setAppeals(data.appeals || [])
            setStats(data.stats || null)
            setTodayStats(data.todayStats || null)
            setTotal(data.page?.total || 0)
            setTotalPages(Math.ceil((data.page?.total || 0) / limit))
        } catch (err) {
            toast.error("获取申诉列表失败")
        } finally {
            setLoading(false)
        }
    }, [statusFilter, page, searchKeyword])

    useEffect(() => {
        fetchAppeals()
    }, [fetchAppeals])

    // 搜索处理
    const handleSearch = () => {
        setSearchKeyword(searchInput.trim())
        setPage(1) // 搜索时重置到第一页
    }

    // 页码跳转处理
    const handleJumpPage = () => {
        const pageNum = parseInt(jumpPage, 10)
        if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
            toast.error(`请输入 1-${totalPages} 之间的页码`)
            return
        }
        setPage(pageNum)
        setJumpPage("")
    }

    // 触发 AI 审核
    const handleTriggerAiReview = async (appealId: string) => {
        const res = await fetch("/api/admin/appeals/trigger-ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appealId }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "操作失败")

        // 只更新单条记录的状态，保持滚动位置
        setAppeals(prev => prev.map(a =>
            a.id === appealId ? { ...a, status: "PROCESSING" } : a
        ))
    }

    const handleApprove = async () => {
        if (!approvingAppeal) return

        setProcessing(approvingAppeal.id)
        try {
            const res = await fetch("/api/admin/appeals/resolve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    appealId: approvingAppeal.id,
                    action: "APPROVE",
                    adminNote: approveNote.trim() || undefined,
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "操作失败")

            toast.success(`申诉已通过，已退还 ${data.refundAmount} 积分`)
            setApproveOpen(false)
            setApprovingAppeal(null)
            setApproveNote("")
            fetchAppeals()
        } catch (err: any) {
            toast.error(err.message || "操作失败")
        } finally {
            setProcessing(null)
        }
    }

    // 计算预估退款金额
    const calculateEstimatedRefund = (appeal: Appeal) => {
        const generation = appeal.generation

        if (appeal.appealedImages && appeal.appealedImages.length > 0) {
            // PRO 模式：使用用户选择的张数（imageCount）
            // STANDARD 模式：使用实际生成张数（generatedImages.length），最少 9 张
            const totalImages = generation.qualityMode === "STANDARD"
                ? Math.max(generation.generatedImages.length, 9)
                : (generation.imageCount || 9)
            const perImageRefund = Math.floor((generation.totalCost || 0) / totalImages)
            return perImageRefund * appeal.appealedImages.length
        } else {
            // 旧数据：退还剩余扣费
            return (generation.totalCost || 0) - (generation.refundAmount || 0)
        }
    }

    const openApproveDialog = (appeal: Appeal) => {
        setApprovingAppeal(appeal)
        setApproveNote("")
        setApproveOpen(true)
    }

    const handleReject = async () => {
        if (!rejectingAppeal) return
        if (rejectNote.trim().length < 3) {
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

    const statusBadge = (status: string, aiConfidence?: number | null) => {
        switch (status) {
            case "PENDING":
                return (
                    <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                            <Clock className="w-3.5 h-3.5" />
                            待处理
                        </span>
                    </div>
                )
            case "PROCESSING":
                return (
                    <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            AI 审核中
                        </span>
                    </div>
                )
            case "PENDING_MANUAL_REVIEW":
                return (
                    <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30">
                            <AlertCircle className="w-3.5 h-3.5" />
                            待人工审核
                        </span>
                        {aiConfidence !== null && aiConfidence !== undefined && (
                            <span className="text-[10px] text-orange-300/70">
                                AI 置信度 {Math.round(aiConfidence * 100)}%
                            </span>
                        )}
                    </div>
                )
            case "APPROVED":
                return (
                    <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/30">
                            <CheckCircle className="w-3.5 h-3.5" />
                            已通过
                        </span>
                    </div>
                )
            case "REJECTED":
                return (
                    <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                            <XCircle className="w-3.5 h-3.5" />
                            已拒绝
                        </span>
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <div className="flex h-screen bg-slate-950">
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
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                            <div className="glass rounded-xl p-5 border border-white/10 hover:border-white/20 transition-colors group">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-3xl font-bold text-white">{stats.total}</div>
                                        <div className="text-sm text-slate-400 mt-1">总申诉</div>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <FileText className="w-6 h-6 text-slate-300" />
                                    </div>
                                </div>
                            </div>
                            <div className="glass rounded-xl p-5 border border-blue-500/20 hover:border-blue-500/40 transition-colors group">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-3xl font-bold text-blue-400">{stats.processing || 0}</div>
                                        <div className="text-sm text-slate-400 mt-1">AI 审核中</div>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                                    </div>
                                </div>
                            </div>
                            <div className="glass rounded-xl p-5 border border-orange-500/20 hover:border-orange-500/40 transition-colors group">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-3xl font-bold text-orange-400">{stats.manualReview || 0}</div>
                                        <div className="text-sm text-slate-400 mt-1">待人工审核</div>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <AlertCircle className="w-6 h-6 text-orange-400" />
                                    </div>
                                </div>
                            </div>
                            <div className="glass rounded-xl p-5 border border-green-500/20 hover:border-green-500/40 transition-colors group">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-3xl font-bold text-green-400">{stats.approved}</div>
                                        <div className="text-sm text-slate-400 mt-1">已通过</div>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <CheckCircle className="w-6 h-6 text-green-400" />
                                    </div>
                                </div>
                            </div>
                            <div className="glass rounded-xl p-5 border border-red-500/20 hover:border-red-500/40 transition-colors group">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-3xl font-bold text-red-400">{stats.rejected}</div>
                                        <div className="text-sm text-slate-400 mt-1">已拒绝</div>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <XCircle className="w-6 h-6 text-red-400" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 今日统计 */}
                    {todayStats && (
                        <div className="mb-6 p-4 rounded-xl border border-white/10 bg-gradient-to-r from-slate-900/80 to-slate-800/40">
                            <div className="flex items-center gap-2 mb-3">
                                <Calendar className="w-4 h-4 text-purple-400" />
                                <span className="text-sm font-medium text-white">今日申诉统计</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-slate-300" />
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-white">{todayStats.total}</div>
                                        <div className="text-xs text-slate-400">今日申诉</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-green-400">{todayStats.approved}</div>
                                        <div className="text-xs text-slate-400">今日通过</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                                        <XCircle className="w-5 h-5 text-red-400" />
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-red-400">{todayStats.rejected}</div>
                                        <div className="text-xs text-slate-400">今日拒绝</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                        <RefreshCw className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-purple-400">{todayStats.approvedRefund}</div>
                                        <div className="text-xs text-slate-400">今日退款积分</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filter Tabs */}
                    <div className="flex gap-2 mb-4 flex-wrap">
                        {[
                            { value: "all", label: "全部", color: "purple" },
                            { value: "PENDING", label: "待处理", color: "yellow" },
                            { value: "PROCESSING", label: "AI 审核中", color: "blue" },
                            { value: "PENDING_MANUAL_REVIEW", label: "待人工", color: "orange" },
                            { value: "APPROVED", label: "已通过", color: "green" },
                            { value: "REJECTED", label: "已拒绝", color: "red" },
                        ].map((tab) => (
                            <button
                                key={tab.value}
                                onClick={() => {
                                    setStatusFilter(tab.value)
                                    setPage(1)
                                }}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                    statusFilter === tab.value
                                        ? tab.color === "purple" ? "bg-purple-600 text-white shadow-lg shadow-purple-500/25"
                                            : tab.color === "yellow" ? "bg-yellow-500/90 text-black shadow-lg shadow-yellow-500/25"
                                            : tab.color === "blue" ? "bg-blue-500/90 text-white shadow-lg shadow-blue-500/25"
                                            : tab.color === "orange" ? "bg-orange-500/90 text-white shadow-lg shadow-orange-500/25"
                                            : tab.color === "green" ? "bg-green-500/90 text-white shadow-lg shadow-green-500/25"
                                            : "bg-red-500/90 text-white shadow-lg shadow-red-500/25"
                                        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* 搜索框 */}
                    <div className="flex gap-2 mb-6">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="搜索用户名/邮箱/商品名..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-purple-500/50"
                            />
                        </div>
                        <Button
                            onClick={handleSearch}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            搜索
                        </Button>
                        {searchKeyword && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSearchInput("")
                                    setSearchKeyword("")
                                    setPage(1)
                                }}
                                className="bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                            >
                                清除
                            </Button>
                        )}
                    </div>

                    {/* Appeals Cards */}
                    <div className="space-y-4">
                        {loading ? (
                            <div className="space-y-4">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="glass rounded-2xl border border-white/10 p-5">
                                        <div className="flex gap-4">
                                            <Skeleton className="w-24 h-24 rounded-xl bg-white/10" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-1/3 bg-white/10" />
                                                <Skeleton className="h-3 w-1/2 bg-white/10" />
                                                <Skeleton className="h-3 w-1/4 bg-white/10" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : appeals.length === 0 ? (
                            <div className="glass rounded-2xl border border-white/10 p-12 text-center">
                                <AlertTriangle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                                <div className="text-slate-400">暂无申诉记录</div>
                            </div>
                        ) : (
                            <>
                                <AnimatePresence>
                                    {appeals.map((appeal) => (
                                        <motion.div
                                            key={appeal.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className="glass rounded-2xl border border-white/10 hover:border-white/20 transition-all overflow-hidden"
                                        >
                                            <div className="p-5">
                                                {/* 顶部：状态 + 时间 */}
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        {statusBadge(appeal.status, appeal.aiConfidence)}
                                                        {appeal.generation.qualityMode === "PRO" && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-xs text-white font-bold">
                                                                <Crown className="w-3 h-3" />
                                                                PRO
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {new Date(appeal.createdAt).toLocaleDateString("zh-CN")} {new Date(appeal.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                                                    </div>
                                                </div>

                                                {/* 主内容区：三列布局 */}
                                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                                    {/* 左侧：图片对比 */}
                                                    <div className="lg:col-span-4 flex gap-3">
                                                        {/* 原图/参考图 */}
                                                        <div className="flex flex-col gap-2">
                                                            <div className="text-xs text-slate-500 mb-1">原图</div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {appeal.generation.originalImage?.slice(0, 2).map((url, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="w-16 h-16 rounded-lg overflow-hidden bg-slate-800 cursor-pointer hover:ring-2 hover:ring-purple-500/50 transition-all hover:scale-105"
                                                                        onClick={() => {
                                                                            setPreviewImages(appeal.generation.originalImage)
                                                                            setPreviewTitle(`原图 - ${appeal.generation.productName}`)
                                                                            setPreviewOpen(true)
                                                                        }}
                                                                    >
                                                                        <LazyImage
                                                                            src={getThumbnailUrl(url, 200) ?? url}
                                                                            alt={`原图 ${idx + 1}`}
                                                                            className="object-cover w-full h-full"
                                                                        />
                                                                    </div>
                                                                ))}
                                                                {(appeal.generation.originalImage?.length || 0) > 2 && (
                                                                    <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                                                                        +{(appeal.generation.originalImage?.length || 0) - 2}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {/* 参考图 */}
                                                            {appeal.generation.refImages && appeal.generation.refImages.length > 0 && (
                                                                <div className="mt-2">
                                                                    <div className="text-xs text-blue-400 mb-1">参考图</div>
                                                                    <div
                                                                        className="w-16 h-16 rounded-lg overflow-hidden bg-blue-900/30 cursor-pointer hover:ring-2 hover:ring-blue-500/50 border border-blue-500/30"
                                                                        onClick={() => {
                                                                            setPreviewImages(appeal.generation.refImages)
                                                                            setPreviewTitle(`参考图 - ${appeal.generation.productName}`)
                                                                            setPreviewOpen(true)
                                                                        }}
                                                                    >
                                                                        <LazyImage
                                                                            src={getThumbnailUrl(appeal.generation.refImages[0], 200) ?? appeal.generation.refImages[0]}
                                                                            alt="参考图"
                                                                            className="object-cover w-full h-full"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* 箭头 */}
                                                        <div className="flex items-center text-slate-600">
                                                            <ChevronRight className="w-5 h-5" />
                                                        </div>

                                                        {/* 生成图/申诉图 */}
                                                        <div className="flex flex-col gap-2">
                                                            <div className="text-xs text-slate-500 mb-1">生成结果</div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {appeal.generation.generatedImages?.slice(0, 2).map((url, idx) => {
                                                                    const isAppealed = appeal.appealedImages?.includes(url)
                                                                    return (
                                                                        <div
                                                                            key={idx}
                                                                            className={`relative w-16 h-16 rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 ${
                                                                                isAppealed
                                                                                    ? "ring-2 ring-orange-500 shadow-lg shadow-orange-500/20"
                                                                                    : "bg-slate-800 hover:ring-2 hover:ring-white/30"
                                                                            }`}
                                                                            onClick={() => {
                                                                                setPreviewImages(appeal.generation.generatedImages)
                                                                                setPreviewTitle(`生成结果 - ${appeal.generation.productName}`)
                                                                                setPreviewOpen(true)
                                                                            }}
                                                                        >
                                                                            <LazyImage
                                                                                src={getThumbnailUrl(url, 200) ?? url}
                                                                                alt={`生成 ${idx + 1}`}
                                                                                className="object-cover w-full h-full"
                                                                            />
                                                                            {isAppealed && (
                                                                                <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center pointer-events-none">
                                                                                    <span className="text-[8px] text-orange-300 bg-black/60 px-1 rounded">申诉</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )
                                                                })}
                                                                {(appeal.generation.generatedImages?.length || 0) > 2 && (
                                                                    <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                                                                        +{(appeal.generation.generatedImages?.length || 0) - 2}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 中间：信息 */}
                                                    <div className="lg:col-span-5 flex flex-col gap-3">
                                                        {/* 用户信息 */}
                                                        <div className="flex items-center gap-2">
                                                            <Users className="w-4 h-4 text-slate-500" />
                                                            <span className="text-sm text-white">{appeal.user.name || appeal.user.username || "用户"}</span>
                                                            <span className="text-xs text-slate-500">{appeal.user.email}</span>
                                                        </div>

                                                        {/* 商品信息 */}
                                                        <div>
                                                            <div className="text-sm text-white font-medium truncate" title={appeal.generation.productName}>
                                                                {appeal.generation.productName}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-xs text-slate-400">
                                                                    {appeal.generation.productTypeDescription || (ProductTypeLabel as any)[appeal.generation.productType] || appeal.generation.productType}
                                                                </span>
                                                                <span className="text-xs text-slate-600">•</span>
                                                                <span className="text-xs text-slate-400">{appeal.generation.outputLanguage || "中文"}</span>
                                                            </div>
                                                        </div>

                                                        {/* 申诉原因 */}
                                                        {appeal.reason && (
                                                            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                                                <div className="text-xs text-slate-500 mb-1">申诉原因</div>
                                                                <div className="text-sm text-slate-300 line-clamp-2" title={appeal.reason}>
                                                                    {appeal.reason}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* AI 分析结果 */}
                                                        {appeal.aiAnalysis && (
                                                            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-3 border border-blue-500/20">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Bot className="w-4 h-4 text-blue-400" />
                                                                    <span className="text-xs text-blue-400 font-medium">AI 诊断</span>
                                                                    {appeal.aiConfidence !== null && (
                                                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                                                            appeal.aiConfidence > 0.85
                                                                                ? "bg-green-500/20 text-green-400"
                                                                                : "bg-yellow-500/20 text-yellow-400"
                                                                        }`}>
                                                                            {Math.round(appeal.aiConfidence * 100)}% 置信度
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-slate-300 line-clamp-2" title={appeal.aiAnalysis}>
                                                                    {appeal.aiAnalysis}
                                                                </p>
                                                                {/* 给用户的提示 */}
                                                                {appeal.userMessage && (
                                                                    <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                                                                        <span className="font-medium">用户提示:</span>
                                                                        <span>{appeal.userMessage}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* 退款金额 */}
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-500">退款:</span>
                                                            <span className="text-purple-400 font-semibold">{appeal.refundAmount}</span>
                                                            <span className="text-xs text-slate-500">积分</span>
                                                        </div>
                                                    </div>

                                                    {/* 右侧：操作 */}
                                                    <div className="lg:col-span-3 flex flex-col gap-2">
                                                        {/* 第一行：对比 + AI审核 */}
                                                        <div className="flex gap-2">
                                                            <Button
                                                                onClick={() => {
                                                                    setSelectedAppeal(appeal)
                                                                    setComparisonOpen(true)
                                                                }}
                                                                size="sm"
                                                                variant="outline"
                                                                className="flex-1 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                                                            >
                                                                <Eye className="w-4 h-4 mr-1" />
                                                                对比审核
                                                            </Button>
                                                        </div>

                                                        {/* AI 审核按钮 / 重新审核 */}
                                                        {(appeal.status === "PENDING" || appeal.status === "PENDING_MANUAL_REVIEW" || appeal.status === "PROCESSING") && (
                                                            <Button
                                                                onClick={async () => {
                                                                    if (processing === appeal.id) return
                                                                    setProcessing(appeal.id)
                                                                    try {
                                                                        const res = await fetch("/api/admin/appeals/trigger-ai", {
                                                                            method: "POST",
                                                                            headers: { "Content-Type": "application/json" },
                                                                            body: JSON.stringify({ appealId: appeal.id }),
                                                                        })
                                                                        const data = await res.json()
                                                                        if (!res.ok) throw new Error(data.error || "操作失败")
                                                                        toast.success(appeal.status === "PROCESSING" ? "已重新提交 AI 审核" : "AI 审核已触发")
                                                                        // 只更新单条记录的状态，保持滚动位置
                                                                        setAppeals(prev => prev.map(a =>
                                                                            a.id === appeal.id ? { ...a, status: "PROCESSING" } : a
                                                                        ))
                                                                    } catch (err: any) {
                                                                        toast.error(err.message || "操作失败")
                                                                    } finally {
                                                                        setProcessing(null)
                                                                    }
                                                                }}
                                                                disabled={processing === appeal.id}
                                                                size="sm"
                                                                variant="outline"
                                                                className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                                                            >
                                                                {processing === appeal.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                                                ) : (
                                                                    <RefreshCw className="w-4 h-4 mr-1" />
                                                                )}
                                                                {appeal.status === "PROCESSING" ? "重新 AI 审核" : "AI 审核"}
                                                            </Button>
                                                        )}

                                                        {/* 分隔线 */}
                                                        {(appeal.status === "PENDING" || appeal.status === "PENDING_MANUAL_REVIEW" || appeal.status === "PROCESSING") && (
                                                            <div className="border-t border-white/10 my-1" />
                                                        )}

                                                        {/* 第二行：通过 + 拒绝 */}
                                                        {(appeal.status === "PENDING" || appeal.status === "PENDING_MANUAL_REVIEW" || appeal.status === "PROCESSING") && (
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <Button
                                                                    onClick={() => openApproveDialog(appeal)}
                                                                    disabled={processing === appeal.id}
                                                                    size="sm"
                                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                                >
                                                                    {processing === appeal.id ? (
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                    ) : (
                                                                        <>
                                                                            <CheckCircle className="w-4 h-4 mr-1" />
                                                                            通过
                                                                        </>
                                                                    )}
                                                                </Button>
                                                                <Button
                                                                    onClick={() => openRejectDialog(appeal)}
                                                                    disabled={processing === appeal.id}
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                                                >
                                                                    <XCircle className="w-4 h-4 mr-1" />
                                                                    拒绝
                                                                </Button>
                                                            </div>
                                                        )}

                                                        {/* 已完成状态 */}
                                                        {appeal.status === "APPROVED" && (
                                                            <div className="flex items-center justify-center gap-2 text-sm text-green-400 py-2 bg-green-500/10 rounded-lg">
                                                                <CheckCircle className="w-4 h-4" />
                                                                已通过
                                                            </div>
                                                        )}
                                                        {appeal.status === "REJECTED" && (
                                                            <div className="flex items-center justify-center gap-2 text-sm text-red-400 py-2 bg-red-500/10 rounded-lg">
                                                                <XCircle className="w-4 h-4" />
                                                                已拒绝
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {/* 分页 */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between p-4 glass rounded-xl border border-white/10">
                                        <div className="text-sm text-slate-400">
                                            共 {total} 条 · 第 {page} / {totalPages} 页
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* 页码跳转 */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-slate-400">跳转至</span>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={totalPages}
                                                    value={jumpPage}
                                                    onChange={(e) => setJumpPage(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && handleJumpPage()}
                                                    className="w-16 h-8 text-center bg-white/5 border-white/10 text-white text-sm"
                                                />
                                                <span className="text-sm text-slate-400">页</span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleJumpPage}
                                                    className="h-8 bg-white/5 border-white/10 text-white hover:bg-white/10"
                                                >
                                                    跳转
                                                </Button>
                                            </div>
                                            {/* 上一页/下一页 */}
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={page <= 1}
                                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                                    className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={page >= totalPages}
                                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                    className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
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
                                    <LazyImage src={getThumbnailUrl(img, 400) ?? img} alt="" className="object-cover" />
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

                {/* Approve Dialog */}
                <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
                    <DialogContent className="max-w-md bg-slate-950 border-white/10">
                        <DialogHeader>
                            <DialogTitle className="text-white">通过申诉</DialogTitle>
                        </DialogHeader>
                        <div className="mt-4 space-y-4">
                            {approvingAppeal && (
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-green-400 mb-2">
                                        <CheckCircle className="w-5 h-5" />
                                        <span className="font-semibold">预估退款</span>
                                    </div>
                                    <div className="text-2xl font-bold text-green-400">
                                        {calculateEstimatedRefund(approvingAppeal)} 积分
                                    </div>
                                    {approvingAppeal.appealedImages?.length > 0 && (
                                        <div className="text-sm text-slate-400 mt-1">
                                            申诉 {approvingAppeal.appealedImages.length} 张图片
                                        </div>
                                    )}
                                    <div className="text-xs text-slate-500 mt-2">
                                        退款给用户: {approvingAppeal.user.email}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="text-sm text-slate-400 block mb-2">备注（可选）</label>
                                <textarea
                                    value={approveNote}
                                    onChange={(e) => setApproveNote(e.target.value)}
                                    placeholder="可填写审核备注..."
                                    className="w-full h-20 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 resize-none"
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <Button
                                    onClick={() => setApproveOpen(false)}
                                    variant="outline"
                                    className="border-white/10 text-slate-400 hover:text-white"
                                >
                                    取消
                                </Button>
                                <Button
                                    onClick={handleApprove}
                                    disabled={processing === approvingAppeal?.id}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    {processing === approvingAppeal?.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : null}
                                    确认通过
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Appeal Comparison Modal */}
                <AppealComparisonModal
                    open={comparisonOpen}
                    onOpenChange={setComparisonOpen}
                    appeal={selectedAppeal}
                    onTriggerAi={handleTriggerAiReview}
                />
            </main>
        </div>
    )
}


