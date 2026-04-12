"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { Sidebar } from "@/components/sidebar"
import { OverviewCards } from "@/components/admin/analytics/overview-cards"
import { RevenueTrendChart } from "@/components/admin/analytics/revenue-trend-chart"
import { UserGrowthChart } from "@/components/admin/analytics/user-growth-chart"
import { GenerationEfficiencyChart } from "@/components/admin/analytics/generation-efficiency-chart"
import { RetentionTable } from "@/components/admin/analytics/retention-table"
import { ConversionFunnel } from "@/components/admin/analytics/conversion-funnel"
import { UserSegmentPie } from "@/components/admin/analytics/user-segment-pie"
import { DistributionCharts } from "@/components/admin/analytics/distribution-charts"
import { PeriodSelector, type Period } from "@/components/admin/analytics/period-selector"
import { TrendingUp } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d")

  // 概览数据
  const { data: overviewData, mutate: mutateOverview } = useSWR(
    "/api/admin/analytics/overview",
    fetcher,
    { dedupingInterval: 60000 }
  )

  // 趋势数据
  const { data: trendsData, mutate: mutateTrends } = useSWR(
    `/api/admin/analytics/trends?period=${period}`,
    fetcher,
    { dedupingInterval: 60000 }
  )

  // 留存数据
  const { data: retentionData, mutate: mutateRetention } = useSWR(
    "/api/admin/analytics/retention",
    fetcher,
    { dedupingInterval: 60000 }
  )

  // 分布数据
  const { data: distributionData, mutate: mutateDistribution } = useSWR(
    `/api/admin/analytics/distribution?period=${period}`,
    fetcher,
    { dedupingInterval: 60000 }
  )

  const handleRefresh = useCallback(() => {
    mutateOverview()
    mutateTrends()
    mutateRetention()
    mutateDistribution()
  }, [mutateOverview, mutateTrends, mutateRetention, mutateDistribution])

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* 顶部 */}
        <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold">运营分析工作台</h1>
            </div>
            <PeriodSelector
              period={period}
              onPeriodChange={setPeriod}
              onRefresh={handleRefresh}
            />
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-6 space-y-6">
          {/* 概览卡片 */}
          <OverviewCards data={overviewData?.data} />

          {/* 收入趋势 + 用户增长 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RevenueTrendChart data={trendsData?.data?.revenue || []} />
            <UserGrowthChart
              userGrowth={trendsData?.data?.userGrowth || []}
              activeUsers={trendsData?.data?.activeUsers || []}
            />
          </div>

          {/* 生成任务效率 */}
          <GenerationEfficiencyChart
            generations={trendsData?.data?.generations || []}
            hourly={distributionData?.data?.hourly || []}
          />

          {/* 留存 + 漏斗 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RetentionTable data={retentionData?.data?.retention || []} />
            <ConversionFunnel data={retentionData?.data?.funnel || []} />
          </div>

          {/* 活跃分层 + 平台/套餐分布 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <UserSegmentPie data={retentionData?.data?.segments || []} />
            <DistributionCharts
              platform={distributionData?.data?.platform || []}
              planSales={distributionData?.data?.planSales || []}
              productType={distributionData?.data?.productType || []}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
