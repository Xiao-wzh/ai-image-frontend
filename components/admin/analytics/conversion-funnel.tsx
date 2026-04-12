"use client"

import { useEffect, useRef } from "react"
import * as echarts from "echarts"
import { ChartCard } from "./chart-card"

interface FunnelData {
  step: string
  count: number
}

interface ConversionFunnelProps {
  data: FunnelData[]
}

const stepLabels: Record<string, string> = {
  registered: "注册用户",
  generated: "至少生成1次",
  bonus_exhausted: "赠送积分耗尽",
  first_paid: "首次付费",
  repeat_paid: "复购",
}

export function ConversionFunnel({ data }: ConversionFunnelProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current || !data.length) return
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, "dark")
    }
    const chart = instanceRef.current

    const total = data[0]?.count || 1
    const funnelData = data.map((d) => ({
      name: stepLabels[d.step] || d.step,
      value: d.count,
      rate: ((d.count / total) * 100).toFixed(1),
    }))

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter: (params: { name: string; value: number; data: { rate: string } }) =>
          `${params.name}<br/>人数: ${params.value} (${params.data.rate}%)`,
      },
      series: [{
        type: "funnel",
        left: "10%",
        top: 10,
        bottom: 10,
        width: "80%",
        sort: "descending",
        gap: 4,
        label: {
          show: true,
          position: "inside",
          formatter: (params: { name: string; data: { rate: string } }) =>
            `${params.name}\n${params.data.rate}%`,
          color: "#fff",
          fontSize: 11,
        },
        itemStyle: {
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
        },
        data: funnelData,
        color: ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#c084fc"],
      }],
    })

    const handleResize = () => chart.resize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [data])

  return (
    <ChartCard title="充值转化漏斗">
      <div ref={chartRef} style={{ width: "100%", height: 280 }} />
    </ChartCard>
  )
}
