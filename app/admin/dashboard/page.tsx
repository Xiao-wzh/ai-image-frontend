"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Sidebar } from "@/components/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sparkles, Droplets, Stamp, TrendingUp, Calendar, RefreshCw, FileText, RotateCcw, Layout } from "lucide-react"
import { toast } from "sonner"

type SummaryData = {
    mainImage: number
    mainImageRetry: number
    mainImageTotal: number
    detailPage: number
    detailPageRetry: number
    detailPageTotal: number
    copywriting: number
    removeWatermark: number
    addWatermark: number
    appealRefund: number
    failureRefund: number
    refundTotal: number
    total: number
    totalRevenue: number
}

type DailyData = {
    date: string
    mainImage: number
    mainImageRetry: number
    detailPage: number
    detailPageRetry: number
    copywriting: number
    removeWatermark: number
    addWatermark: number
    appealRefund: number
    failureRefund: number
}

export default function AdminDashboardPage() {
    const [loading, setLoading] = useState(false)
    const [summary, setSummary] = useState<SummaryData | null>(null)
    const [dailyData, setDailyData] = useState<DailyData[]>([])
    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d.toISOString().split("T")[0]
    })
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0])

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/dashboard?start=${startDate}&end=${endDate}`)
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || "获取数据失败")
            }
            setSummary(data.summary)
            setDailyData(data.dailyData)
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const statCards = [
        {
            title: "AI 主图",
            value: summary?.mainImageTotal ?? 0,
            subtitle: `正常: ${summary?.mainImage ?? 0} | 优惠重试: ${summary?.mainImageRetry ?? 0}`,
            icon: Sparkles,
            color: "from-purple-500 to-pink-500",
            bgColor: "bg-purple-500/10",
        },
        {
            title: "详情页",
            value: summary?.detailPageTotal ?? 0,
            subtitle: `正常: ${summary?.detailPage ?? 0} | 优惠重试: ${summary?.detailPageRetry ?? 0}`,
            icon: Layout,
            color: "from-violet-500 to-indigo-500",
            bgColor: "bg-violet-500/10",
        },
        {
            title: "智能商品描述",
            value: summary?.copywriting ?? 0,
            icon: FileText,
            color: "from-teal-500 to-emerald-500",
            bgColor: "bg-teal-500/10",
        },
        {
            title: "退款",
            value: summary?.refundTotal ?? 0,
            subtitle: `申诉: ${summary?.appealRefund ?? 0} | 失败: ${summary?.failureRefund ?? 0}`,
            icon: RotateCcw,
            color: "from-red-500 to-orange-500",
            bgColor: "bg-red-500/10",
        },
        {
            title: "去水印",
            value: summary?.removeWatermark ?? 0,
            icon: Droplets,
            color: "from-blue-500 to-cyan-500",
            bgColor: "bg-blue-500/10",
        },
        {
            title: "加水印",
            value: summary?.addWatermark ?? 0,
            icon: Stamp,
            color: "from-orange-500 to-yellow-500",
            bgColor: "bg-orange-500/10",
        },
        {
            title: "净收入",
            value: summary?.total ?? 0,
            subtitle: `总收入: ${summary?.totalRevenue ?? 0}`,
            icon: TrendingUp,
            color: "from-green-500 to-emerald-500",
            bgColor: "bg-green-500/10",
        },
    ]

    // 计算最大值用于柱状图
    const maxValue = Math.max(
        ...dailyData.map(d => d.mainImage + d.mainImageRetry + d.detailPage + d.detailPageRetry + d.copywriting + d.removeWatermark + d.addWatermark),
        1
    )

    return (
        <div className="flex min-h-screen bg-slate-950">
            <Sidebar />
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white">收入仪表盘</h1>
                            <p className="text-slate-400 mt-1">查看平台积分收入统计</p>
                        </div>

                        {/* Date Range Picker */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="startDate" className="text-slate-400 text-sm">
                                    <Calendar className="w-4 h-4 inline mr-1" />
                                    开始
                                </Label>
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-40 bg-slate-900 border-white/10 text-white"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="endDate" className="text-slate-400 text-sm">
                                    结束
                                </Label>
                                <Input
                                    id="endDate"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-40 bg-slate-900 border-white/10 text-white"
                                />
                            </div>
                            <Button
                                onClick={fetchData}
                                disabled={loading}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                            >
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "查询"}
                            </Button>
                        </div>
                    </div>

                    {/* Stat Cards - 7 columns on large screens */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        {statCards.map((card, i) => (
                            <motion.div
                                key={card.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <Card className={`${card.bgColor} border-white/10 hover:border-white/20 transition-all`}>
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <CardTitle className="text-xs font-medium text-slate-400">
                                            {card.title}
                                        </CardTitle>
                                        <card.icon className={`w-4 h-4 bg-gradient-to-r ${card.color} bg-clip-text text-transparent`} />
                                    </CardHeader>
                                    <CardContent>
                                        <p className={`text-2xl font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
                                            {card.value.toLocaleString()}
                                        </p>
                                        {card.subtitle && (
                                            <p className="text-[10px] text-slate-500 mt-1 truncate" title={card.subtitle}>
                                                {card.subtitle}
                                            </p>
                                        )}
                                        <p className="text-xs text-slate-500 mt-1">积分</p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>

                    {/* Daily Chart */}
                    <Card className="bg-slate-900/50 border-white/10">
                        <CardHeader>
                            <CardTitle className="text-white">每日趋势</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {dailyData.length === 0 ? (
                                <p className="text-slate-400 text-center py-8">暂无数据</p>
                            ) : (
                                <div className="space-y-4">
                                    {dailyData.map((day) => {
                                        const total = day.mainImage + day.mainImageRetry + day.detailPage + day.detailPageRetry + day.copywriting + day.removeWatermark + day.addWatermark
                                        return (
                                            <div key={day.date} className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-400">{day.date}</span>
                                                    <span className="text-white font-medium">{total.toLocaleString()} 积分</span>
                                                </div>
                                                <div className="h-6 bg-slate-800 rounded-full overflow-hidden flex">
                                                    {day.mainImage > 0 && (
                                                        <div
                                                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                                            style={{ width: `${(day.mainImage / maxValue) * 100}%` }}
                                                            title={`主图正常: ${day.mainImage}`}
                                                        />
                                                    )}
                                                    {day.mainImageRetry > 0 && (
                                                        <div
                                                            className="h-full bg-gradient-to-r from-purple-400 to-pink-400 opacity-70"
                                                            style={{ width: `${(day.mainImageRetry / maxValue) * 100}%` }}
                                                            title={`主图重试: ${day.mainImageRetry}`}
                                                        />
                                                    )}
                                                    {day.detailPage > 0 && (
                                                        <div
                                                            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
                                                            style={{ width: `${(day.detailPage / maxValue) * 100}%` }}
                                                            title={`详情页正常: ${day.detailPage}`}
                                                        />
                                                    )}
                                                    {day.detailPageRetry > 0 && (
                                                        <div
                                                            className="h-full bg-gradient-to-r from-violet-400 to-indigo-400 opacity-70"
                                                            style={{ width: `${(day.detailPageRetry / maxValue) * 100}%` }}
                                                            title={`详情页重试: ${day.detailPageRetry}`}
                                                        />
                                                    )}
                                                    {day.copywriting > 0 && (
                                                        <div
                                                            className="h-full bg-gradient-to-r from-teal-500 to-emerald-500"
                                                            style={{ width: `${(day.copywriting / maxValue) * 100}%` }}
                                                            title={`智能描述: ${day.copywriting}`}
                                                        />
                                                    )}
                                                    {day.removeWatermark > 0 && (
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                                                            style={{ width: `${(day.removeWatermark / maxValue) * 100}%` }}
                                                            title={`去水印: ${day.removeWatermark}`}
                                                        />
                                                    )}
                                                    {day.addWatermark > 0 && (
                                                        <div
                                                            className="h-full bg-gradient-to-r from-orange-500 to-yellow-500"
                                                            style={{ width: `${(day.addWatermark / maxValue) * 100}%` }}
                                                            title={`加水印: ${day.addWatermark}`}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {/* Legend */}
                                    <div className="flex gap-4 pt-4 text-xs flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
                                            <span className="text-slate-400">主图</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" />
                                            <span className="text-slate-400">详情页</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500" />
                                            <span className="text-slate-400">智能描述</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
                                            <span className="text-slate-400">去水印</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500" />
                                            <span className="text-slate-400">加水印</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
