"use client"

import { useEffect, useRef } from "react"
import * as echarts from "echarts"
import { ChartCard } from "./chart-card"

interface GenerationEfficiencyChartProps {
  generations: Array<{ date: string; status: string; count: number }>
  hourly: Array<{ hour: number; count: number }>
}

export function GenerationEfficiencyChart({ generations, hourly }: GenerationEfficiencyChartProps) {
  const areaRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const areaInstanceRef = useRef<echarts.ECharts | null>(null)
  const barInstanceRef = useRef<echarts.ECharts | null>(null)

  // 堆叠面积图
  useEffect(() => {
    if (!areaRef.current) return
    if (!areaInstanceRef.current) {
      areaInstanceRef.current = echarts.init(areaRef.current, "dark")
    }
    const chart = areaInstanceRef.current

    const allDates = [...new Set(generations.map((g) => g.date))].sort()
    const statusMap: Record<string, Record<string, number>> = {}
    for (const g of generations) {
      if (!statusMap[g.date]) statusMap[g.date] = {}
      statusMap[g.date][g.status] = g.count
    }

    const statuses = ["COMPLETED", "PARTIAL_SUCCESS", "FAILED", "PENDING", "PROCESSING"]
    const colors = ["#22c55e", "#84cc16", "#ef4444", "#64748b", "#f59e0b"]
    const labels = ["成功", "部分成功", "失败", "待处理", "处理中"]

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
      },
      legend: {
        data: labels,
        textStyle: { color: "#94a3b8", fontSize: 10 },
        top: 0,
        type: "scroll",
      },
      grid: { top: 40, right: 20, bottom: 30, left: 50 },
      xAxis: {
        type: "category",
        data: allDates,
        axisLabel: { color: "#64748b", fontSize: 9, rotate: allDates.length > 15 ? 45 : 0 },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#64748b", fontSize: 10 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
      },
      series: statuses.map((status, i) => ({
        name: labels[i],
        type: "line",
        stack: "total",
        areaStyle: { opacity: 0.3 },
        lineStyle: { width: 1 },
        itemStyle: { color: colors[i] },
        data: allDates.map((d) => statusMap[d]?.[status] || 0),
        smooth: true,
      })),
    })

    const handleResize = () => chart.resize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [generations])

  // 24小时高峰时段
  useEffect(() => {
    if (!barRef.current) return
    if (!barInstanceRef.current) {
      barInstanceRef.current = echarts.init(barRef.current, "dark")
    }
    const chart = barInstanceRef.current

    const hours = Array.from({ length: 24 }, (_, i) => i)
    const hourMap = Object.fromEntries(hourly.map((h) => [h.hour, h.count]))

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter: (params: unknown[]) => {
          const p = params as Array<{ axisValue: string; value: number }>
          return `${p[0]?.axisValue}时: ${p[0]?.value}次`
        },
      },
      grid: { top: 10, right: 20, bottom: 30, left: 50 },
      xAxis: {
        type: "category",
        data: hours.map((h) => `${h}时`),
        axisLabel: { color: "#64748b", fontSize: 9, interval: 2 },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#64748b", fontSize: 10 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
      },
      series: [{
        type: "bar",
        data: hours.map((h) => hourMap[h] || 0),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#6366f1" },
            { offset: 1, color: "#3b82f6" },
          ]),
          borderRadius: [2, 2, 0, 0],
        },
        barMaxWidth: 16,
      }],
    })

    const handleResize = () => chart.resize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [hourly])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="生成任务趋势（堆叠面积图）">
        <div ref={areaRef} style={{ width: "100%", height: 260 }} />
      </ChartCard>
      <ChartCard title="24小时生成高峰时段">
        <div ref={barRef} style={{ width: "100%", height: 260 }} />
      </ChartCard>
    </div>
  )
}
