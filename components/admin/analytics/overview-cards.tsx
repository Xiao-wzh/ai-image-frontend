"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface OverviewData {
  todayRevenue: number
  yesterdayRevenue: number
  revenueChange: number
  monthRevenue: number
  todayOrders: number
  yesterdayOrders: number
  ordersChange: number
  todayNewUsers: number
  yesterdayNewUsers: number
  newUsersChange: number
  monthNewUsers: number
  todayActive: number
  yesterdayActive: number
  activeChange: number
  successRate: number
  yesterdaySuccessRate: number
  arpu: number
}

interface OverviewCardsProps {
  data: OverviewData | undefined
}

function ChangeBadge({ value }: { value: number }) {
  if (value === 0) return <Minus className="w-3 h-3 text-slate-500" />
  if (value > 0)
    return (
      <span className="flex items-center text-emerald-400 text-xs font-medium">
        <TrendingUp className="w-3 h-3 mr-0.5" />+{value}%
      </span>
    )
  return (
    <span className="flex items-center text-red-400 text-xs font-medium">
      <TrendingDown className="w-3 h-3 mr-0.5" />{value}%
    </span>
  )
}

export function OverviewCards({ data }: OverviewCardsProps) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-slate-900/50 border border-white/5 rounded-xl p-4 animate-pulse">
            <div className="h-3 bg-slate-700 rounded w-16 mb-3" />
            <div className="h-7 bg-slate-700 rounded w-20 mb-2" />
            <div className="h-3 bg-slate-700 rounded w-12" />
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    {
      label: "今日收入",
      value: `¥${(data.todayRevenue / 100).toFixed(2)}`,
      sub: `昨日 ¥${(data.yesterdayRevenue / 100).toFixed(2)}`,
      change: data.revenueChange,
    },
    {
      label: "今日订单",
      value: `${data.todayOrders}笔`,
      sub: `昨日 ${data.yesterdayOrders}笔`,
      change: data.ordersChange,
    },
    {
      label: "新增用户",
      value: `+${data.todayNewUsers}`,
      sub: `当月 +${data.monthNewUsers}`,
      change: data.newUsersChange,
    },
    {
      label: "活跃用户",
      value: `${data.todayActive}人`,
      sub: `昨日 ${data.yesterdayActive}人`,
      change: data.activeChange,
    },
    {
      label: "成功率",
      value: `${data.successRate}%`,
      sub: `昨日 ${data.yesterdaySuccessRate}%`,
      change: data.successRate - data.yesterdaySuccessRate,
    },
    {
      label: "ARPU",
      value: `¥${data.arpu}`,
      sub: "当月付费用户人均",
      change: 0,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-slate-900/50 border border-white/5 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">{card.label}</div>
          <div className="text-xl font-bold text-white mb-1">{card.value}</div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">{card.sub}</span>
            <ChangeBadge value={card.change} />
          </div>
        </div>
      ))}
    </div>
  )
}
