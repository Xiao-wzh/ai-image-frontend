"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { motion } from "framer-motion"
import {
    Receipt, RefreshCw, CheckCircle, Clock, XCircle,
    User, Filter, Calendar, TrendingUp, ShoppingCart,
    ChevronDown, ChevronRight, Loader2, CalendarRange, X
} from "lucide-react"
import { useRouter } from "next/navigation"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

import { Sidebar } from "@/components/sidebar"
import { TopBanner } from "@/components/top-banner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

/* ====================== Types ====================== */
interface OrderUser {
    id: string
    username: string | null
    name: string | null
    email: string | null
    image: string | null
}

interface Order {
    id: string
    outTradeNo: string
    amount: number
    status: string
    planName: string
    credits: number
    giftCredits: number
    totalCredits: number
    user: OrderUser | null
    paidAt: string | null
    createdAt: string
    channel: string | null
}

interface Stats { [key: string]: { count: number; amount: number } }
interface ChartDataPoint { date: string; amount: number }
interface DayGroup {
    dateKey: string; label: string
    totalAmount: number; orderCount: number; orders: Order[]
}

/* ====================== Helpers ====================== */
const DAY_MS = 24 * 60 * 60 * 1000
const UTC8_MS = 8 * 60 * 60 * 1000
const LOAD_MORE_DAYS = 3 // 加载更多步长

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

function subtractDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const ts = Date.UTC(y, m - 1, d) - days * DAY_MS
    const dt = new Date(ts)
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function getDateInfo(isoString: string): { dateKey: string; label: string } {
    const d = new Date(isoString)
    const utc8 = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + UTC8_MS)
    const y = utc8.getFullYear()
    const m = String(utc8.getMonth() + 1).padStart(2, '0')
    const day = String(utc8.getDate()).padStart(2, '0')
    return {
        dateKey: `${y}-${m}-${day}`,
        label: `${y}年${m}月${day}日 · ${WEEKDAYS[utc8.getDay()]}`,
    }
}

function mergeOrdersIntoDayGroups(existing: DayGroup[], newOrders: Order[]): DayGroup[] {
    const groupMap = new Map<string, DayGroup>()
    for (const g of existing) groupMap.set(g.dateKey, { ...g, orders: [...g.orders] })
    //金额只计算已支付订单
    for (const order of newOrders) {
        const { dateKey, label } = getDateInfo(order.createdAt)
        const group = groupMap.get(dateKey)
        if (group) {
            if (!group.orders.some(o => o.id === order.id)) {
                group.orders.push(order)
                if (order.status === 'PAID') {
                    group.totalAmount += order.amount
                    group.orderCount += 1
                }
            }
        } else {
            // 创建新分组时也要检查订单状态
            groupMap.set(dateKey, {
                dateKey,
                label,
                totalAmount: order.status === 'PAID' ? order.amount : 0,
                orderCount: order.status === 'PAID' ? 1 : 0,
                orders: [order]
            })
        }
    }
    return Array.from(groupMap.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey))
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'PAID':
            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"><CheckCircle className="w-3 h-3" />已支付</span>
        case 'PENDING': case 'PAYING': case 'CREATED':
            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"><Clock className="w-3 h-3" />待支付</span>
        case 'CLOSED':
            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30"><XCircle className="w-3 h-3" />已关闭</span>
        default:
            return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">{status}</span>
    }
}

function formatTime(isoString: string): string {
    return new Date(isoString).toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit" })
}

type StatusFilter = 'all' | 'PAID' | 'PAYING' | 'CLOSED'

