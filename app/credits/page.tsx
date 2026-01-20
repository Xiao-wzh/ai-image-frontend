"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import { Zap, Wallet, RotateCcw, ChevronLeft, ChevronRight, Calendar, X } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type CreditRecord = {
  id: string
  amount: number
  type: "CONSUME" | "RECHARGE" | "REFUND" | string
  description: string
  createdAt: string
}

type Pagination = {
  total: number
  page: number
  limit: number
  totalPages: number
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function typeMeta(type: CreditRecord["type"]) {
  switch (type) {
    case "CONSUME":
      return { icon: Zap, label: "消耗" }
    case "REFUND":
      return { icon: RotateCcw, label: "退款" }
    case "RECHARGE":
      return { icon: Wallet, label: "充值" }
    default:
      return { icon: Wallet, label: type }
  }
}

export default function CreditsPage() {
  const { data: session, status } = useSession()
  const [records, setRecords] = useState<CreditRecord[]>([])
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  // Date filter state
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const totalCredits = useMemo(() => {
    const paid = session?.user?.credits ?? 0
    const bonus = session?.user?.bonusCredits ?? 0
    return paid + bonus
  }, [session?.user?.credits, session?.user?.bonusCredits])

  const fetchRecords = useCallback(async (page: number, start?: string, end?: string) => {
    if (status !== "authenticated") {
      setRecords([])
      setPagination({ total: 0, page: 1, limit: 20, totalPages: 0 })
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (start) params.set("startDate", start)
      if (end) params.set("endDate", end)

      const res = await fetch(`/api/credits/history?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `请求失败: ${res.status}`)
      setRecords(data.records ?? [])
      setPagination(data.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 0 })
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    fetchRecords(pagination.page, startDate, endDate)
  }, [pagination.page, startDate, endDate, fetchRecords])

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }))
    }
  }

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const clearFilters = () => {
    setStartDate("")
    setEndDate("")
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const hasFilters = startDate || endDate

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-10">
          {/* Header card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl p-8 border border-white/10 mb-8"
          >
            <div className="text-slate-400 text-sm mb-2">积分余额</div>
            {status === "loading" ? (
              <Skeleton className="h-10 w-40 bg-white/10" />
            ) : (
              <div className="text-4xl font-bold gradient-text-alt">{totalCredits}</div>
            )}
            <div className="mt-2 text-xs text-slate-500">
              显示总余额（付费 + 赠送）
            </div>
          </motion.div>

          {/* List */}
          <div className="glass rounded-3xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-white font-semibold">积分流水</div>
                  <div className="text-xs text-slate-500 mt-1">只展示总变动金额（+入账 / -消耗）</div>
                </div>
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4 mr-1" />
                    清除筛选
                  </Button>
                )}
              </div>

              {/* Date Filter */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-400">日期范围:</span>
                </div>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40 h-9 bg-white/5 border-white/10 text-white text-sm"
                  placeholder="开始日期"
                />
                <span className="text-slate-500">至</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40 h-9 bg-white/5 border-white/10 text-white text-sm"
                  placeholder="结束日期"
                />
                <Button
                  size="sm"
                  onClick={handleSearch}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white h-9"
                >
                  查询
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-xl bg-white/10" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-56 bg-white/10" />
                        <Skeleton className="h-3 w-40 bg-white/10" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-20 bg-white/10" />
                  </div>
                ))}
              </div>
            ) : records && records.length > 0 ? (
              <div className="divide-y divide-white/10">
                {records.map((r) => {
                  const meta = typeMeta(r.type)
                  const Icon = meta.icon
                  const positive = r.amount > 0
                  const amountText = `${positive ? "+" : ""}${r.amount}`

                  return (
                    <div key={r.id} className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-slate-200" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-white text-sm font-medium truncate">{r.description}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {meta.label} · {formatDate(r.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div
                        className={
                          "text-sm font-semibold tabular-nums " +
                          (positive ? "text-emerald-400" : r.amount < 0 ? "text-rose-400" : "text-slate-200")
                        }
                      >
                        {amountText}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-10 text-center text-slate-500 text-sm">暂无流水记录</div>
            )}

            {/* Pagination Controls */}
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
