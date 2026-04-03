"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Receipt, RefreshCw, CreditCard, CheckCircle, Clock, XCircle, Loader2, ChevronDown, ChevronRight, Calendar } from "lucide-react"
import { toast } from "sonner"
import { useSession } from "next-auth/react"

import { Sidebar } from "@/components/sidebar"
import { TopBanner } from "@/components/top-banner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PaymentQrDialog } from "@/components/payment-qr-dialog"

interface Order {
    id: string
    outTradeNo: string
    amount: number
    status: string
    planName: string
    credits: number
    giftCredits: number
    paidAt: string | null
    createdAt: string
    expiredAt: string | null
}

interface OrderGroup {
    date: string // YYYY-MM-DD
    label: string // "今天" / "昨天" / 日期
    orders: Order[]
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

function getDateLabel(dateStr: string): string {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const isToday = date.toDateString() === today.toDateString()
    const isYesterday = date.toDateString() === yesterday.toDateString()

    if (isToday) return "今天"
    if (isYesterday) return "昨天"
    return date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" })
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

function isOrderPayable(order: Order): boolean {
    // 状态必须是待支付
    if (!['PENDING', 'PAYING', 'CREATED'].includes(order.status)) return false

    // 检查是否过期（120分钟）
    if (order.expiredAt) {
        return new Date(order.expiredAt) > new Date()
    }

    // 如果没有 expiredAt，用创建时间 + 120 分钟判断
    const createdAt = new Date(order.createdAt)
    const expireTime = new Date(createdAt.getTime() + 120 * 60 * 1000)
    return expireTime > new Date()
}

export default function OrdersPage() {
    const { update } = useSession()
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

    // 支付弹窗状态
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

    // 按钮加载状态
    const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null)
    const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null)

    const fetchOrders = useCallback(async () => {
        try {
            setLoading(true)
            // 获取足够多的数据来筛选两天
            const res = await fetch(`/api/orders?limit=100&offset=0`)
            const data = await res.json()
            if (data.success) {
                // 只保留最近两天的数据
                const now = new Date()
                const twoDaysAgo = new Date(now)
                twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
                twoDaysAgo.setHours(0, 0, 0, 0)

                const filteredOrders = (data.data || []).filter((order: Order) => {
                    return new Date(order.createdAt) >= twoDaysAgo
                })
                setOrders(filteredOrders)
            }
        } catch (e) {
            console.error("获取订单失败", e)
        } finally {
            setLoading(false)
        }
    }, [])

    // 按日期分组订单
    const orderGroups = useMemo((): OrderGroup[] => {
        const groups = new Map<string, Order[]>()

        orders.forEach(order => {
            const date = new Date(order.createdAt).toISOString().split('T')[0]
            if (!groups.has(date)) {
                groups.set(date, [])
            }
            groups.get(date)!.push(order)
        })

        // 转换为数组并按日期降序排序
        const result = Array.from(groups.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, orders]) => ({
                date,
                label: getDateLabel(date),
                orders,
            }))

