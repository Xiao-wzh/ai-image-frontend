"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Receipt, RefreshCw, ChevronLeft, ChevronRight, CreditCard, CheckCircle, Clock, XCircle, User, Filter, Calendar } from "lucide-react"
import { useRouter } from "next/navigation"

import { Sidebar } from "@/components/sidebar"
import { TopBanner } from "@/components/top-banner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

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

interface Stats {
    [key: string]: { count: number; amount: number }
}

function formatPrice(fen: number): string {
    const yuan = fen / 100
    return yuan % 1 === 0 ? yuan.toFixed(0) : yuan.toFixed(2)
}

function formatTime(isoString: string): string {
    return new Date(isoString).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'PAID':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle className="w-3 h-3" />
                    已支付
                </span>
            )
        case 'PENDING':
        case 'PAYING':
        case 'CREATED':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    <Clock className="w-3 h-3" />
                    待支付
                </span>
            )
        case 'CLOSED':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">
                    <XCircle className="w-3 h-3" />
                    已关闭
                </span>
            )
        default:
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">
                    {status}
                </span>
            )
    }
}

type StatusFilter = 'all' | 'PAID' | 'PAYING' | 'CLOSED'

export default function AdminOrdersPage() {
    const router = useRouter()
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [stats, setStats] = useState<Stats>({})
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [dailyRevenue, setDailyRevenue] = useState<{ today: number; yesterday: number }>({ today: 0, yesterday: 0 })
    const [dateFilter, setDateFilter] = useState<string>('') // YYYY-MM-DD

    const limit = 20

    const fetchOrders = useCallback(async (pageNum: number, status: StatusFilter, date?: string) => {
        try {
            setLoading(true)
            const params = new URLSearchParams({
                limit: String(limit),
                offset: String((pageNum - 1) * limit),
            })
            if (status !== 'all') {
                params.set('status', status)
            }
            if (date) {
                params.set('date', date)
            }

            const res = await fetch(`/api/admin/orders?${params.toString()}`)
            if (res.status === 403) {
                router.push('/')
                return
            }
            const data = await res.json()
            if (data.success) {
                setOrders(data.data)
                setTotal(data.pagination.total)
                setStats(data.stats || {})
                if (data.dailyRevenue) {
                    setDailyRevenue(data.dailyRevenue)
                }
            }
        } catch (e) {
            console.error("获取订单失败", e)
        } finally {
            setLoading(false)
        }
    }, [router])

    useEffect(() => {
        fetchOrders(page, statusFilter, dateFilter)
    }, [page, statusFilter, dateFilter, fetchOrders])

    const totalPages = Math.ceil(total / limit) || 1
    const empty = !loading && orders.length === 0

    // 统计卡片
    const paidStats = stats['PAID'] || { count: 0, amount: 0 }
    const pendingStats = stats['PAYING'] || { count: 0, amount: 0 }

    const statusOptions: { value: StatusFilter; label: string }[] = [
        { value: 'all', label: '全部' },
        { value: 'PAID', label: '已支付' },
        { value: 'PAYING', label: '待支付' },
        { value: 'CLOSED', label: '已关闭' },
    ]

    return (
        <div className="flex h-screen bg-slate-950">
            <Sidebar />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <TopBanner />
                <main className="flex-1 overflow-y-auto min-w-0">
                    <div className="relative pt-10 pb-8 px-8 min-w-0">
                        {/* Aurora gradient background */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute -top-10 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
                            <div className="absolute top-10 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
                        </div>

                        <div className="relative max-w-6xl mx-auto min-w-0">
                            {/* Header */}
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 min-w-0">
                                <div className="min-w-0">
                                    <h1 className="text-3xl md:text-4xl font-bold text-white">订单管理</h1>
                                    <p className="text-slate-400 mt-2 text-sm">
                                        查看和管理平台所有充值订单
                                    </p>
                                </div>

                                <Button
                                    onClick={() => fetchOrders(page, statusFilter, dateFilter)}
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    刷新
                                </Button>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/40">
                                    <div className="text-slate-400 text-sm">已支付订单</div>
                                    <div className="text-2xl font-bold text-white mt-1">{paidStats.count}</div>
                                    <div className="text-emerald-400 text-sm">¥{formatPrice(paidStats.amount)}</div>
                                </div>
                                <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/40">
                                    <div className="text-slate-400 text-sm">待支付订单</div>
                                    <div className="text-2xl font-bold text-white mt-1">{pendingStats.count}</div>
                                    <div className="text-yellow-400 text-sm">¥{formatPrice(pendingStats.amount)}</div>
                                </div>
                                <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/40">
                                    <div className="text-slate-400 text-sm">订单总数</div>
                                    <div className="text-2xl font-bold text-white mt-1">{total}</div>
                                </div>
                                <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/40">
                                    <div className="text-slate-400 text-sm">今日收入</div>
                                    <div className="text-2xl font-bold text-emerald-400 mt-1">
                                        ¥{formatPrice(dailyRevenue.today)}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                        昨日: ¥{formatPrice(dailyRevenue.yesterday)}
                                    </div>
                                </div>
                            </div>

                            {/* Filter */}
                            <div className="flex flex-wrap items-center gap-3 mb-6">
                                <Filter className="w-4 h-4 text-slate-400" />
                                <div className="flex rounded-xl overflow-hidden border border-white/10 bg-slate-900/60">
                                    {statusOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => {
                                                setStatusFilter(opt.value)
                                                setPage(1)
                                            }}
                                            className={`px-4 py-2 text-sm transition-all ${statusFilter === opt.value
                                                ? "bg-purple-600 text-white"
                                                : "text-slate-400 hover:text-white hover:bg-white/5"
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Date Filter */}
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <input
                                        type="date"
                                        value={dateFilter}
                                        onChange={(e) => {
                                            setDateFilter(e.target.value)
                                            setPage(1)
                                        }}
                                        className="h-9 px-3 rounded-xl border border-white/10 bg-slate-900/60 text-sm text-white focus:outline-none focus:border-purple-500"
                                    />
                                    {dateFilter && (
                                        <button
                                            onClick={() => setDateFilter('')}
                                            className="text-xs text-slate-400 hover:text-white px-2 py-1"
                                        >
                                            清除
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Order Table */}
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-slate-900/40"
                                        >
                                            <Skeleton className="w-10 h-10 rounded-full bg-white/10" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-1/4 bg-white/10" />
                                                <Skeleton className="h-3 w-1/3 bg-white/10" />
                                            </div>
                                            <Skeleton className="h-6 w-16 bg-white/10 rounded-full" />
                                            <Skeleton className="h-4 w-16 bg-white/10" />
                                        </div>
                                    ))}
                                </div>
                            ) : empty ? (
                                <div className="glass rounded-3xl p-10 border border-white/10 text-center">
                                    <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                                        <Receipt className="w-7 h-7 text-purple-300" />
                                    </div>
                                    <div className="text-white font-semibold text-lg">暂无订单</div>
                                    <div className="text-slate-400 text-sm mt-2">
                                        {statusFilter !== 'all' ? '没有符合筛选条件的订单' : '还没有任何订单记录'}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Table Header */}
                                    <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-sm text-slate-400 border-b border-white/10">
                                        <div className="col-span-3">用户</div>
                                        <div className="col-span-3">订单信息</div>
                                        <div className="col-span-2 text-center">金额</div>
                                        <div className="col-span-2 text-center">状态</div>
                                        <div className="col-span-2 text-right">时间</div>
                                    </div>

                                    <div className="space-y-2">
                                        {orders.map((order, idx) => (
                                            <motion.div
                                                key={order.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.02 }}
                                                className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 rounded-xl border border-white/10 bg-slate-900/40 hover:bg-slate-900/60 transition-all"
                                            >
                                                {/* User */}
                                                <div className="md:col-span-3 flex items-center gap-3">
                                                    <Avatar className="w-9 h-9">
                                                        <AvatarImage src={order.user?.image || undefined} />
                                                        <AvatarFallback className="bg-slate-800 text-white text-sm">
                                                            {order.user?.username?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <div className="text-white text-sm font-medium truncate">
                                                            {order.user?.username || '未知用户'}
                                                        </div>
                                                        <div className="text-slate-500 text-xs truncate">
                                                            {order.user?.email || order.user?.id?.slice(0, 8)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Order Info */}
                                                <div className="md:col-span-3 min-w-0">
                                                    <div className="text-white text-sm font-medium truncate">
                                                        {order.planName}
                                                    </div>
                                                    <div className="text-slate-500 text-xs truncate">
                                                        {order.outTradeNo}
                                                    </div>
                                                </div>

                                                {/* Amount */}
                                                <div className="md:col-span-2 text-center">
                                                    <div className="text-lg font-bold text-white">
                                                        ¥{formatPrice(order.amount)}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {order.totalCredits} 积分
                                                        {order.channel && (
                                                            <span className="ml-1 text-blue-400">· {order.channel === 'WECHAT' ? '微信' : order.channel}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Status */}
                                                <div className="md:col-span-2 flex justify-center">
                                                    {getStatusBadge(order.status)}
                                                </div>

                                                {/* Time */}
                                                <div className="md:col-span-2 text-right">
                                                    <div className="text-slate-400 text-sm">
                                                        {formatTime(order.createdAt)}
                                                    </div>
                                                    {order.paidAt && (
                                                        <div className="text-emerald-500 text-xs">
                                                            已支付
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between mt-8">
                                            <div className="text-sm text-slate-400">
                                                共 {total} 条记录，第 {page}/{totalPages} 页
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                                    disabled={page <= 1}
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-50"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                    上一页
                                                </Button>
                                                <Button
                                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                                    disabled={page >= totalPages}
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-50"
                                                >
                                                    下一页
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
