"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Loader2, X, RefreshCw, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import QRCode from "qrcode"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

const POLL_INTERVAL = 3000 // 3秒轮询

/**
 * 格式化价格（分转元）
 */
function formatPrice(fen: number): string {
    const yuan = fen / 100
    return yuan % 1 === 0 ? yuan.toFixed(0) : yuan.toFixed(2)
}

interface PaymentQrDialogProps {
    /** 是否打开 */
    open: boolean
    /** 关闭回调 */
    onOpenChange: (open: boolean) => void
    /** 订单 ID */
    orderId: string
    /** 商户订单号 */
    outTradeNo: string
    /** 金额（分） */
    amount: number
    /** 套餐名称 */
    planName?: string
    /** 支付成功回调 */
    onSuccess?: () => void
}

/**
 * 支付二维码弹窗组件
 * 
 * 独立的支付组件，用于"继续支付"等场景
 */
export function PaymentQrDialog({
    open,
    onOpenChange,
    orderId,
    outTradeNo,
    amount,
    planName,
    onSuccess,
}: PaymentQrDialogProps) {
    const { update } = useSession()

    const [isLoading, setIsLoading] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // 轮询定时器
    const pollRef = useRef<NodeJS.Timeout | null>(null)

    // 清理函数
    const cleanup = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
        }
        setQrCodeUrl(null)
        setError(null)
    }, [])

    // 获取支付二维码
    const fetchQrCode = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setIsLoading(true)
            else setIsRefreshing(true)
            setError(null)

            const res = await fetch("/api/pay/wechat/native", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId }),
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data?.error || "获取支付二维码失败")
            }

            // 生成二维码图片
            const qrDataUrl = await QRCode.toDataURL(data.data.code_url, {
                width: 256,
                margin: 2,
                color: { dark: "#000000", light: "#ffffff" },
            })

            setQrCodeUrl(qrDataUrl)
        } catch (e: any) {
            setError(e?.message || "获取二维码失败")
            toast.error(e?.message || "获取二维码失败")
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
        }
    }, [orderId])

    // 打开时获取二维码
    useEffect(() => {
        if (open && orderId) {
            fetchQrCode()
        }
        return cleanup
    }, [open, orderId, fetchQrCode, cleanup])

    // 轮询支付状态
    useEffect(() => {
        if (open && qrCodeUrl && outTradeNo) {
            pollRef.current = setInterval(async () => {
                try {
                    const res = await fetch(`/api/pay/order/${outTradeNo}`)
                    const data = await res.json()

                    if (data.data?.status === "PAID") {
                        clearInterval(pollRef.current!)
                        pollRef.current = null

                        toast.success("🎉 支付成功！积分已到账")

                        // 刷新 session
                        await update()

                        // 延迟关闭
                        setTimeout(() => {
                            cleanup()
                            onOpenChange(false)
                            onSuccess?.()
                        }, 1500)
                    }
                } catch (e) {
                    console.error("轮询失败", e)
                }
            }, POLL_INTERVAL)
        }

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current)
                pollRef.current = null
            }
        }
    }, [open, qrCodeUrl, outTradeNo, update, cleanup, onOpenChange, onSuccess])

    // 关闭时清理
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            cleanup()
        }
        onOpenChange(newOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md border-white/10 bg-slate-900/95 backdrop-blur-xl p-8">
                <DialogHeader className="text-center">
                    <DialogTitle className="text-xl font-bold text-white">微信扫码支付</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        {planName ? `购买: ${planName}` : "请使用微信扫描二维码完成支付"}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center gap-6 py-6">
                    {/* 二维码区域 */}
                    <div className="relative p-4 bg-white rounded-xl min-h-[240px] min-w-[240px] flex items-center justify-center">
                        {isLoading ? (
                            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                        ) : error ? (
                            <div className="text-center text-red-500 text-sm p-4">
                                {error}
                            </div>
                        ) : qrCodeUrl ? (
                            <>
                                <img src={qrCodeUrl} alt="支付二维码" className="w-56 h-56" />
                                {/* 轮询指示器 */}
                                <div className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-500 rounded-full animate-pulse" />
                            </>
                        ) : null}
                    </div>

                    {/* 金额信息 */}
                    <div className="text-center">
                        <div className="text-2xl font-bold text-white">
                            ¥ {formatPrice(amount)}
                        </div>
                        <div className="text-sm text-slate-400 mt-1">
                            订单号: {outTradeNo}
                        </div>
                        {qrCodeUrl && (
                            <div className="text-xs text-emerald-500 mt-2 flex items-center justify-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                正在等待支付...
                            </div>
                        )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-3 w-full">
                        <Button
                            onClick={() => handleOpenChange(false)}
                            variant="outline"
                            className="flex-1 h-12 border-white/10 bg-white/5 hover:bg-white/10 text-white"
                        >
                            <X className="w-4 h-4 mr-2" />
                            取消支付
                        </Button>
                        <Button
                            onClick={() => fetchQrCode(false)}
                            disabled={isRefreshing || isLoading}
                            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isRefreshing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            刷新二维码
                        </Button>
                    </div>

                    {/* 帮助提示 */}
                    <div className="text-xs text-slate-500 text-center space-y-1">
                        <div>支付成功后会自动跳转，无需手动刷新</div>
                        <div className="flex items-center justify-center gap-1 text-slate-600">
                            <HelpCircle className="w-3 h-3" />
                            支付遇到问题？请联系客服
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