        return result
    }, [orders])

    // 初始化：默认展开今天的订单
    useEffect(() => {
        fetchOrders()
    }, [fetchOrders])

    // 当订单数据加载完成后，默认展开今天
    useEffect(() => {
        if (orderGroups.length > 0 && expandedDates.size === 0) {
            const today = new Date().toISOString().split('T')[0]
            setExpandedDates(new Set([today]))
        }
    }, [orderGroups, expandedDates.size])

    const toggleDate = (date: string) => {
        setExpandedDates(prev => {
            const next = new Set(prev)
            if (next.has(date)) {
                next.delete(date)
            } else {
                next.add(date)
            }
            return next
        })
    }

    const handleContinuePay = (order: Order) => {
        if (loadingOrderId || checkingOrderId) return
        setLoadingOrderId(order.id)
        setSelectedOrder(order)
        setPaymentDialogOpen(true)
        setTimeout(() => setLoadingOrderId(null), 500)
    }

    const handleCheckPaid = async (order: Order) => {
        if (loadingOrderId || checkingOrderId) return
        setCheckingOrderId(order.id)

        try {
            const res = await fetch(`/api/pay/order/${order.outTradeNo}`)
            const data = await res.json()

            if (data.data?.status === 'PAID') {
                toast.success('🎉 支付成功！积分已到账')
                await update()
                fetchOrders()
            } else {
                toast.info('订单尚未支付成功，请完成支付后再试')
            }
        } catch (e) {
            toast.error('查询失败，请稍后重试')
        } finally {
            setCheckingOrderId(null)
        }
    }

    const handlePaymentSuccess = () => {
        fetchOrders()
    }

    const empty = !loading && orders.length === 0

    return (
        <div className="flex h-screen bg-slate-950">
            <Sidebar />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <TopBanner />
                <main className="flex-1 overflow-y-auto min-w-0">
                    <div className="relative pt-10 pb-8 px-8 min-w-0">
                        {/* Aurora gradient background */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute -top-10 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
                            <div className="absolute top-10 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                        </div>

                        <div className="relative max-w-4xl mx-auto min-w-0">
                            {/* Header */}
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 min-w-0">
                                <div className="min-w-0">
                                    <h1 className="text-3xl md:text-4xl font-bold text-white">充值记录</h1>
                                    <p className="text-slate-400 mt-2 text-sm">
                                        查看最近两天的充值订单，待支付的订单可以继续完成支付。
                                    </p>
                                </div>

                                <Button
                                    onClick={() => fetchOrders()}
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    刷新
                                </Button>
                            </div>

                            {/* Order List */}
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-slate-900/40"
                                        >
                                            <Skeleton className="w-12 h-12 rounded-xl bg-white/10" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-1/3 bg-white/10" />
                                                <Skeleton className="h-3 w-1/4 bg-white/10" />
                                            </div>
                                            <Skeleton className="h-8 w-20 bg-white/10 rounded-lg" />
                                        </div>
                                    ))}
                                </div>
                            ) : empty ? (
                                <div className="glass rounded-3xl p-10 border border-white/10 text-center">
                                    <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                                        <Receipt className="w-7 h-7 text-emerald-300" />
                                    </div>
                                    <div className="text-white font-semibold text-lg">暂无充值记录</div>
                                    <div className="text-slate-400 text-sm mt-2">
                                        最近两天没有任何充值订单
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {orderGroups.map((group) => {
                                        const isExpanded = expandedDates.has(group.date)

                                        return (
                                            <div key={group.date} className="glass rounded-2xl border border-white/10 overflow-hidden">
                                                {/* 日期头部 - 可点击展开/折叠 */}
                                                <button
                                                    onClick={() => toggleDate(group.date)}
                                                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
                                                            <Calendar className="w-5 h-5 text-emerald-400" />
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="text-white font-medium">{group.label}</div>
                                                            <div className="text-slate-400 text-sm">
                                                                {group.orders.length} 笔订单
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-slate-400 text-sm">
                                                            共 ¥{group.orders.reduce((sum, o) => sum + o.amount, 0) / 100}
                                                        </div>
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-5 h-5 text-slate-400" />
                                                        ) : (
                                                            <ChevronRight className="w-5 h-5 text-slate-400" />
                                                        )}
                                                    </div>
                                                </button>

                                                {/* 订单列表 - 可展开 */}
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="border-t border-white/10 divide-y divide-white/5">
                                                                {group.orders.map((order, idx) => (
                                                                    <motion.div
                                                                        key={order.id}
                                                                        initial={{ opacity: 0 }}
                                                                        animate={{ opacity: 1 }}
                                                                        transition={{ delay: idx * 0.03 }}
                                                                        className="flex items-center gap-4 p-4 hover:bg-white/5 transition-all"
                                                                    >
                                                                        {/* Icon */}
                                                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                                            <CreditCard className="w-5 h-5 text-emerald-400" />
                                                                        </div>

                                                                        {/* Info */}
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-white font-medium text-sm truncate">
                                                                                    {order.planName}
                                                                                </span>
                                                                                {getStatusBadge(order.status)}
                                                                            </div>
                                                                            <div className="text-slate-400 text-xs mt-1">
                                                                                {order.credits > 0 && (
                                                                                    <span className="mr-2">
                                                                                        积分: {order.credits}
                                                                                        {order.giftCredits > 0 && ` +${order.giftCredits}`}
                                                                                    </span>
                                                                                )}
                                                                                <span className="text-slate-500">
                                                                                    {formatTime(order.createdAt)}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Amount & Action */}
                                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                                            <div className="text-right">
                                                                                <div className="text-base font-bold text-white">
                                                                                    ¥{formatPrice(order.amount)}
                                                                                </div>
                                                                            </div>

                                                                            {isOrderPayable(order) && (
                                                                                <Button
                                                                                    onClick={(e) => { e.stopPropagation(); handleContinuePay(order) }}
                                                                                    disabled={loadingOrderId === order.id || checkingOrderId === order.id}
                                                                                    size="sm"
                                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                                                                                >
                                                                                    {loadingOrderId === order.id ? (
                                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                                    ) : (
                                                                                        '继续支付'
                                                                                    )}
                                                                                </Button>
                                                                            )}
                                                                            {['PENDING', 'PAYING', 'CREATED'].includes(order.status) && (
                                                                                <Button
                                                                                    onClick={(e) => { e.stopPropagation(); handleCheckPaid(order) }}
                                                                                    disabled={loadingOrderId === order.id || checkingOrderId === order.id}
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white h-8"
                                                                                >
                                                                                    {checkingOrderId === order.id ? (
                                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                                    ) : (
                                                                                        '我已支付'
                                                                                    )}
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    </motion.div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Payment Dialog */}
            {selectedOrder && (
                <PaymentQrDialog
                    open={paymentDialogOpen}
                    onOpenChange={setPaymentDialogOpen}
                    orderId={selectedOrder.id}
                    outTradeNo={selectedOrder.outTradeNo}
                    amount={selectedOrder.amount}
                    planName={selectedOrder.planName}
                    onSuccess={handlePaymentSuccess}
                />
            )}
        </div>
    )
}
