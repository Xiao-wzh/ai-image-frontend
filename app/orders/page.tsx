"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Receipt, RefreshCw, ChevronLeft, ChevronRight, CreditCard, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
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

function isOrderPayable(order: Order): boolean {
    // 状态必须是待支付
    if (!['PENDING', 'PAYING', 'CREATED'].includes(order.status)) return false

    // 检查是否过期（30分钟）
    if (order.expiredAt) {
        return new Date(order.expiredAt) > new Date()
    }

    // 如果没有 expiredAt，用创建时间 + 30 分钟判断
    const createdAt = new Date(order.createdAt)
    const expireTime = new Date(createdAt.getTime() + 120 * 60 * 1000)
    return expireTime > new Date()
}

export default function OrdersPage() {
    const router = useRouter()
    const { update } = useSession()
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)

    // 支付弹窗状态
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

    // 按钮加载状态（用orderId作为key）
    const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null)
    const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null)

    const limit = 10

    const fetchOrders = useCallback(async (pageNum: number) => {
        try {
            setLoading(true)
            const res = await fetch(`/api/orders?limit=${limit}&offset=${(pageNum - 1) * limit}`)
            const data = await res.json()
            if (data.success) {
                setOrders(data.data)
                setTotal(data.pagination.total)
            }
        } catch (e) {
            console.error("获取订单失败", e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchOrders(page)
    }, [page, fetchOrders])

    const handleContinuePay = (order: Order) => {
        if (loadingOrderId || checkingOrderId) return // 防抖
        setLoadingOrderId(order.id)
        setSelectedOrder(order)
        setPaymentDialogOpen(true)
        // 弹窗打开后清除loading
        setTimeout(() => setLoadingOrderId(null), 500)
    }

    // 查询支付状态（我已支付）
    const handleCheckPaid = async (order: Order) => {
        if (loadingOrderId || checkingOrderId) return // 防抖
        setCheckingOrderId(order.id)

        try {
            const res = await fetch(`/api/pay/order/${order.outTradeNo}`)
            const data = await res.json()

            if (data.data?.status === 'PAID') {
                toast.success('🎉 支付成功！积分已到账')
                await update() // 刷新session
                fetchOrders(page) // 刷新订单列表
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
        fetchOrders(page) // 刷新订单列表
    }

    const totalPages = Math.ceil(total / limit) || 1
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
                                        查看您的充值订单记录，待支付的订单可以继续完成支付。
                                    </p>
                                </div>

                                <Button
                                    onClick={() => fetchOrders(page)}
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
                                        您还没有任何充值订单
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        {orders.map((order, idx) => (
                                            <motion.div
                                                key={order.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-slate-900/40 hover:bg-slate-900/60 transition-all"
                                            >
                                                {/* Icon */}
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                    <CreditCard className="w-6 h-6 text-emerald-400" />
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-medium truncate">
                                                            {order.planName}
                                                        </span>
                                                        {getStatusBadge(order.status)}
                                                    </div>
                                                    <div className="text-slate-400 text-sm mt-1">
                                                        {order.credits > 0 && (
                                                            <span className="mr-3">
                                                                积分: {order.credits}
                                                                {order.giftCredits > 0 && ` + ${order.giftCredits}`}
                                                            </span>
                                                        )}
                                                        <span className="text-slate-500">
                                                            {formatTime(order.createdAt)}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                                                        {order.outTradeNo}
                                                    </div>
                                                </div>

                                                {/* Amount & Action */}
                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    <div className="text-right">
                                                        <div className="text-lg font-bold text-white">
                                                            ¥{formatPrice(order.amount)}
                                                        </div>
                                                    </div>

                                                    {isOrderPayable(order) && (
                                                        <Button
                                                            onClick={() => handleContinuePay(order)}
                                                            disabled={loadingOrderId === order.id || checkingOrderId === order.id}
                                                            size="sm"
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                        >
                                                            {loadingOrderId === order.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                '继续支付'
                                                            )}
                                                        </Button>
                                                    )}
                                                    {/* 向微信查询用户是否支付成功 */}
                                                    {['PENDING', 'PAYING', 'CREATED'].includes(order.status) && (
                                                        <Button
                                                            onClick={() => handleCheckPaid(order)}
                                                            disabled={loadingOrderId === order.id || checkingOrderId === order.id}
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
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
