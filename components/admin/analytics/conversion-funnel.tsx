"use client"

import { ChartCard } from "./chart-card"

interface FunnelData {
  step: string
  count: number
}

interface ConversionFunnelProps {
  data: FunnelData[]
}

const stepConfig = [
  { key: "registered", label: "注册用户", color: "bg-blue-500" },
  { key: "generated", label: "至少生成1次", color: "bg-indigo-500" },
  { key: "bonus_exhausted", label: "赠送积分耗尽", color: "bg-violet-500" },
  { key: "first_paid", label: "首次付费", color: "bg-purple-500" },
  { key: "repeat_paid", label: "复购用户", color: "bg-fuchsia-500" },
]

export function ConversionFunnel({ data }: ConversionFunnelProps) {
  if (!data.length) {
    return (
      <ChartCard title="充值转化漏斗">
        <div className="text-slate-500 text-sm text-center py-8">暂无数据</div>
      </ChartCard>
    )
  }

  // 按 stepConfig 的顺序排列，用 Map 查找
  const dataMap = new Map(data.map((d) => [d.step, d.count]))
  const steps = stepConfig
    .filter((s) => dataMap.has(s.key))
    .map((s) => ({ ...s, count: dataMap.get(s.key)! }))

  const registered = steps.find((s) => s.key === "registered")?.count || 1

  return (
    <ChartCard title="充值转化漏斗">
      <div className="space-y-2">
        {steps.map((step, i) => {
          const totalRate = ((step.count / registered) * 100).toFixed(1)
          const prevCount = i > 0 ? steps[i - 1].count : 0
          const stepRate =
            i > 0 && prevCount > 0
              ? ((step.count / prevCount) * 100).toFixed(1)
              : null

          // 漏斗宽度：按 count 占 max 的比例
          const widthPct = Math.max(
            (step.count / registered) * 100,
            20
          )

          return (
            <div key={step.key} className="flex items-center gap-2">
              {/* 左侧：阶段名 + 人数 */}
              <div className="w-28 text-right text-xs text-slate-400 shrink-0">
                {step.label}
              </div>

              {/* 中间：漏斗条 */}
              <div className="flex-1 min-w-0">
                <div className="relative" style={{ height: 32 }}>
                  <div
                    className={`absolute inset-y-0 left-1/2 -translate-x-1/2 ${step.color}/80 rounded flex items-center justify-center transition-all`}
                    style={{ width: `${widthPct}%` }}
                  >
                    <span className="text-white text-xs font-medium drop-shadow-sm">
                      {step.count.toLocaleString()}
                    </span>
                  </div>
                </div>
                {/* 转化率标注 */}
                {stepRate !== null && (
                  <div className="text-center text-[10px] text-slate-500 -mt-0.5">
                    {Number(stepRate) > 100 ? (
                      <span className="text-amber-400">↑ {stepRate}%</span>
                    ) : (
                      <span>↓ {stepRate}%</span>
                    )}
                  </div>
                )}
              </div>

              {/* 右侧：总转化率 */}
              <div className="w-16 text-xs text-right shrink-0">
                <span
                  className={
                    Number(totalRate) > 100
                      ? "text-amber-400"
                      : "text-slate-300"
                  }
                >
                  {totalRate}%
                </span>
              </div>
            </div>
          )
        })}

        {/* 图例说明 */}
        <div className="flex justify-end gap-4 pt-2 text-[10px] text-slate-500">
          <span>左侧 ↓ = 相对上一步</span>
          <span>右侧 = 占注册用户</span>
        </div>
      </div>
    </ChartCard>
  )
}
