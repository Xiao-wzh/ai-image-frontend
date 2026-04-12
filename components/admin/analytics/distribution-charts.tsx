"use client"

import { useEffect, useRef } from "react"
import * as echarts from "echarts"
import { ChartCard } from "./chart-card"

interface DistributionChartsProps {
  platform: Array<{ name: string; value: number }>
  planSales: Array<{ plan_name: string; count: number; revenue: number }>
  productType: Array<{ name: string; value: number }>
}

export function DistributionCharts({ platform, planSales, productType }: DistributionChartsProps) {
  const platformRef = useRef<HTMLDivElement>(null)
  const planRef = useRef<HTMLDivElement>(null)
  const platformInstanceRef = useRef<echarts.ECharts | null>(null)
  const planInstanceRef = useRef<echarts.ECharts | null>(null)

  // 平台分布饼图
  useEffect(() => {
    if (!platformRef.current || !platform.length) return
    if (!platformInstanceRef.current) {
      platformInstanceRef.current = echarts.init(platformRef.current, "dark")
    }
    const chart = platformInstanceRef.current

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter: (params: { name: string; value: number; percent: number }) =>
          `${params.name}: ${params.value}次 (${params.percent}%)`,
      },
      legend: {
        orient: "vertical",
        right: 0,
        top: "center",
        textStyle: { color: "#94a3b8", fontSize: 10 },
      },
      series: [{
        type: "pie",
        radius: ["35%", "65%"],
        center: ["35%", "50%"],
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 11, color: "#fff" },
        },
        data: platform,
        color: ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", "#22c55e"],
      }],
    })

    const handleResize = () => chart.resize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [platform])

  // 套餐销售横向条形图
  useEffect(() => {
    if (!planRef.current || !planSales.length) return
    if (!planInstanceRef.current) {
      planInstanceRef.current = echarts.init(planRef.current, "dark")
    }
    const chart = planInstanceRef.current

    const sorted = [...planSales].sort((a, b) => b.revenue - a.revenue)

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter: (params: unknown[]) => {
          const p = params as Array<{ name: string; value: number; seriesName: string; marker: string }>
          let html = `<div style="font-weight:600;margin-bottom:4px">${p[0]?.name}</div>`
          for (const item of p) {
            if (item.seriesName === "收入") {
              html += `${item.marker} ${item.seriesName}: ¥${(item.value / 100).toFixed(2)}<br/>`
            } else {
              html += `${item.marker} ${item.seriesName}: ${item.value}单`
            }
          }
          return html
        },
      },
      legend: {
        data: ["收入", "销量"],
        textStyle: { color: "#94a3b8", fontSize: 10 },
        top: 0,
      },
      grid: { top: 30, right: 70, bottom: 10, left: 90 },
      xAxis: {
        type: "value",
        axisLabel: { color: "#64748b", fontSize: 10, formatter: (v: number) => `¥${(v / 100).toFixed(0)}` },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
      },
      yAxis: {
        type: "category",
        data: sorted.map((s) => s.plan_name),
        axisLabel: { color: "#94a3b8", fontSize: 10, width: 80, overflow: "truncate" },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      },
      series: [
        {
          name: "收入",
          type: "bar",
          data: sorted.map((s) => s.revenue),
          itemStyle: { color: "#3b82f6", borderRadius: [0, 3, 3, 0] },
          barMaxWidth: 14,
        },
        {
          name: "销量",
          type: "bar",
          data: sorted.map((s) => s.count),
          itemStyle: { color: "#f59e0b", borderRadius: [0, 3, 3, 0] },
          barMaxWidth: 14,
          xAxisIndex: 0,
        },
      ],
    })

    const handleResize = () => chart.resize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [planSales])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="平台分布">
        <div ref={platformRef} style={{ width: "100%", height: 260 }} />
      </ChartCard>
      <ChartCard title="套餐销售排行">
        <div ref={planRef} style={{ width: "100%", height: 260 }} />
      </ChartCard>
    </div>
  )
}
