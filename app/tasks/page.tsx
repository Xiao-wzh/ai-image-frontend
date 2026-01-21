"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ListTodo, RefreshCw, Search, ChevronLeft, ChevronRight, Filter } from "lucide-react"

import { Sidebar } from "@/components/sidebar"
import { TopBanner } from "@/components/top-banner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TaskItem } from "@/components/task-item"
import { HistoryDetailDialog } from "@/components/history-detail-dialog"
import type { HistoryItem } from "@/components/history-card"

type StatusFilter = "all" | "pending" | "completed" | "failed"

export default function TasksPage() {
    const [items, setItems] = useState<HistoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)

    const limit = 10
    const POLL_INTERVAL_MS = 3000

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery)
            setPage(1) // Reset to first page on search
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const fetchPage = useCallback(async (pageNum: number, query: string) => {
        const params = new URLSearchParams()
        params.set("limit", String(limit))
        params.set("offset", String((pageNum - 1) * limit))
        if (query) {
            params.set("query", query)
        }

        const res = await fetch(`/api/history?${params.toString()}`)
        if (!res.ok) {
            throw new Error(`请求失败: ${res.status}`)
        }
        const data = await res.json()
        const newItems = (data.items ?? []) as HistoryItem[]

        setItems(newItems)
        setTotal(data?.page?.total ?? 0)
    }, [])

    // Fetch when page or search changes
    useEffect(() => {
        let cancelled = false
            ; (async () => {
                setLoading(true)
                try {
                    await fetchPage(page, debouncedQuery)
                } finally {
                    if (!cancelled) setLoading(false)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [page, debouncedQuery, fetchPage])

    // Auto-refresh when PENDING or PROCESSING items exist
    useEffect(() => {
        const hasPendingOrProcessing = items.some((x) => {
            const s = String(x.status || "").toUpperCase()
            return s === "PENDING" || s === "PROCESSING"
        })
        if (!hasPendingOrProcessing) return

        let cancelled = false
        let timer: any

        const tick = async () => {
            if (cancelled) return
            try {
                await fetchPage(page, debouncedQuery)
            } catch {
                // ignore
            } finally {
                if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS)
            }
        }

        timer = setTimeout(tick, POLL_INTERVAL_MS)
        return () => {
            cancelled = true
            if (timer) clearTimeout(timer)
        }
    }, [items, page, debouncedQuery, fetchPage])

    const handleRefresh = () => {
        fetchPage(page, debouncedQuery)
    }

    // Filter items by status (client-side for immediate feedback)
    const filteredItems = useMemo(() => {
        if (statusFilter === "all") return items
        return items.filter((item) => {
            const s = String(item.status || "").toUpperCase()
            if (statusFilter === "pending") return s === "PENDING" || s === "PROCESSING"
            if (statusFilter === "completed") return s === "COMPLETED"
            if (statusFilter === "failed") return s === "FAILED"
            return true
        })
    }, [items, statusFilter])

    const totalPages = Math.ceil(total / limit) || 1
    const empty = !loading && items.length === 0
    const pendingCount = items.filter((x) => {
        const s = String(x.status || "").toUpperCase()
        return s === "PENDING" || s === "PROCESSING"
    }).length

    const statusOptions: { value: StatusFilter; label: string }[] = [
        { value: "all", label: "全部" },
        { value: "pending", label: "进行中" },
        { value: "completed", label: "已完成" },
        { value: "failed", label: "失败" },
    ]

    return (
        <div className="flex h-screen bg-slate-950">
            <Sidebar />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <TopBanner />
                <main className="flex-1 overflow-y-auto min-w-0">
                    <div className="relative pt-10 pb-8 px-8 min-w-0">
                        {/* Aurora gradient background */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute -top-10 left-1/4 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl" />
                            <div className="absolute top-10 right-1/4 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl" />
                        </div>

                        <div className="relative max-w-4xl mx-auto min-w-0">
                            {/* Header */}
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 min-w-0">
                                <div className="min-w-0">
                                    <h1 className="text-3xl md:text-4xl font-bold text-white">任务队列</h1>
                                    <p className="text-slate-400 mt-2 text-sm">
                                        查看所有生成任务的状态，包括进行中、已完成和失败的任务。
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    {pendingCount > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-yellow-400">
                                            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                                            <span>{pendingCount} 个任务进行中</span>
                                        </div>
                                    )}
                                    <Button
                                        onClick={handleRefresh}
                                        variant="outline"
                                        size="sm"
                                        className="border-white/10 bg-white/5 hover:bg-white/10 text-white gap-2"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        刷新
                                    </Button>
                                </div>
                            </div>

                            {/* Search and Filter Bar */}
                            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                {/* Search Input */}
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="搜索产品名称..."
                                        className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                                    />
                                </div>

                                {/* Status Filter */}
                                {/* <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-slate-400" />
                                    <div className="flex rounded-xl overflow-hidden border border-white/10 bg-slate-900/60">
                                        {statusOptions.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setStatusFilter(opt.value)}
                                                className={`px-3 py-2 text-sm transition-all ${statusFilter === opt.value
                                                        ? "bg-purple-600 text-white"
                                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div> */}
                            </div>

                            {/* Task List */}
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-slate-900/40"
                                        >
                                            <Skeleton className="w-20 h-20 rounded-xl bg-white/10" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-1/3 bg-white/10" />
                                                <Skeleton className="h-3 w-1/4 bg-white/10" />
                                            </div>
                                            <div className="flex gap-2">
                                                <Skeleton className="h-8 w-20 bg-white/10 rounded-lg" />
                                                <Skeleton className="h-8 w-24 bg-white/10 rounded-lg" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : empty ? (
                                <div className="glass rounded-3xl p-10 border border-white/10 text-center">
                                    <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                                        <ListTodo className="w-7 h-7 text-purple-300" />
                                    </div>
                                    <div className="text-white font-semibold text-lg">
                                        {debouncedQuery ? "没有找到匹配的任务" : "暂无任务"}
                                    </div>
                                    <div className="text-slate-400 text-sm mt-2">
                                        {debouncedQuery ? "尝试其他搜索关键词" : "去首页生成一张九宫格作品吧。"}
                                    </div>
                                    {!debouncedQuery && (
                                        <div className="mt-6">
                                            <Button
                                                asChild
                                                className="rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white"
                                            >
                                                <a href="/">去生成</a>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : filteredItems.length === 0 ? (
                                <div className="glass rounded-3xl p-10 border border-white/10 text-center">
                                    <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                                        <Filter className="w-7 h-7 text-purple-300" />
                                    </div>
                                    <div className="text-white font-semibold text-lg">没有符合筛选条件的任务</div>
                                    <div className="text-slate-400 text-sm mt-2">
                                        当前页面没有"{statusOptions.find((o) => o.value === statusFilter)?.label}"状态的任务
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        <AnimatePresence mode="popLayout">
                                            {filteredItems.map((item, idx) => (
                                                <TaskItem
                                                    key={item.id}
                                                    item={item}
                                                    onViewDetails={() => {
                                                        setActiveIndex(items.findIndex((i) => i.id === item.id))
                                                        setOpen(true)
                                                    }}
                                                    onRegenerateSuccess={handleRefresh}
                                                />
                                            ))}
                                        </AnimatePresence>
                                    </div>

                                    {/* Pagination */}
                                    <div className="flex items-center justify-between mt-8">
                                        <div className="text-sm text-slate-400">
                                            共 {total} 条记录，第 {page}/{totalPages} 页
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                                disabled={page <= 1}
                                                variant="outline"
                                                size="sm"
                                                className="border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-50"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                上一页
                                            </Button>

                                            {/* Page numbers */}
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                    let pageNum: number
                                                    if (totalPages <= 5) {
                                                        pageNum = i + 1
                                                    } else if (page <= 3) {
                                                        pageNum = i + 1
                                                    } else if (page >= totalPages - 2) {
                                                        pageNum = totalPages - 4 + i
                                                    } else {
                                                        pageNum = page - 2 + i
                                                    }
                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => setPage(pageNum)}
                                                            className={`w-8 h-8 rounded-lg text-sm transition-all ${page === pageNum
                                                                ? "bg-purple-600 text-white"
                                                                : "text-slate-400 hover:bg-white/10 hover:text-white"
                                                                }`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            <Button
                                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                                disabled={page >= totalPages}
                                                variant="outline"
                                                size="sm"
                                                className="border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-50"
                                            >
                                                下一页
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            <HistoryDetailDialog
                open={open}
                onOpenChange={setOpen}
                items={items}
                initialIndex={activeIndex}
                onGenerateSuccess={handleRefresh}
            />
        </div>
    )
}
