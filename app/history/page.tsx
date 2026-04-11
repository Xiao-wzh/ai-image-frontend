"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Sparkles, Image as ImageIcon, Video, Download, Eye, ChevronLeft, ChevronRight, Crown } from "lucide-react"

import { Sidebar } from "@/components/sidebar"
import { TopBanner } from "@/components/top-banner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { HistoryCard, type HistoryItem } from "@/components/history-card"
import { HistoryDetailDialog } from "@/components/history-detail-dialog"
import { VideoHistoryCard, type VideoHistoryItem } from "@/components/video-history-card"
import { VideoDetailDialog } from "@/components/video-detail-dialog"
import { getThumbnailUrl } from "@/lib/cdnUrl"

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

type TabType = "image" | "video"

export default function GalleryPage() {
  const [tab, setTab] = useState<TabType>("image")
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, 300)

  // 图片状态
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

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

  const limit = 12

  // ── 图片数据获取 ──
  const fetchPage = useCallback(async (pageNum: number, searchQuery: string) => {
    const params = new URLSearchParams()
    params.set("type", "image")
    params.set("limit", String(limit))
    params.set("offset", String((pageNum - 1) * limit))
    params.set("status", "COMPLETED")
    if (searchQuery.trim()) params.set("query", searchQuery.trim())

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
    // 历史记录页视频 Tab 显示所有状态（含进行中和失败）

    const res = await fetch(`/api/history?${params.toString()}`)
    if (!res.ok) throw new Error(`请求失败: ${res.status}`)
    const data = await res.json()
    setVideoItems((data.items ?? []) as VideoHistoryItem[])
    setVideoTotal(data?.page?.total ?? 0)
  }, [])

  // 切换 Tab 时重置分页
  useEffect(() => {
    setPage(1)
    setVideoPage(1)
  }, [tab])

  // 搜索变化时重置图片分页
  useEffect(() => {
    setPage(1)
  }, [debouncedQuery])

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

  const handleRefresh = () => {
    if (tab === "image") fetchPage(page, debouncedQuery)
    else fetchVideoPage(videoPage)
  }

  const totalPages = Math.ceil((tab === "image" ? total : videoTotal) / limit) || 1
  const currentPage = tab === "image" ? page : videoPage
  const setCurrentPage = tab === "image" ? setPage : setVideoPage

  const empty = !loading && tab === "image" && items.length === 0 ||
                !videoLoading && tab === "video" && videoItems.length === 0

  const totalImages = items.reduce((sum, item) => sum + (item.generatedImages?.length || 0), 0)
  const totalCount = tab === "image" ? total : videoTotal

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
              <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-7xl mx-auto min-w-0">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white">精品展馆</h1>
                  </div>
                  <p className="text-slate-400 text-sm">
                    欣赏你的创意杰作，每一幅都是 AI 与灵感的完美结合
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{totalCount}</div>
                    <div className="text-xs text-slate-400">{tab === "image" ? "图片作品" : "视频作品"}</div>
                  </div>
                  {tab === "image" && (
                    <>
                      <div className="w-px h-10 bg-white/10" />
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-400">{totalImages}</div>
                        <div className="text-xs text-slate-400">本页图片</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Tab 切换 + 搜索 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
                {/* Tab 按钮 */}
                <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10">
                  <button
                    onClick={() => setTab("image")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      tab === "image"
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    图片作品
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
                    视频作品
                  </button>
                </div>

                {/* 搜索栏（仅图片模式显示） */}
                {tab === "image" && (
                  <div className="relative max-w-md flex-1">
                    <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="搜索作品名称..."
                      className="w-full h-12 pl-12 pr-4 rounded-2xl bg-slate-900/60 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-base"
                    />
                  </div>
                )}
              </div>

              {/* 内容区域 */}
              <AnimatePresence mode="wait">
                {tab === "image" ? (
                  <motion.div key="image-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {renderImageGallery()}
                  </motion.div>
                ) : (
                  <motion.div key="video-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {renderVideoGallery()}
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
        onItemsChange={setItems}
      />

      {/* 视频详情弹窗 */}
      <VideoDetailDialog
        open={videoDetailOpen}
        onOpenChange={setVideoDetailOpen}
        item={activeVideoItem}
      />
    </div>
  )

  /** 图片画廊渲染 */
  function renderImageGallery() {
    if (loading) {
      return (
        <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="group rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 min-w-0">
              <Skeleton className="aspect-square w-full bg-white/10" />
              <div className="p-4 space-y-2 min-w-0">
                <Skeleton className="h-4 w-2/3 bg-white/10" />
                <Skeleton className="h-3 w-1/3 bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (items.length === 0) {
      return (
        <div className="glass rounded-3xl p-16 border border-white/10 text-center">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-6">
            <ImageIcon className="w-10 h-10 text-purple-300" />
          </div>
          <div className="text-white font-semibold text-xl mb-2">
            {debouncedQuery ? "没有找到匹配的作品" : "展馆暂无作品"}
          </div>
          <div className="text-slate-400 text-sm mb-8">
            {debouncedQuery
              ? "尝试其他搜索关键词"
              : "完成的作品将在这里展示，去「任务队列」查看进行中的任务"}
          </div>
          <div className="flex justify-center gap-3">
            <Button asChild variant="outline" className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white">
              <a href="/tasks">查看任务队列</a>
            </Button>
            <Button asChild className="rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
              <a href="/">创建新作品</a>
            </Button>
          </div>
        </div>
      )
    }

    return (
      <>
        <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          <AnimatePresence mode="popLayout">
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: idx * 0.02 }}
                className="min-w-0"
              >
                {(() => {
                  const isPro = item.qualityMode === "PRO"
                  return (
                    <div
                      onClick={() => { setActiveIndex(idx); setOpen(true) }}
                      className="group cursor-pointer rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10"
                    >
                      <div className="relative aspect-square overflow-hidden">
                        <img
                          src={getThumbnailUrl(item.generatedImages?.[0] || item.generatedImage, 400) || "/placeholder.svg"}
                          alt={item.productName}
                          className={`w-full h-full transition-transform duration-500 group-hover:scale-105 ${isPro ? "object-contain" : "object-cover"}`}
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                          <div className="flex gap-2">
                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        </div>

                        {isPro ? (
                          <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 backdrop-blur-sm shadow-lg shadow-amber-500/30">
                            <Crown className="w-3 h-3 text-white" />
                            <span className="text-[10px] text-white font-bold">PRO</span>
                          </div>
                        ) : item.taskType === "DETAIL_PAGE" ? (
                          <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-purple-500/90 backdrop-blur-sm text-xs text-white font-medium">
                            详情页
                          </div>
                        ) : item.taskType === "MAIN_IMAGE" ? (
                          <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-blue-500/90 backdrop-blur-sm text-xs text-white font-medium">
                            主图
                          </div>
                        ) : null}

                        {(item.editingImageIndexes?.length || 0) > 0 && (
                          <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/90 backdrop-blur-sm border border-orange-400/40">
                            <svg className="w-3 h-3 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            <span className="text-[10px] text-white font-medium">重绘中</span>
                          </div>
                        )}

                        <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-xs text-white flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          <span>{item.generatedImages?.length || item.imageCount || 1}</span>
                        </div>
                      </div>

                      <div className={`p-4 ${isPro ? "border-t border-amber-500/15" : ""}`}>
                        <h3 className="text-white font-medium truncate group-hover:text-purple-300 transition-colors">
                          {item.productName}
                        </h3>
                        <p className="text-slate-500 text-xs mt-1">
                          {new Date(item.createdAt).toLocaleDateString("zh-CN", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })()}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {renderPagination()}
      </>
    )
  }

  /** 视频画廊渲染 */
  function renderVideoGallery() {
    if (videoLoading) {
      return (
        <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="group rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 min-w-0">
              <Skeleton className="aspect-video w-full bg-white/10" />
              <div className="p-3 space-y-2 min-w-0">
                <Skeleton className="h-4 w-3/4 bg-white/10" />
                <Skeleton className="h-3 w-1/3 bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (videoItems.length === 0) {
      return (
        <div className="glass rounded-3xl p-16 border border-white/10 text-center">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mb-6">
            <Video className="w-10 h-10 text-violet-300" />
          </div>
          <div className="text-white font-semibold text-xl mb-2">暂无视频作品</div>
          <div className="text-slate-400 text-sm mb-8">
            完成的视频将在这里展示
          </div>
          <Button asChild className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white">
            <a href="/video/sora2">生成视频</a>
          </Button>
        </div>
      )
    }

    return (
      <>
        <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {videoItems.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: idx * 0.02 }}
            >
              <VideoHistoryCard
                item={item}
                onClick={() => {
                  setActiveVideoItem(item)
                  setVideoDetailOpen(true)
                }}
              />
            </motion.div>
          ))}
        </div>

        {renderPagination()}
      </>
    )
  }

  /** 分页组件 */
  function renderPagination() {
    if (totalPages <= 1) return null

    return (
      <div className="flex items-center justify-center mt-10 gap-2">
        <Button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          variant="outline"
          size="sm"
          className="border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number
            if (totalPages <= 5) {
              pageNum = i + 1
            } else if (currentPage <= 3) {
              pageNum = i + 1
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i
            } else {
              pageNum = currentPage - 2 + i
            }
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                  currentPage === pageNum
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {pageNum}
              </button>
            )
          })}
        </div>

        <Button
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages}
          variant="outline"
          size="sm"
          className="border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-50"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>

        <span className="text-slate-500 text-sm ml-4">
          共 {totalCount} 件作品
        </span>
      </div>
    )
  }
}
