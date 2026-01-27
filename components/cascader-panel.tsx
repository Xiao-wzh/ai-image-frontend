"use client"

import { useMemo, useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProductTypeLabel } from "@/lib/constants"

export type CascaderPlatformItem = {
  id: string
  label: string
  value: string // platform.key
  types: Array<{ label: string; value: string }>
}

export type CascaderValue = {
  platformKey?: string
  productType?: string
}

export function CascaderPanel({
  items,
  value,
  onChange,
}: {
  items: CascaderPlatformItem[]
  value: CascaderValue
  onChange: (next: Required<CascaderValue>) => void
}) {
  const [hoverPlatformKey, setHoverPlatformKey] = useState<string | null>(null)

  const activePlatformKey = hoverPlatformKey ?? value.platformKey ?? items[0]?.value

  const activePlatform = useMemo(() => {
    return items.find((p) => p.value === activePlatformKey) ?? items[0]
  }, [items, activePlatformKey])

  const types = activePlatform?.types ?? []

  return (
    <div className="w-[520px] max-w-[85vw]">
      <div className="grid grid-cols-2 gap-0">
        {/* Left: platform */}
        <div className="border-r border-white/10">
          <div className="px-3 py-2 text-xs text-slate-400">平台</div>
          <div className="max-h-[320px] overflow-auto p-1">
            {items.map((p) => {
              const selected = (value.platformKey ?? items[0]?.value) === p.value
              const active = activePlatformKey === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  onMouseEnter={() => setHoverPlatformKey(p.value)}
                  onFocus={() => setHoverPlatformKey(p.value)}
                  onClick={() => {
                    // 点击平台：仅切换平台，清空已选风格
                    onChange({ platformKey: p.value, productType: "" })
                  }}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                    active ? "bg-white/10" : "hover:bg-white/5",
                  )}
                >
                  <span className="truncate">{p.label}</span>
                  {selected && <Check className="h-4 w-4 text-purple-300" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: styles */}
        <div>
          <div className="px-3 py-2 text-xs text-slate-400">风格</div>
          <div className="max-h-[320px] overflow-auto p-1">
            {types.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-slate-500">暂无可用风格</div>
            ) : (
              types.map((t) => {
                const selected = value.productType === t.value
                const label = t.label || (ProductTypeLabel as any)[t.value] || t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      onChange({ platformKey: activePlatform.value, productType: t.value })
                    }}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                      selected ? "bg-purple-500/15" : "hover:bg-white/5",
                    )}
                  >
                    <span className="truncate">{label}</span>
                    {selected && <Check className="h-4 w-4 text-purple-300" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}




