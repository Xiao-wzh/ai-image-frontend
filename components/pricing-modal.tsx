"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion } from "framer-motion"
import { Check, CreditCard, Loader2, ExternalLink, Gift, QrCode, X, RefreshCw, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
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

const STORE_URL = "http://yunjishou.com/shop/5AE4JRCQ"
const POLL_INTERVAL = 3000 // 3秒轮询

/**
 * 格式化价格（分转元）
 * - 整数元：显示整数（如 30）
 * - 有分：显示两位小数（如 0.01）
 */
function formatPrice(fen: number): string {
  const yuan = fen / 100
  return yuan % 1 === 0 ? yuan.toFixed(0) : yuan.toFixed(2)
}

interface Plan {
  id: string
  name: string
  price: number
  credits: number
  giftCredits: number
  isRecommend: boolean
}

interface CurrentOrder {
  orderId: string
  outTradeNo: string
  amount: number
}

interface PricingModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const { data: session, update } = useSession()

  // 套餐列表
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)

  // 卡密兑换
  const [redeemCode, setRedeemCode] = useState("")
  const [isRedeeming, setIsRedeeming] = useState(false)

  // 支付状态
  const [step, setStep] = useState<'select' | 'pay'>('select')
  const [isPaying, setIsPaying] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder | null>(null)

  // 轮询定时器
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // ================== 状态重置 ==================
  const resetState = useCallback(() => {
    setStep('select')
    setQrCodeUrl(null)
    setCurrentOrder(null)
    setIsPaying(false)
    setIsRefreshing(false)
    // 清除轮询
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Dialog 关闭时重置状态
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      resetState()
      onClose()
    }
  }, [resetState, onClose])

  // ================== 加载套餐 ==================
  useEffect(() => {
    if (isOpen && step === 'select') {
      loadPlans()
    }
  }, [isOpen, step])

  const loadPlans = async () => {
    try {
      setIsLoadingPlans(true)
      const res = await fetch("/api/plans")
      const data = await res.json()
      if (data.success && data.data) {
        setPlans(data.data)
        const recommended = data.data.find((p: Plan) => p.isRecommend) || data.data[0]
        setSelectedPlan(recommended)
      }
    } catch (e) {
      console.error("加载套餐失败", e)
    } finally {
      setIsLoadingPlans(false)
    }
  }

  // ================== 轮询支付状态 ==================
  useEffect(() => {
    if (step === 'pay' && currentOrder?.outTradeNo) {
      // 开始轮询
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/pay/order/${currentOrder.outTradeNo}`)
          const data = await res.json()

          if (data.data?.status === 'PAID') {
            // 支付成功
            clearInterval(pollRef.current!)
            pollRef.current = null

            toast.success("🎉 支付成功！积分已到账")

            // 刷新 session
            await update()

            // 延迟关闭
            setTimeout(() => {
              resetState()
              onClose()
            }, 1500)
          }
        } catch (e) {
          console.error("轮询失败", e)
        }
      }, POLL_INTERVAL)
    }

    // 清理函数
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [step, currentOrder?.outTradeNo, update, resetState, onClose])

  // ================== 发起支付 ==================
  const initiatePayment = async (createNewOrder: boolean = true) => {
    if (!selectedPlan) {
      toast.error("请选择套餐")
      return
    }

    if (!session?.user) {
      toast.error("请先登录")
      return
    }

    try {
      let orderId = currentOrder?.orderId

      // 是否需要创建新订单
      if (createNewOrder || !orderId) {
        setIsPaying(true)

        const orderRes = await fetch("/api/orders/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: selectedPlan.id }),
        })

        const orderData = await orderRes.json()
        if (!orderRes.ok) {
          throw new Error(orderData?.error || "创建订单失败")
        }

        orderId = orderData.data.orderId
        setCurrentOrder({
          orderId: orderData.data.orderId,
          outTradeNo: orderData.data.outTradeNo,
          amount: orderData.data.amount,
        })
      } else {
        setIsRefreshing(true)
      }

      // 发起微信支付
      const payRes = await fetch("/api/pay/wechat/native", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })

      const payData = await payRes.json()
      if (!payRes.ok) {
        throw new Error(payData?.error || "发起支付失败")
      }

      // 生成二维码
      const qrDataUrl = await QRCode.toDataURL(payData.data.code_url, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      })

      setQrCodeUrl(qrDataUrl)
      setStep('pay')
    } catch (e: any) {
      toast.error(e?.message || "支付失败")
    } finally {
      setIsPaying(false)
      setIsRefreshing(false)
    }
  }

  // 刷新二维码（复用现有订单）
  const handleRefreshQrCode = () => {
    if (isRefreshing || isPaying) return
    initiatePayment(false) // 复用现有订单
  }

  // ================== 卡密兑换 ==================
  const handleRedeem = async () => {
    const code = redeemCode.trim()
    if (!code) {
      toast.error("请输入卡密")
      return
    }

    try {
      setIsRedeeming(true)
      const res = await fetch("/api/payment/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || `兑换失败: ${res.status}`)
      }

      toast.success(
        `兑换成功：+${data?.added?.credits ?? 0}` +
        ((data?.added?.bonusCredits ?? 0) > 0 ? `（赠送 ${data.added.bonusCredits}）` : ""),
      )

      if (typeof data?.balance?.credits === "number") {
        await update()
      }

      setRedeemCode("")
      resetState()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || "兑换失败")
    } finally {
      setIsRedeeming(false)
    }
  }

  const handleGoStore = () => {
    window.open(STORE_URL, "_blank")
  }

  // ================== 二维码支付页面 ==================
  if (step === 'pay' && qrCodeUrl && currentOrder) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md border-white/10 bg-slate-900/95 backdrop-blur-xl p-8">
          <DialogHeader className="text-center">
            <DialogTitle className="text-xl font-bold text-white">微信扫码支付</DialogTitle>
            <DialogDescription className="text-slate-400">
              请使用微信扫描二维码完成支付
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-6">
            {/* 二维码 */}
            <div className="relative p-4 bg-white rounded-xl">
              <img src={qrCodeUrl} alt="支付二维码" className="w-56 h-56" />
              {/* 轮询指示器 */}
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-500 rounded-full animate-pulse" />
            </div>

            {/* 金额信息 */}
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                ¥ {formatPrice(currentOrder.amount)}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                订单号: {currentOrder.outTradeNo}
              </div>
              <div className="text-xs text-emerald-500 mt-2 flex items-center justify-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                正在等待支付...
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 w-full">
              <Button
                onClick={() => {
                  resetState()
                }}
                variant="outline"
                className="flex-1 h-12 border-white/10 bg-white/5 hover:bg-white/10 text-white"
              >
                <X className="w-4 h-4 mr-2" />
                取消支付
              </Button>
              <Button
                onClick={handleRefreshQrCode}
                disabled={isRefreshing || isPaying}
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

  // ================== 套餐选择页面 ==================
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl border-white/10 bg-slate-900/95 backdrop-blur-xl p-0 overflow-hidden">
        <DialogHeader className="p-8 pb-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-3 mb-4 mx-auto"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg glow-blue">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text">AI-Species</span>
          </motion.div>
          <DialogTitle className="text-3xl font-bold text-white">充值积分</DialogTitle>
          <DialogDescription className="text-slate-400 max-w-md mx-auto">
            选择套餐后可直接扫码支付，或使用卡密兑换<br/>
            积分属于虚拟商品，一经充值使用，不支持退款。
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 pt-4">
          {/* 套餐列表 */}
          {isLoadingPlans ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {plans.map((plan) => (
                <motion.div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={cn(
                    "relative rounded-2xl p-6 border-2 transition-all duration-300 cursor-pointer",
                    selectedPlan?.id === plan.id
                      ? "border-purple-500 bg-purple-500/10 shadow-2xl shadow-purple-500/30"
                      : "border-white/10 bg-white/5 hover:bg-white/10",
                  )}
                  whileHover={{ y: -5 }}
                >
                  {plan.isRecommend && (
                    <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full shadow-lg">
                      推荐
                    </div>
                  )}

                  <div className="text-4xl font-bold gradient-text-alt">{plan.credits.toLocaleString()}</div>
                  <div className="text-slate-400 text-sm">付费积分</div>
                  {plan.giftCredits > 0 && (
                    <div className="mt-2 text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <Gift className="w-3.5 h-3.5" />
                      赠送 {plan.giftCredits.toLocaleString()}
                    </div>
                  )}

                  <div className="text-slate-400 text-sm mb-4">&nbsp;</div>

                  <div className="text-xl font-semibold text-white">¥ {formatPrice(plan.price)}</div>

                  {selectedPlan?.id === plan.id && (
                    <motion.div
                      layoutId="selected-check"
                      className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* 支付按钮 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* 微信支付 */}
            <Button
              onClick={() => initiatePayment(true)}
              disabled={isPaying || !selectedPlan}
              className="h-14 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold text-lg shadow-lg shadow-emerald-500/30 transition-all"
            >
              {isPaying ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <QrCode className="w-5 h-5 mr-2" />
              )}
              微信扫码支付
            </Button>

            {/* 支付宝支付 */}
            {/* // 不能点击，按钮右上角角标：暂未开通 */}
            <Button
              onClick={() => toast.info("支付宝支付功能暂未开通")}
              disabled={true}
              className="h-14 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 text-white font-semibold text-lg shadow-lg shadow-emerald-500/30 transition-all"
            >
              {isPaying ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <QrCode className="w-5 h-5 mr-2" />
              )}
              支付宝扫码支付(暂未开通)
            </Button>

            {/* <Button
              onClick={handleGoStore}
              variant="outline"
              className="h-14 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold text-lg"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              前往商店购买卡密
            </Button> */}
          </div>

          {/* 分割线 */}
          <div className="my-8 h-px bg-white/10" />

          {/* 卡密兑换 */}
          <div>
            <div className="text-white font-semibold mb-2">兑换卡密</div>
            <div className="text-xs text-slate-500 mb-4">请输入你的卡密，兑换后会自动到账。</div>

            <div className="flex gap-3">
              <input
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value)}
                placeholder="请输入卡密 / Enter Code"
                className="flex-1 h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <Button
                onClick={handleRedeem}
                disabled={isRedeeming}
                className="h-12 px-6 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10"
              >
                {isRedeeming ? <Loader2 className="w-5 h-5 animate-spin" /> : "立即兑换"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
