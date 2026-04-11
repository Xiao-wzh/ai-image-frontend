"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ListTodo, RefreshCw, Search, ChevronLeft, ChevronRight, Filter, Image as ImageIcon, Video } from "lucide-react"

import { Sidebar } from "@/components/sidebar"
import { TopBanner } from "@/components/top-banner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TaskItem } from "@/components/task-item"
import { VideoTaskItem } from "@/components/video-task-item"
import { HistoryDetailDialog } from "@/components/history-detail-dialog"
import { VideoDetailDialog } from "@/components/video-detail-dialog"
import type { HistoryItem } from "@/components/history-card"
import type { VideoHistoryItem } from "@/components/video-history-card"

type StatusFilter = "all" | "pending" | "completed" | "failed"
type TabType = "image" | "video"

export default function TasksPage() {
    const [tab, setTab] = useState<TabType>("image")

    // 图片状态
    const [items, setItems] = useState<HistoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

    // 图片详情弹窗
    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)

    // 视频状态
    const [videoItems, setVideoItems] = useState<VideoHistoryItem[]>([])
    const [videoLoading, setVideoLoading] = useState(true)
    const [videoTotal, setVideoTotal] = useState(0)
    const [videoPage, setVideoPage] = useState(1)

    // 视频详情弹窗
    const [videoDetailOpen, setVideoDetailOpen] = useState(false)
    const [activeVideoItem, setActiveVideoItem] = useState<VideoHistoryItem | null>(null)

    const limit = 10
    const POLL_INTERVAL_MS = 6000

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery)
            setPage(1)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    // Tab 切换时重置分页
    useEffect(() => {
        setPage(1)
        setVideoPage(1)
    }, [tab])

    // ── 图片数据获取 ──
    const fetchPage = useCallback(async (pageNum: number, query: string) => {
        const params = new URLSearchParams()
        params.set("type", "image")
        params.set("limit", String(limit))
        params.set("offset", String((pageNum - 1) * limit))
        if (query) params.set("query", query)

        const res = await fetch(`/api/history?${params.toString()}`)
        if (!res.ok) throw new Error(`请求失败: ${res.status}`)
        const data = await res.json()
        setItems((data.items ?? []) as HistoryItem[])
        setTotal(data?.page?.total ?? 0)
    }, [])

    // ── 视频数据获取 ──
    const fetchVideoPage = useCallback(async (pageNum: number) => {
        const params = new URLSearchParams()
        params.set("type", "video")
        params.set("limit", String(limit))
        params.set("offset", String((pageNum - 1) * limit))

        const res = await fetch(`/api/history?${params.toString()}`)
        if (!res.ok) throw new Error(`请求失败: ${res.status}`)
        const data = await res.json()
        setVideoItems((data.items ?? []) as VideoHistoryItem[])
        setVideoTotal(data?.page?.total ?? 0)
    }, [])

    // 图片数据获取
    useEffect(() => {
        if (tab !== "image") return
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                await fetchPage(page, debouncedQuery)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [tab, page, debouncedQuery, fetchPage])

    // 视频数据获取
    useEffect(() => {
        if (tab !== "video") return
        let cancelled = false
        ;(async () => {
            setVideoLoading(true)
            try {
                await fetchVideoPage(videoPage)
            } finally {
                if (!cancelled) setVideoLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [tab, videoPage, fetchVideoPage])

    // 图片自动刷新
    useEffect(() => {
        if (tab !== "image") return
        const hasPendingOrProcessing = items.some((x) => {
            const s = String(x.status || "").toUpperCase()
            return s === "PENDING" || s === "PROCESSING"
        })
        const hasEditing = items.some((x) => (x.editingImageIndexes?.length || 0) > 0)
        if (!hasPendingOrProcessing && !hasEditing) return

        let cancelled = false
        let timer: any

        const tick = async () => {
            if (cancelled) return
            if (document.hidden) {
                if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS)
                return
            }
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
    }, [tab, items, page, debouncedQuery, fetchPage])

    // 视频自动刷新
    useEffect(() => {
        if (tab !== "video") return
        const hasPendingOrProcessing = videoItems.some((x) => {
            const s = String(x.status || "").toUpperCase()
            return s === "PENDING" || s === "PROCESSING"
        })
        if (!hasPendingOrProcessing) return

        let cancelled = false
        let timer: any

        const tick = async () => {
            if (cancelled) return
            if (document.hidden) {
                if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS)
                return
            }
            try {
                await fetchVideoPage(videoPage)
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
    }, [tab, videoItems, videoPage, fetchVideoPage])

    const handleRefresh = () => {
        if (tab === "image") fetchPage(page, debouncedQuery)
        else fetchVideoPage(videoPage)
    }

    // 图片状态过滤
    const filteredItems = useMemo(() => {
        if (statusFilter === "all") return items
        return items.filter((item) => {
            const s = String(item.status || "").toUpperCase()
            if (statusFilter === "pending") return s === "PENDING" || s === "PROCESSING"
            if (statusFilter === "completed") return s === "COMPLETED"
            if (statusFilter === "failed") return s === "FAILED" || s === "PARTIAL_SUCCESS"
            return true
        })
    }, [items, statusFilter])

    const currentTotalPages = Math.ceil((tab === "image" ? total : videoTotal) / limit) || 1
    const currentPage = tab === "image" ? page : videoPage
    const setCurrentPage = tab === "image" ? setPage : setVideoPage
    const currentTotal = tab === "image" ? total : videoTotal

    const empty = !loading && tab === "image" && items.length === 0 ||
                  !videoLoading && tab === "video" && videoItems.length === 0

    const pendingCount = (tab === "image" ? items : videoItems).filter((x) => {
        const s = String(x.status || "").toUpperCase()
        return s === "PENDING" || s === "PROCESSING"
    }).length

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

                            {/* Tab 切换 + 搜索 */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
                                {/* Tab 按钮 */}
                                <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10 shrink-0">
                                    <button
                                        onClick={() => setTab("image")}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                            tab === "image"
                                                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                                                : "text-slate-400 hover:text-white hover:bg-white/5"
                                        }`}
                                    >
                                        <ImageIcon className="w-4 h-4" />
                                        图片任务
                                    </button>
                                    <button
                                        onClick={() => setTab("video")}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                            tab === "video"
                                                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                                                : "text-slate-400 hover:text-white hover:bg-white/5"
                                        }`}
                                    >
                                        <Video className="w-4 h-4" />
                                        视频任务
                                    </button>
                                </div>

                                {/* 搜索（仅图片模式） */}
                                {tab === "image" && (
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
                                )}
                            </div>

                            {/* 内容区域 */}
                            <AnimatePresence mode="wait">
                                {tab === "image" ? (
                                    <motion.div key="image-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        {renderImageTasks()}
                                    </motion.div>
                                ) : (
                                    <motion.div key="video-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        {renderVideoTasks()}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </main>
            </div>

            {/* 图片详情弹窗 */}
            <HistoryDetailDialog
                open={open}
                onOpenChange={setOpen}
                items={items}
                initialIndex={activeIndex}
                onGenerateSuccess={handleRefresh}
            />

            {/* 视频详情弹窗 */}
            <VideoDetailDialog
                open={videoDetailOpen}
                onOpenChange={setVideoDetailOpen}
                item={activeVideoItem}
            />
        </div>
    )

    /** 图片任务列表 */
    function renderImageTasks() {
        if (loading) return renderSkeleton()

        if (items.length === 0) {
            return (
                <div className="glass rounded-3xl p-10 border border-white/10 text-center">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                        <ListTodo className="w-7 h-7 text-purple-300" />
                    </div>
                    <div className="text-white font-semibold text-lg">
                        {debouncedQuery ? "没有找到匹配的任务" : "暂无图片任务"}
                    </div>
                    <div className="text-slate-400 text-sm mt-2">
                        {debouncedQuery ? "尝试其他搜索关键词" : "去首页生成一张九宫格作品吧。"}
                    </div>
                    {!debouncedQuery && (
                        <div className="mt-6">
                            <Button asChild className="rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
                                <a href="/">去生成</a>
                            </Button>
                        </div>
                    )}
                </div>
            )
        }

        if (filteredItems.length === 0) {
            return (
                <div className="glass rounded-3xl p-10 border border-white/10 text-center">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                        <Filter className="w-7 h-7 text-purple-300" />
                    </div>
                    <div className="text-white font-semibold text-lg">没有符合筛选条件的任务</div>
                </div>
            )
        }

        return (
            <>
                <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {filteredItems.map((item) => (
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
                {renderPagination()}
            </>
        )
    }

    /** 视频任务列表 */
    function renderVideoTasks() {
        if (videoLoading) return renderSkeleton()

        if (videoItems.length === 0) {
            return (
                <div className="glass rounded-3xl p-10 border border-white/10 text-center">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                        <Video className="w-7 h-7 text-violet-300" />
                    </div>
                    <div className="text-white font-semibold text-lg">暂无视频任务</div>
                    <div className="text-slate-400 text-sm mt-2">去生成一个视频吧</div>
                    <div className="mt-6">
                        <Button asChild className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white">
                            <a href="/video/sora2">去生成</a>
                        </Button>
                    </div>
                </div>
            )
        }

        return (
            <>
                <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {videoItems.map((item) => (
                            <VideoTaskItem
                                key={item.id}
                                item={item}
                                onViewDetails={() => {
                                    setActiveVideoItem(item)
                                    setVideoDetailOpen(true)
                                }}
                                onRefreshSuccess={handleRefresh}
                            />
                        ))}
                    </AnimatePresence>
                </div>
                {renderPagination()}
            </>
        )
    }

    /** 骨架屏 */
    function renderSkeleton() {
        return (
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-slate-900/40">
                        <Skeleton className="w-20 h-20 rounded-xl bg-white/10" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-1/3 bg-white/10" />
                            <Skeleton className="h-3 w-1/4 bg-white/10" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-8 w-20 bg-white/10 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    /** 分页 */
    function renderPagination() {
        if (currentTotalPages <= 1) return null

        return (
            <div className="flex items-center justify-between mt-8">
                <div className="text-sm text-slate-400">
                    共 {currentTotal} 条记录，第 {currentPage}/{currentTotalPages} 页
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        variant="outline"
                        size="sm"
                        className="border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-50"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        上一页
                    </Button>

                    <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, currentTotalPages) }, (_, i) => {
                            let pageNum: number
                            if (currentTotalPages <= 5) {
                                pageNum = i + 1
                            } else if (currentPage <= 3) {
                                pageNum = i + 1
                            } else if (currentPage >= currentTotalPages - 2) {
                                pageNum = currentTotalPages - 4 + i
                            } else {
                                pageNum = currentPage - 2 + i
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`w-8 h-8 rounded-lg text-sm transition-all ${
                                        currentPage === pageNum
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
                        onClick={() => setCurrentPage((p: number) => Math.min(currentTotalPages, p + 1))}
                        disabled={currentPage >= currentTotalPages}
                        variant="outline"
                        size="sm"
                        className="border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-50"
                    >
                        下一页
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        )
    }
}
