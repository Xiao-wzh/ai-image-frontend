"use client"

import { useState } from "react"
import { Search, X, ChevronDown } from "lucide-react"
import { ChartCard } from "./chart-card"

interface RetentionData {
  cohort_date: string
  cohort_size: number
  d1: number
  d3: number
  d7: number
  d14: number
  d30: number
}

interface RetentionTableProps {
  data: RetentionData[]
  onLoadMore?: () => void
  onDateSearch?: (date: string | null) => void
  hasMore?: boolean
  isDateSearch?: boolean
  loading?: boolean
}

function getRetentionColor(rate: number): string {
  if (rate >= 40) return "bg-emerald-500/60 text-emerald-100"
  if (rate >= 25) return "bg-emerald-600/40 text-emerald-200"
  if (rate >= 15) return "bg-yellow-500/40 text-yellow-100"
  if (rate >= 8) return "bg-orange-500/40 text-orange-100"
  if (rate > 0) return "bg-red-500/30 text-red-200"
  return "bg-slate-800/50 text-slate-500"
}

export function RetentionTable({
  data,
  onLoadMore,
  onDateSearch,
  hasMore = false,
  isDateSearch = false,
  loading = false,
}: RetentionTableProps) {
  const [dateInput, setDateInput] = useState("")

  const handleSearch = () => {
    if (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      onDateSearch?.(dateInput)
    }
  }

  const handleClear = () => {
    setDateInput("")
    onDateSearch?.(null)
  }

  return (
    <ChartCard title="留存率（Cohort）">
      {/* 日期搜索栏 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
            placeholder="查询指定日期"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={!dateInput}
          className="px-2.5 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
        {isDateSearch && (
          <button
            onClick={handleClear}
            className="px-2.5 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!data.length ? (
        <div className="text-slate-500 text-sm text-center py-8">
          {loading ? "加载中..." : "暂无数据"}
        </div>
      ) : (
        <>
          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900">
                <tr className="text-slate-400">
                  <th className="text-left py-2 px-2 font-medium">注册日期</th>
                  <th className="text-right py-2 px-2 font-medium">人数</th>
                  <th className="text-center py-2 px-2 font-medium">次日</th>
                  <th className="text-center py-2 px-2 font-medium">3日</th>
                  <th className="text-center py-2 px-2 font-medium">7日</th>
                  <th className="text-center py-2 px-2 font-medium">14日</th>
                  <th className="text-center py-2 px-2 font-medium">30日</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.cohort_date} className="border-t border-white/5">
                    <td className="py-1.5 px-2 text-slate-300 whitespace-nowrap">
                      {row.cohort_date}
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-300">
                      {row.cohort_size}
                    </td>
                    {[row.d1, row.d3, row.d7, row.d14, row.d30].map((val, i) => {
                      const rate =
                        row.cohort_size > 0
                          ? (val / row.cohort_size) * 100
                          : 0
                      return (
                        <td key={i} className="py-1.5 px-1 text-center">
                          <span
                            className={`inline-block w-full py-1 rounded text-[10px] font-medium ${getRetentionColor(rate)}`}
                          >
                            {rate > 0 ? `${rate.toFixed(1)}%` : "-"}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 加载更多 */}
          {!isDateSearch && hasMore && (
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="w-full mt-2 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-slate-400 text-xs flex items-center justify-center gap-1 disabled:opacity-50 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              {loading ? "加载中..." : "加载更多"}
            </button>
          )}

          <div className="text-[10px] text-slate-500 mt-1.5 text-right">
            共 {data.length} 条{isDateSearch ? "（日期筛选）" : ""}
          </div>
        </>
      )}
    </ChartCard>
  )
}
