"use client"

import { cn } from "@/lib/utils"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export type Period = "7d" | "30d" | "90d" | "12m"

interface PeriodSelectorProps {
  period: Period
  onPeriodChange: (period: Period) => void
  onRefresh?: () => void
  loading?: boolean
}

const periods: { value: Period; label: string }[] = [
  { value: "7d", label: "7天" },
  { value: "30d", label: "30天" },
  { value: "90d", label: "90天" },
  { value: "12m", label: "12月" },
]

export function PeriodSelector({ period, onPeriodChange, onRefresh, loading }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex bg-slate-800/50 rounded-lg p-0.5">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => onPeriodChange(p.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              period === p.value
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {onRefresh && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-white"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      )}
    </div>
  )
}
