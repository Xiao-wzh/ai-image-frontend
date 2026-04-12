"use client"

import { useEffect, useRef } from "react"
import * as echarts from "echarts"
import { ChartCard } from "./chart-card"

interface UserGrowthChartProps {
  userGrowth: Array<{ date: string; new_users: number }>
  activeUsers: Array<{ date: string; active_users: number }>
}

export function UserGrowthChart({ userGrowth, activeUsers }: UserGrowthChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, "dark")
    }
    const chart = instanceRef.current

    // 合并日期轴
    const allDates = [...new Set([
      ...userGrowth.map((d) => d.date),
      ...activeUsers.map((d) => d.date),
    ])].sort()

    const newUserMap = Object.fromEntries(userGrowth.map((d) => [d.date, d.new_users]))
    const activeUserMap = Object.fromEntries(activeUsers.map((d) => [d.date, d.active_users]))

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
      },
      legend: {
        data: ["新增用户", "活跃用户"],
        textStyle: { color: "#94a3b8", fontSize: 11 },
        top: 0,
        right: 0,
      },
      grid: { top: 40, right: 20, bottom: 30, left: 50 },
      xAxis: {
        type: "category",
        data: allDates,
        axisLabel: { color: "#64748b", fontSize: 10, rotate: allDates.length > 15 ? 45 : 0 },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#64748b", fontSize: 10 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
      },
      series: [
        {
          name: "新增用户",
          type: "bar",
          data: allDates.map((d) => newUserMap[d] || 0),
          itemStyle: { color: "#8b5cf6", borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 20,
        },
        {
          name: "活跃用户",
          type: "bar",
          data: allDates.map((d) => activeUserMap[d] || 0),
          itemStyle: { color: "#06b6d4", borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 20,
        },
      ],
    })

    const handleResize = () => chart.resize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [userGrowth, activeUsers])

  return (
    <ChartCard title="用户增长">
      <div ref={chartRef} style={{ width: "100%", height: 280 }} />
    </ChartCard>
  )
}
