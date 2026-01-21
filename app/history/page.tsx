"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Sparkles, Image as ImageIcon, Download, Eye, ChevronLeft, ChevronRight } from "lucide-react"

import { Sidebar } from "@/components/sidebar"
import { TopBanner } from "@/components/top-banner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { HistoryCard, type HistoryItem } from "@/components/history-card"
import { HistoryDetailDialog } from "@/components/history-detail-dialog"

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function GalleryPage() {
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, 300)

  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const limit = 12 // 4x3 grid

  const fetchPage = useCallback(async (pageNum: number, searchQuery: string) => {
    const params = new URLSearchParams()
    params.set("limit", String(limit))
    params.set("offset", String((pageNum - 1) * limit))
    params.set("status", "COMPLETED") // Only show completed works
    if (searchQuery.trim()) params.set("query", searchQuery.trim())

    const res = await fetch(`/api/history?${params.toString()}`)
    if (!res.ok) {
      throw new Error(`请求失败: ${res.status}`)
    }
    const data = await res.json()
    const newItems = (data.items ?? []) as HistoryItem[]

    setItems(newItems)
    setTotal(data?.page?.total ?? 0)
  }, [])

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1)
  }, [debouncedQuery])

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

  const handleRefresh = () => {
    fetchPage(page, debouncedQuery)
  }

  const totalPages = Math.ceil(total / limit) || 1
  const empty = !loading && items.length === 0

  // Stats
  const totalImages = total * 9 // Each work has 9 images

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
                    <div className="text-2xl font-bold text-white">{total}</div>
                    <div className="text-xs text-slate-400">作品总数</div>
                  </div>
                  <div className="w-px h-10 bg-white/10" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">{totalImages}</div>
                    <div className="text-xs text-slate-400">图片总数</div>
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mb-8">
                <div className="relative max-w-md">
                  <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索作品名称..."
                    className="w-full h-12 pl-12 pr-4 rounded-2xl bg-slate-900/60 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-base"
                  />
                </div>
              </div>

              {/* Gallery Grid */}
              {loading ? (
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
              ) : empty ? (
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
                    <Button
                      asChild
                      variant="outline"
                      className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white"
                    >
                      <a href="/tasks">查看任务队列</a>
                    </Button>
                    <Button
                      asChild
                      className="rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white"
                    >
                      <a href="/">创建新作品</a>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Gallery Grid */}
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
                          <div
                            onClick={() => {
                              setActiveIndex(idx)
                              setOpen(true)
                            }}
                            className="group cursor-pointer rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10"
                          >
                            {/* Image */}
                            <div className="relative aspect-square overflow-hidden">
                              <img
                                src={item.generatedImages?.[0] || item.generatedImage || "/placeholder.svg"}
                                alt={item.productName}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />

                              {/* Hover Overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                                <div className="flex gap-2">
                                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <Eye className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                              </div>

                              {/* Task Type Badge - top left */}
                              {item.taskType === "DETAIL_PAGE" ? (
                                <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-purple-500/90 backdrop-blur-sm text-xs text-white font-medium">
                                  详情页
                                </div>
                              ) : item.taskType === "MAIN_IMAGE" ? (
                                <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-blue-500/90 backdrop-blur-sm text-xs text-white font-medium">
                                  主图
                                </div>
                              ) : null}

                              {/* Editing indicator - bottom left */}
                              {(item.editingImageIndexes?.length || 0) > 0 && (
                                <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/90 backdrop-blur-sm border border-orange-400/40">
                                  <svg className="w-3 h-3 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                  <span className="text-[10px] text-white font-medium">重绘中</span>
                                </div>
                              )}

                              {/* Image count badge */}
                              <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-xs text-white flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                <span>{item.generatedImages?.length || 9}</span>
                              </div>

                            </div>


                            {/* Info */}
                            <div className="p-4">
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
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center mt-10 gap-2">
                      <Button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        variant="outline"
                        size="sm"
                        className="border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
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
                              className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${page === pageNum
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
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        variant="outline"
                        size="sm"
                        className="border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-50"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>

                      <span className="text-slate-500 text-sm ml-4">
                        共 {total} 件作品
                      </span>
                    </div>
                  )}
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
        onItemsChange={setItems}
      />
    </div>
  )
}
