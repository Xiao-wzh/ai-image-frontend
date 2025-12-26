"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import { Zap, Wallet, RotateCcw } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

type CreditRecord = {
  id: string
  amount: number
  type: "CONSUME" | "RECHARGE" | "REFUND" | string
  description: string
  createdAt: string
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
  const [records, setRecords] = useState<CreditRecord[] | null>(null)
  const [loading, setLoading] = useState(true)

  const totalCredits = useMemo(() => {
    const paid = session?.user?.credits ?? 0
    const bonus = session?.user?.bonusCredits ?? 0
    return paid + bonus
  }, [session?.user?.credits, session?.user?.bonusCredits])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (status !== "authenticated") {
        setRecords([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const res = await fetch("/api/credits/history")
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `请求失败: ${res.status}`)
        if (!cancelled) setRecords(data.records ?? [])
      } catch {
        if (!cancelled) setRecords([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [status])

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
              显示总余额（付费 + 赠送）。明细可在鼠标悬停积分处查看。
            </div>
          </motion.div>

          {/* List */}
          <div className="glass rounded-3xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="text-white font-semibold">积分流水</div>
              <div className="text-xs text-slate-500 mt-1">只展示总变动金额（+入账 / -消耗）</div>
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
          </div>
        </div>
      </div>
    </div>
  )
}

