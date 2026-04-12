"use client"

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
}

function getRetentionColor(rate: number): string {
  if (rate >= 40) return "bg-emerald-500/60 text-emerald-100"
  if (rate >= 25) return "bg-emerald-600/40 text-emerald-200"
  if (rate >= 15) return "bg-yellow-500/40 text-yellow-100"
  if (rate >= 8) return "bg-orange-500/40 text-orange-100"
  if (rate > 0) return "bg-red-500/30 text-red-200"
  return "bg-slate-800/50 text-slate-500"
}

export function RetentionTable({ data }: RetentionTableProps) {
  if (!data.length) {
    return (
      <ChartCard title="留存率（Cohort）">
        <div className="text-slate-500 text-sm text-center py-8">暂无数据</div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="留存率（Cohort）">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
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
                <td className="py-1.5 px-2 text-slate-300">{row.cohort_date}</td>
                <td className="py-1.5 px-2 text-right text-slate-300">{row.cohort_size}</td>
                {[row.d1, row.d3, row.d7, row.d14, row.d30].map((val, i) => {
                  const rate = row.cohort_size > 0 ? (val / row.cohort_size) * 100 : 0
                  return (
                    <td key={i} className="py-1.5 px-1 text-center">
                      <span className={`inline-block w-full py-1 rounded text-[10px] font-medium ${getRetentionColor(rate)}`}>
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
    </ChartCard>
  )
}
