"use client"

import { useEffect, useRef } from "react"
import * as echarts from "echarts"
import { ChartCard } from "./chart-card"

interface SegmentData {
  segment: string
  count: number
}

interface UserSegmentPieProps {
  data: SegmentData[]
}

const segmentColors: Record<string, string> = {
  "重度": "#f59e0b",
  "中度": "#3b82f6",
  "轻度": "#06b6d4",
  "仅1天": "#8b5cf6",
  "已流失": "#ef4444",
  "从未使用": "#64748b",
}

// 保持顺序
const segmentOrder = ["重度", "中度", "轻度", "仅1天", "已流失", "从未使用"]

export function UserSegmentPie({ data }: UserSegmentPieProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current || !data.length) return
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, "dark")
    }
    const chart = instanceRef.current

    const sorted = [...data].sort(
      (a, b) => segmentOrder.indexOf(a.segment) - segmentOrder.indexOf(b.segment)
    )

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter: (params: { name: string; value: number; percent: number }) =>
          `${params.name}: ${params.value}人 (${params.percent}%)`,
      },
      legend: {
        orient: "vertical",
        right: 10,
        top: "center",
        textStyle: { color: "#94a3b8", fontSize: 11 },
      },
      series: [{
        type: "pie",
        radius: ["40%", "70%"],
        center: ["35%", "50%"],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 12, fontWeight: "bold", color: "#fff" },
        },
        data: sorted.map((s) => ({
          name: s.segment,
          value: s.count,
          itemStyle: { color: segmentColors[s.segment] || "#64748b" },
        })),
      }],
    })

    const handleResize = () => chart.resize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [data])

  return (
    <ChartCard title="活跃用户分层">
      <div ref={chartRef} style={{ width: "100%", height: 280 }} />
    </ChartCard>
  )
}
