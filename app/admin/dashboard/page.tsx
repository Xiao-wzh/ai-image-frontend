"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Sidebar } from "@/components/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sparkles, Droplets, Stamp, TrendingUp, Calendar, RefreshCw } from "lucide-react"
import { toast } from "sonner"

type SummaryData = {
    aiGeneration: number
    removeWatermark: number
    addWatermark: number
    total: number
}

type DailyData = {
    date: string
    aiGeneration: number
    removeWatermark: number
    addWatermark: number
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
            title: "AI 生图",
            value: summary?.aiGeneration ?? 0,
            icon: Sparkles,
            color: "from-purple-500 to-pink-500",
            bgColor: "bg-purple-500/10",
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
            title: "总收入",
            value: summary?.total ?? 0,
            icon: TrendingUp,
            color: "from-green-500 to-emerald-500",
            bgColor: "bg-green-500/10",
        },
    ]

    // 计算最大值用于柱状图
    const maxValue = Math.max(
        ...dailyData.map(d => d.aiGeneration + d.removeWatermark + d.addWatermark),
        1
    )

    return (
        <div className="flex min-h-screen bg-slate-950">
            <Sidebar />
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white">收入仪表盘</h1>
                            <p className="text-slate-400 mt-1">按功能查看收入统计</p>
                        </div>
                    </div>

                    {/* Date Filter */}
                    <Card className="bg-slate-900/50 border-white/10">
                        <CardContent className="pt-6">
                            <div className="flex flex-wrap items-end gap-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-400">开始日期</Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="pl-10 bg-slate-800 border-white/10 text-white"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-400">结束日期</Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="pl-10 bg-slate-800 border-white/10 text-white"
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={fetchData}
                                    disabled={loading}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                                    {loading ? "加载中..." : "查询"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {statCards.map((card, index) => (
                            <motion.div
                                key={card.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Card className={`${card.bgColor} border-white/10`}>
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <CardTitle className="text-sm font-medium text-slate-400">
                                            {card.title}
                                        </CardTitle>
                                        <card.icon className={`w-5 h-5 bg-gradient-to-r ${card.color} bg-clip-text text-transparent`} />
                                    </CardHeader>
                                    <CardContent>
                                        <p className={`text-3xl font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
                                            {card.value.toLocaleString()}
                                        </p>
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
                                        const total = day.aiGeneration + day.removeWatermark + day.addWatermark
                                        return (
                                            <div key={day.date} className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-400">{day.date}</span>
                                                    <span className="text-white font-medium">{total.toLocaleString()} 积分</span>
                                                </div>
                                                <div className="h-6 bg-slate-800 rounded-full overflow-hidden flex">
                                                    {day.aiGeneration > 0 && (
                                                        <div
                                                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                                            style={{ width: `${(day.aiGeneration / maxValue) * 100}%` }}
                                                            title={`AI生图: ${day.aiGeneration}`}
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
                                    <div className="flex gap-6 pt-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
                                            <span className="text-slate-400">AI生图</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
                                            <span className="text-slate-400">去水印</span>
                                        </div>
                                        <div className="flex items-center gap-2">
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
