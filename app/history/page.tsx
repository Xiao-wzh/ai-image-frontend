"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Sparkles } from "lucide-react"

import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

export default function HistoryPage() {
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, 300)

  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const limit = 20

  const fetchPage = async (nextOffset: number, append: boolean) => {
    const params = new URLSearchParams()
    params.set("limit", String(limit))
    params.set("offset", String(nextOffset))
    if (debouncedQuery.trim()) params.set("query", debouncedQuery.trim())

    const res = await fetch(`/api/history?${params.toString()}`)
    if (!res.ok) {
      throw new Error(`请求失败: ${res.status}`)
    }
    const data = await res.json()
    const newItems = (data.items ?? []) as HistoryItem[]

    setItems((prev) => (append ? [...prev, ...newItems] : newItems))
    setOffset(nextOffset + newItems.length)
    setHasMore(Boolean(data?.page?.hasMore))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await fetchPage(0, false)
        if (!cancelled) {
          // nothing
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery])

  const onLoadMore = async () => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      await fetchPage(offset, true)
    } finally {
      setLoadingMore(false)
    }
  }

  const empty = !loading && items.length === 0

  const grid = useMemo(() => {
    if (loading) {
      return (
        <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 min-w-0">
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

    return (
      <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {items.map((item, idx) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="min-w-0"
            >
              <HistoryCard
                item={item}
                onClick={() => {
                  setActiveIndex(idx)
                  setOpen(true)
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    )
  }, [items, loading])

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="relative pt-10 pb-8 px-8 min-w-0">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-10 left-1/4 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl" />
              <div className="absolute top-10 right-1/4 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-6xl mx-auto min-w-0">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 min-w-0">
                <div className="min-w-0">
                  <h1 className="text-3xl md:text-4xl font-bold text-white">我的作品</h1>
                  <p className="text-slate-400 mt-2 text-sm">浏览你历史生成的九宫格作品，支持按商品名搜索。</p>
                </div>

                <div className="w-full md:w-[360px] relative min-w-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索商品名称..."
                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl"
                  />
                </div>
              </div>

              {empty ? (
                <div className="glass rounded-3xl p-10 border border-white/10 text-center">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                    <Sparkles className="w-7 h-7 text-purple-300" />
                  </div>
                  <div className="text-white font-semibold text-lg">还没有作品</div>
                  <div className="text-slate-400 text-sm mt-2">去首页生成一张九宫格作品吧。</div>
                  <div className="mt-6">
                    <Button asChild className="rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
                      <a href="/">去生成</a>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {grid}

                  <div className="flex justify-center mt-8">
                    {hasMore ? (
                      <Button
                        onClick={onLoadMore}
                        disabled={loadingMore}
                        variant="outline"
                        className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white"
                      >
                        {loadingMore ? "加载中..." : "加载更多"}
                      </Button>
                    ) : (
                      !loading && <div className="text-xs text-slate-500">没有更多了</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      <HistoryDetailDialog open={open} onOpenChange={setOpen} items={items} initialIndex={activeIndex} />
    </div>
  )
}