/* ====================== Component ====================== */
export default function AdminOrdersPage() {
    const router = useRouter()

    // --- 数据 ---
    const [dayGroups, setDayGroups] = useState<DayGroup[]>([])
    const [stats, setStats] = useState<Stats>({})
    const [dailyRevenue, setDailyRevenue] = useState<{ today: number; yesterday: number }>({ today: 0, yesterday: 0 })
    const [chartData, setChartData] = useState<ChartDataPoint[]>([])
    const [todayOrderCount, setTodayOrderCount] = useState(0)
    const [monthlyRevenue, setMonthlyRevenue] = useState(0)
    const [monthlyPlanBreakdown, setMonthlyPlanBreakdown] = useState<Array<{ planName: string; count: number; amount: number }>>([])
    const [todayPlanBreakdown, setTodayPlanBreakdown] = useState<Array<{ planName: string; count: number; amount: number }>>([])

    // 查询特定日期/月份的收入
    const [queryDate, setQueryDate] = useState('')
    const [queryMonth, setQueryMonth] = useState('')
    const [queryDateRevenue, setQueryDateRevenue] = useState<{ amount: number; planBreakdown: Array<{ planName: string; count: number; amount: number }> } | null>(null)
    const [queryMonthRevenue, setQueryMonthRevenue] = useState<{ amount: number; planBreakdown: Array<{ planName: string; count: number; amount: number }> } | null>(null)
    const [queryLoading, setQueryLoading] = useState(false)

    // --- 加载状态 ---
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)

    // --- 当前时间窗（由后端响应驱动） ---
    const [windowStart, setWindowStart] = useState<string | null>(null)
    const [windowEnd, setWindowEnd] = useState<string | null>(null)

    // --- 手动日期筛选 ---
    const [manualStart, setManualStart] = useState('')
    const [manualEnd, setManualEnd] = useState('')
    const isManualFilter = !!(manualStart || manualEnd)

    // --- 状态筛选 ---
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

    // --- 展开/折叠状态 ---
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

    // --- 防抖 ---
    const fetchingRef = useRef(false)

    /**
     * 加载订单
     * @param startDate 不传则后端自动从最新订单推算
     * @param endDate   不传则后端自动从最新订单推算
     * @param append    是否追加模式
     */
    const fetchOrders = useCallback(async (
        startDate: string | null,
        endDate: string | null,
        append: boolean
    ) => {
        if (fetchingRef.current) return
        fetchingRef.current = true

        try {
            append ? setLoadingMore(true) : setLoading(true)

            const params = new URLSearchParams()
            if (startDate) params.set('startDate', startDate)
            if (endDate) params.set('endDate', endDate)
            if (statusFilter !== 'all') params.set('status', statusFilter)

            const res = await fetch(`/api/admin/orders?${params.toString()}`)
            if (res.status === 403) { router.push('/'); return }

            const data = await res.json()
            if (data.success) {
                const newOrders: Order[] = data.data

                if (append) {
                    setDayGroups(prev => mergeOrdersIntoDayGroups(prev, newOrders))
                } else {
                    const groups = mergeOrdersIntoDayGroups([], newOrders)
                    setDayGroups(groups)
                    if (data.stats) setStats(data.stats)
                    if (data.dailyRevenue) setDailyRevenue(data.dailyRevenue)
                    if (data.monthlyRevenue !== undefined) setMonthlyRevenue(data.monthlyRevenue)
                    if (data.monthlyPlanBreakdown) setMonthlyPlanBreakdown(data.monthlyPlanBreakdown)
                    if (data.todayPlanBreakdown) setTodayPlanBreakdown(data.todayPlanBreakdown)
                    if (data.chartData) setChartData(data.chartData)
                    if (data.todayOrderCount !== undefined) setTodayOrderCount(data.todayOrderCount)

                    // 默认展开第一条（最新一天）的数据
                    if (groups.length > 0) {
                        setExpandedDays(new Set([groups[0].dateKey]))
                    }
                }

                // 后端返回实际使用的时间窗
                if (data.windowStart) setWindowStart(data.windowStart)
                if (data.windowEnd) setWindowEnd(data.windowEnd)
                setHasMore(!!data.hasMore)
            }
        } catch (e) {
            console.error("获取订单失败", e)
        } finally {
            setLoading(false)
            setLoadingMore(false)
            fetchingRef.current = false
        }
    }, [statusFilter, router])

    // ========== 首次加载 & 筛选变更 ==========
    useEffect(() => {
        setDayGroups([])
        setHasMore(true)
        setWindowStart(null)
        setWindowEnd(null)

        if (isManualFilter) {
            // 手动模式：请求指定范围
            fetchOrders(manualStart || null, manualEnd || null, false)
        } else {
            // 自动模式：不传日期，让后端从最新订单自动推算7天窗口
            fetchOrders(null, null, false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, manualStart, manualEnd])

    // ========== 加载更多：向前滑动 3 天 ==========
    const handleLoadMore = useCallback(() => {
        if (loadingMore || !hasMore || fetchingRef.current || isManualFilter || !windowStart) return
        // 新窗口：windowStart 前一天为 newEnd，再向前 LOAD_MORE_DAYS-1 天为 newStart
        const newEnd = subtractDays(windowStart, 1)
        const newStart = subtractDays(windowStart, LOAD_MORE_DAYS)
        fetchOrders(newStart, newEnd, true)
    }, [loadingMore, hasMore, isManualFilter, windowStart, fetchOrders])

    // ========== 刷新 ==========
    const handleRefresh = useCallback(() => {
        setDayGroups([])
        setHasMore(true)
        setWindowStart(null)
        setWindowEnd(null)
        setManualStart('')
        setManualEnd('')
        fetchOrders(null, null, false)
    }, [fetchOrders])

    // ========== 查询特定日期收入 ==========
    const handleQueryDate = useCallback(async () => {
        if (!queryDate) return
        setQueryLoading(true)
        try {
            const res = await fetch(`/api/admin/orders/revenue?date=${queryDate}`)
            const data = await res.json()
            if (data.success) {
                setQueryDateRevenue(data.data)
            }
        } catch (e) {
            console.error("查询日期收入失败", e)
        } finally {
            setQueryLoading(false)
        }
    }, [queryDate])

    // ========== 查询特定月份收入 ==========
    const handleQueryMonth = useCallback(async () => {
        if (!queryMonth) return
        setQueryLoading(true)
        try {
            const res = await fetch(`/api/admin/orders/revenue?month=${queryMonth}`)
            const data = await res.json()
            if (data.success) {
                setQueryMonthRevenue(data.data)
            }
        } catch (e) {
            console.error("查询月份收入失败", e)
        } finally {
            setQueryLoading(false)
        }
    }, [queryMonth])

    // --- 统计 ---
    const paidStats = stats['PAID'] || { count: 0, amount: 0 }
    const pendingStats = stats['PAYING'] || { count: 0, amount: 0 }
    const statusOptions: { value: StatusFilter; label: string }[] = [
        { value: 'all', label: '全部' },
        { value: 'PAID', label: '已支付' },
        { value: 'PAYING', label: '待支付' },
        { value: 'CLOSED', label: '已关闭' },
    ]

    const totalOrders = dayGroups.reduce((sum, g) => sum + g.orderCount, 0)
    const empty = !loading && dayGroups.length === 0

    return (
        <div className="flex h-screen bg-slate-950">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <TopBanner />
                <main className="flex-1 overflow-y-auto min-w-0">
                    <div className="relative pt-10 pb-8 px-8 min-w-0">
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute -top-10 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
                            <div className="absolute top-10 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
                        </div>

                        <div className="relative max-w-6xl mx-auto min-w-0">
                            {/* Header */}
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 min-w-0">
                                <div className="min-w-0">
                                    <h1 className="text-3xl md:text-4xl font-bold text-white">订单管理</h1>
                                    <p className="text-slate-400 mt-2 text-sm">查看和管理平台所有充值订单</p>
                                </div>
                                <Button onClick={handleRefresh} variant="outline" size="sm"
                                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white gap-2 cursor-pointer">
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />刷新
                                </Button>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                                <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/40">
                                    <div className="text-slate-400 text-sm">已支付订单</div>
                                    <div className="text-2xl font-bold text-white mt-1">{paidStats.count}</div>
                                    <div className="text-emerald-400 text-sm">¥{(paidStats.amount / 100).toFixed(2)}</div>
                                </div>
                                <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/40">
                                    <div className="text-slate-400 text-sm">待支付订单</div>
                                    <div className="text-2xl font-bold text-white mt-1">{pendingStats.count}</div>
                                    <div className="text-yellow-400 text-sm">¥{(pendingStats.amount / 100).toFixed(2)}</div>
                                </div>
                                <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/40">
                                    <div className="text-slate-400 text-sm">当月收入</div>
                                    <div className="text-2xl font-bold text-emerald-400 mt-1">¥{(monthlyRevenue / 100).toFixed(2)}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {monthlyPlanBreakdown.length > 0 && (
                                            <div className="space-y-0.5">
                                                {monthlyPlanBreakdown.slice(0, 2).map((plan, idx) => (
                                                    <div key={idx} className="text-slate-400">{plan.planName}: {plan.count}笔</div>
                                                ))}
                                                {monthlyPlanBreakdown.length > 2 && <div className="text-slate-500">+{monthlyPlanBreakdown.length - 2}个套餐</div>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/40">
                                    <div className="text-slate-400 text-sm">今日收入</div>
                                    <div className="text-2xl font-bold text-emerald-400 mt-1">¥{(dailyRevenue.today / 100).toFixed(2)}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        昨日: ¥{(dailyRevenue.yesterday / 100).toFixed(2)}
                                    </div>
                                    {todayPlanBreakdown.length > 0 && (
                                        <div className="text-xs text-slate-400 mt-2 space-y-0.5 border-t border-white/10 pt-2">
                                            {todayPlanBreakdown.map((plan, idx) => (
                                                <div key={idx}>{plan.planName}: {plan.count}笔</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/40">
                                    <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                                        <ShoppingCart className="w-3.5 h-3.5" />今日订单
                                    </div>
                                    <div className="text-2xl font-bold text-purple-400 mt-1">{todayOrderCount}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">已支付笔数</div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40 mb-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <TrendingUp className="w-4 h-4 text-purple-400" />
                                    <span className="text-white font-medium text-sm">近 7 天收入趋势</span>
                                    <span className="text-slate-500 text-xs">（单位：元）</span>
                                </div>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={8} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v: number) => `¥${v}`} width={60} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', padding: '10px 14px' }}
                                                labelStyle={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}
                                                itemStyle={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}
                                                formatter={(value: number) => [`¥${value.toFixed(2)}`, '收入']}
                                                cursor={{ stroke: 'rgba(168,85,247,0.3)', strokeWidth: 1 }}
                                            />
                                            <Area type="monotone" dataKey="amount" stroke="#a855f7" strokeWidth={2.5} fill="url(#revenueGradient)" dot={{ r: 3, fill: '#a855f7', stroke: '#1e293b', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#a855f7', stroke: '#fff', strokeWidth: 2 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* 收入查询面板 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                {/* 查询特定日期 */}
                                <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Calendar className="w-4 h-4 text-blue-400" />
                                        <span className="text-white font-medium text-sm">查询特定日期收入</span>
                                    </div>
                                    <div className="flex gap-2 mb-4">
                                        <input type="date" value={queryDate} onChange={(e) => setQueryDate(e.target.value)}
                                            className="flex-1 h-9 px-3 rounded-xl border border-white/10 bg-slate-900/60 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" />
                                        <Button onClick={handleQueryDate} disabled={queryLoading || !queryDate}
                                            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm cursor-pointer">
                                            {queryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '查询'}
                                        </Button>
                                    </div>
                                    {queryDateRevenue && (
                                        <div className="space-y-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                            <div className="text-2xl font-bold text-blue-400">¥{(queryDateRevenue.amount / 100).toFixed(2)}</div>
                                            {queryDateRevenue.planBreakdown.length > 0 && (
                                                <div className="text-xs text-slate-400 space-y-1">
                                                    {queryDateRevenue.planBreakdown.map((plan, idx) => (
                                                        <div key={idx}>{plan.planName}: {plan.count}笔 · ¥{(plan.amount / 100).toFixed(2)}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* 查询特定月份 */}
                                <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Calendar className="w-4 h-4 text-green-400" />
                                        <span className="text-white font-medium text-sm">查询特定月份收入</span>
                                    </div>
                                    <div className="flex gap-2 mb-4">
                                        <input type="month" value={queryMonth} onChange={(e) => setQueryMonth(e.target.value)}
                                            className="flex-1 h-9 px-3 rounded-xl border border-white/10 bg-slate-900/60 text-sm text-white focus:outline-none focus:border-green-500 transition-colors" />
                                        <Button onClick={handleQueryMonth} disabled={queryLoading || !queryMonth}
                                            className="h-9 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm cursor-pointer">
                                            {queryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '查询'}
                                        </Button>
                                    </div>
                                    {queryMonthRevenue && (
                                        <div className="space-y-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                            <div className="text-2xl font-bold text-green-400">¥{(queryMonthRevenue.amount / 100).toFixed(2)}</div>
                                            {queryMonthRevenue.planBreakdown.length > 0 && (
                                                <div className="text-xs text-slate-400 space-y-1 max-h-32 overflow-y-auto">
                                                    {queryMonthRevenue.planBreakdown.map((plan, idx) => (
                                                        <div key={idx}>{plan.planName}: {plan.count}笔 · ¥{(plan.amount / 100).toFixed(2)}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ==================== Filter Bar ==================== */}
                            <div className="flex flex-wrap items-center gap-3 mb-6">
                                <Filter className="w-4 h-4 text-slate-400" />
                                <div className="flex rounded-xl overflow-hidden border border-white/10 bg-slate-900/60">
                                    {statusOptions.map((opt) => (
                                        <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
                                            className={`px-4 py-2 text-sm transition-colors cursor-pointer ${statusFilter === opt.value ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <CalendarRange className="w-4 h-4 text-slate-400" />
                                    <input type="date" value={manualStart} onChange={(e) => setManualStart(e.target.value)}
                                        className="h-9 px-3 rounded-xl border border-white/10 bg-slate-900/60 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors" />
                                    <span className="text-slate-500 text-sm">至</span>
                                    <input type="date" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)}
                                        className="h-9 px-3 rounded-xl border border-white/10 bg-slate-900/60 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors" />
                                    {isManualFilter && (
                                        <button onClick={() => { setManualStart(''); setManualEnd('') }}
                                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                                            <X className="w-3 h-3" />清除
                                        </button>
                                    )}
                                </div>
                                {!isManualFilter && windowStart && windowEnd && !loading && (
                                    <div className="text-xs text-slate-500 ml-auto">
                                        当前窗口 {windowStart} 至 {windowEnd}
                                    </div>
                                )}
                            </div>

                            {/* ==================== Order Timeline ==================== */}
                            {loading ? (
                                <div className="space-y-6">
                                    {Array.from({ length: 3 }).map((_, gi) => (
                                        <div key={gi} className="space-y-3">
                                            <Skeleton className="h-10 w-72 bg-white/10 rounded-xl" />
                                            {Array.from({ length: 3 }).map((_, i) => (
                                                <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-slate-900/40 ml-6">
                                                    <Skeleton className="w-9 h-9 rounded-full bg-white/10" />
                                                    <div className="flex-1 space-y-2">
                                                        <Skeleton className="h-4 w-1/4 bg-white/10" />
                                                        <Skeleton className="h-3 w-1/3 bg-white/10" />
                                                    </div>
                                                    <Skeleton className="h-5 w-14 bg-white/10 rounded-full" />
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : empty ? (
                                <div className="rounded-3xl p-10 border border-white/10 bg-slate-900/40 text-center">
                                    <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                                        <Receipt className="w-7 h-7 text-purple-300" />
                                    </div>
                                    <div className="text-white font-semibold text-lg">暂无订单</div>
                                    <div className="text-slate-400 text-sm mt-2">
                                        {statusFilter !== 'all' || isManualFilter ? '没有符合筛选条件的订单' : '还没有任何订单记录'}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {dayGroups.map((group, gi) => {
                                        const isExpanded = expandedDays.has(group.dateKey)
                                        const toggleExpand = () => {
                                            setExpandedDays(prev => {
                                                const next = new Set(prev)
                                                if (next.has(group.dateKey)) {
                                                    next.delete(group.dateKey)
                                                } else {
                                                    next.add(group.dateKey)
                                                }
                                                return next
                                            })
                                        }

                                        return (
                                            <motion.div key={group.dateKey} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.04 }}>
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="flex-shrink-0 w-3 h-3 rounded-full bg-purple-500 ring-4 ring-purple-500/20" />
                                                    <button
                                                        onClick={toggleExpand}
                                                        className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-2.5 rounded-xl bg-slate-800/60 border border-white/5 hover:bg-slate-800/80 transition-colors cursor-pointer text-left"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {isExpanded ? (
                                                                <ChevronDown className="w-4 h-4 text-purple-400" />
                                                            ) : (
                                                                <ChevronRight className="w-4 h-4 text-purple-400" />
                                                            )}
                                                            <Calendar className="w-4 h-4 text-purple-400" />
                                                            <span className="text-white font-medium text-sm">{group.label}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-sm ml-6 sm:ml-0">
                                                            <span className="text-emerald-400 font-semibold">¥{(group.totalAmount / 100).toFixed(2)}</span>
                                                            <span className="text-slate-500">{group.orderCount} 笔已支付订单</span>
                                                            <span className="text-slate-500 text-xs">({group.orders.length} 条记录)</span>
                                                        </div>
                                                    </button>
                                                </div>
                                                {isExpanded && (
                                                    <div className="ml-1.5 pl-5 border-l-2 border-purple-500/20 space-y-2">
                                                        {group.orders.map((order, idx) => (
                                                            <motion.div key={order.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }}
                                                                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl border border-white/5 bg-slate-900/30 hover:bg-slate-900/50 hover:border-white/10 transition-all">
                                                                <div className="flex items-center gap-3 sm:w-44 min-w-0">
                                                                    <Avatar className="w-8 h-8 flex-shrink-0">
                                                                        <AvatarImage src={order.user?.image || undefined} />
                                                                        <AvatarFallback className="bg-slate-800 text-white text-xs">
                                                                            {order.user?.username?.[0]?.toUpperCase() || <User className="w-3.5 h-3.5" />}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="min-w-0">
                                                                        <div className="text-white text-sm font-medium truncate">{order.user?.username || '未知用户'}</div>
                                                                        <div className="text-slate-500 text-xs truncate">{order.user?.email || order.user?.id?.slice(0, 8)}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="sm:w-40 min-w-0">
                                                                    <div className="text-white text-sm truncate">{order.planName}</div>
                                                                    <div className="text-slate-500 text-xs truncate">{order.outTradeNo}</div>
                                                                </div>
                                                                <div className="sm:w-28 text-left sm:text-center">
                                                                    <div className="text-white font-semibold">¥{(order.amount / 100).toFixed(2)}</div>
                                                                    <div className="text-xs text-slate-500">
                                                                        {order.totalCredits} 积分
                                                                        {order.channel && <span className="ml-1 text-blue-400">· {order.channel === 'WECHAT' ? '微信' : order.channel}</span>}
                                                                    </div>
                                                                </div>
                                                                <div className="sm:w-20 flex sm:justify-center">{getStatusBadge(order.status)}</div>
                                                                <div className="sm:flex-1 text-left sm:text-right">
                                                                    <div className="text-slate-400 text-sm">{formatTime(order.createdAt)}</div>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                )}
                                            </motion.div>
                                        )
                                    })}

                                    {/* Footer */}
                                    <div className="flex flex-col items-center gap-3 pt-4">
                                        {isManualFilter ? (
                                            <div className="text-slate-500 text-sm">已显示所选日期范围内的全部 {totalOrders} 条订单</div>
                                        ) : hasMore ? (
                                            <Button onClick={handleLoadMore} disabled={loadingMore} variant="outline" size="sm"
                                                className="border-white/10 bg-white/5 hover:bg-white/10 text-white gap-2 px-6 cursor-pointer disabled:opacity-50">
                                                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                                                {loadingMore ? '加载中...' : '加载更早的订单'}
                                            </Button>
                                        ) : (
                                            <div className="text-slate-500 text-sm">已加载全部订单</div>
                                        )}
                                        {!isManualFilter && <div className="text-slate-600 text-xs">已加载 {totalOrders} 条订单</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
