"use client"

import { useEffect, useRef } from "react"
import * as echarts from "echarts"
import { ChartCard } from "./chart-card"

interface RevenueTrendChartProps {
  data: Array<{ date: string; revenue: number; order_count: number }>
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, "dark")
    }
    const chart = instanceRef.current

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter: (params: unknown[]) => {
          const p = params as Array<{ axisValue: string; seriesName: string; value: number; marker: string }>
          let html = `<div style="margin-bottom:4px;font-weight:600">${p[0]?.axisValue}</div>`
          for (const item of p) {
            const val = item.seriesName === "收入" ? `¥${(item.value / 100).toFixed(2)}` : `${item.value}笔`
            html += `<div>${item.marker} ${item.seriesName}: ${val}</div>`
          }
          return html
        },
      },
      legend: {
        data: ["收入", "订单数"],
        textStyle: { color: "#94a3b8", fontSize: 11 },
        top: 0,
        right: 0,
      },
      grid: { top: 40, right: 60, bottom: 30, left: 70 },
      xAxis: {
        type: "category",
        data: data.map((d) => d.date),
        axisLabel: { color: "#64748b", fontSize: 10, rotate: data.length > 15 ? 45 : 0 },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      },
      yAxis: [
        {
          type: "value",
          name: "收入(元)",
          nameTextStyle: { color: "#64748b", fontSize: 10 },
          axisLabel: {
            color: "#64748b",
            fontSize: 10,
            formatter: (v: number) => `¥${(v / 100).toFixed(0)}`,
          },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
        },
        {
          type: "value",
          name: "订单",
          nameTextStyle: { color: "#64748b", fontSize: 10 },
          axisLabel: { color: "#64748b", fontSize: 10 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "收入",
          type: "line",
          data: data.map((d) => d.revenue),
          smooth: true,
          lineStyle: { width: 2, color: "#3b82f6" },
          itemStyle: { color: "#3b82f6" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(59,130,246,0.3)" },
              { offset: 1, color: "rgba(59,130,246,0.02)" },
            ]),
          },
        },
        {
          name: "订单数",
          type: "line",
          yAxisIndex: 1,
          data: data.map((d) => d.order_count),
          smooth: true,
          lineStyle: { width: 2, color: "#f59e0b" },
          itemStyle: { color: "#f59e0b" },
        },
      ],
    })

    const handleResize = () => chart.resize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [data])

  return (
    <ChartCard title="收入趋势">
      <div ref={chartRef} style={{ width: "100%", height: 280 }} />
    </ChartCard>
  )
}
