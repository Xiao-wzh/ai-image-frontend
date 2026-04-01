"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Check,
  CreditCard,
  Loader2,
  Gift,
  QrCode,
  X,
  RefreshCw,
  HelpCircle,
  Sparkles,
  ImagePlus,
  CalendarDays,
  Users,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  Clock,
} from "lucide-react"
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

// 积分权益说明数据
const CREDITS_BENEFITS = [
  {
    icon: ImagePlus,
    title: "AI 图片生成",
    description: "生成专业电商主图/详情页",
    cost: "约 2000 积分/次",
    highlight: true,
  },
  {
    icon: Sparkles,
    title: "图片智能编辑",
    description: "AI 局部重绘、替换背景",
    cost: "约 30 积分/次",
    highlight: false,
  },
  {
    icon: Shield,
    title: "水印处理",
    description: "添加/去除水印",
    cost: "约 100 积分/次",
    highlight: false,
  },
]

// 获取积分途径数据
const CREDITS_SOURCES = [
  {
    icon: Gift,
    title: "新用户注册",
    amount: "+600",
    description: "注册即送",
    color: "text-emerald-400",
  },
  {
    icon: Users,
    title: "邀请好友",
    amount: "+200",
    description: "每成功邀请一位",
    color: "text-blue-400",
  },
  {
    icon: CalendarDays,
    title: "限时活动",
    amount: "大量积分",
    description: "关注我们偶尔进行的限时活动",
    color: "text-purple-400",
  },
]

// 常见问题数据
const FAQ_ITEMS = [
  {
    question: "积分有什么用？",
    answer: "积分用于生成 AI 图片、图片编辑、水印处理等功能。每次使用功能会消耗相应积分。",
  },
  {
    question: "积分可以退款吗？",
    answer: "积分属于虚拟商品，一经充值使用，不支持退款。请根据实际需求合理充值。",
  },
  {
    question: "充值后积分多久到账？",
    answer: "微信扫码支付成功后，积分会实时自动到账。如遇到账延迟，请联系客服处理。",
  },
]

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

  // FAQ 展开状态
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

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

  // ================== 套餐选择页面 =================
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto border-white/10 bg-slate-900/95 backdrop-blur-xl p-0">
        {/* 头部 */}
        <DialogHeader className="p-8 pb-4 text-center border-b border-white/5">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-3 mb-4 mx-auto"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text">AI-Species</span>
          </motion.div>
          {/* <DialogTitle className="text-3xl font-bold text-white">充值积分</DialogTitle> */}
          <DialogDescription className="text-slate-400 max-w-md mx-auto mt-2">
            积分属于虚拟商品，一经充值使用，不支持退款


          </DialogDescription>
        </DialogHeader>

        <div className="p-8 pt-6 space-y-8">
          {/* ========== 积分权益说明 ========== */}
          {/* <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-white">积分能做什么？</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CREDITS_BENEFITS.map((benefit, index) => {
                const Icon = benefit.icon
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + index * 0.05 }}
                    className={cn(
                      "relative p-5 rounded-2xl border transition-all cursor-default",
                      benefit.highlight
                        ? "bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/30"
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    )}
                  >
                    {benefit.highlight && (
                      <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold rounded-full">
                        热门
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        benefit.highlight ? "bg-purple-500/20" : "bg-white/10"
                      )}>
                        <Icon className={cn("w-5 h-5", benefit.highlight ? "text-purple-400" : "text-slate-300")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white">{benefit.title}</h4>
                        <p className="text-sm text-slate-400 mt-0.5">{benefit.description}</p>
                        <p className="text-xs text-slate-500 mt-2">{benefit.cost}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.section> */}

          {/* ========== 套餐选择 ========== */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-semibold text-white">选择套餐</h3>
              </div>
              <span className="text-xs text-slate-500">套餐积分永久有效</span>
            </div>

            {isLoadingPlans ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {plans.map((plan, index) => {
                  // 计算性价比（每元积分）
                  const yuanPrice = plan.price / 100
                  const totalCredits = plan.credits + plan.giftCredits
                  const creditsPerYuan = Math.round(totalCredits / 2 *9)

                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.25 + index * 0.05 }}
                      onClick={() => setSelectedPlan(plan)}
                      className={cn(
                        "relative rounded-2xl p-5 border-2 transition-all duration-300 cursor-pointer group",
                        selectedPlan?.id === plan.id
                          ? "border-purple-500 bg-purple-500/10 shadow-2xl shadow-purple-500/20"
                          : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                      )}
                    >
                      {plan.isRecommend && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full shadow-lg whitespace-nowrap">
                          推荐
                        </div>
                      )}

                      {/* 积分数量 */}
                      <div className="text-center mb-3">
                        <div className="text-3xl font-bold gradient-text-alt">
                          {plan.credits.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">付费积分</div>
                      </div>

                      {/* 赠送积分 */}
                      {plan.giftCredits > 0 && (
                        <div className="flex items-center justify-center gap-1 text-sm font-semibold text-emerald-400 mb-3">
                          <Gift className="w-3.5 h-3.5" />
                          <span>+{plan.giftCredits.toLocaleString()} 赠送</span>
                        </div>
                      )}

                      {/* 总计 */}
                      <div className="text-center py-2 border-t border-white/10 mb-3">
                        {/* <div className="text-xs text-slate-500">总计</div>
                        <div className="text-lg font-semibold text-white">
                          {(plan.credits + plan.giftCredits).toLocaleString()}
                        </div> */}
                      </div>

                      {/* 价格 */}
                      <div className="text-center mb-3">
                        <div className="text-xl font-bold text-white">
                          ¥ {formatPrice(plan.price)}
                        </div>
                        {/* <div className="text-xs text-slate-500 mt-0.5">
                          约 {creditsPerYuan} 张图
                        </div> */}
                      </div>

                      {/* 选中标记 */}
                      {selectedPlan?.id === plan.id && (
                        <motion.div
                          layoutId="selected-check"
                          className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center"
                        >
                          <Check className="w-4 h-4 text-white" />
                        </motion.div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.section>

          {/* ========== 支付方式 ========== */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">支付方式</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 微信支付 */}
              <Button
                onClick={() => initiatePayment(true)}
                disabled={isPaying || !selectedPlan}
                className="h-14 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold text-lg shadow-lg shadow-emerald-500/30 transition-all hover:shadow-emerald-500/50"
              >
                {isPaying ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <QrCode className="w-5 h-5 mr-2" />
                )}
                微信扫码支付
              </Button>

              {/* 支付宝支付 */}
              <Button
                onClick={() => toast.info("支付宝支付功能暂未开通")}
                disabled={true}
                className="h-14 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold text-lg shadow-lg opacity-60"
              >
                <QrCode className="w-5 h-5 mr-2" />
                支付宝支付（暂未开通）
              </Button>
            </div>
          </motion.section>

          {/* 分割线 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-slate-900 text-sm text-slate-500">或</span>
            </div>
          </div>

          {/* ========== 卡密兑换 ========== */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-white">兑换卡密</h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              如果您已购买卡密，可在此处兑换，积分将自动到账
            </p>

            <div className="flex gap-3">
              <input
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value)}
                placeholder="请输入卡密"
                className="flex-1 h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <Button
                onClick={handleRedeem}
                disabled={isRedeeming}
                className="h-12 px-6 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold"
              >
                {isRedeeming ? <Loader2 className="w-5 h-5 animate-spin" /> : "立即兑换"}
              </Button>
            </div>
          </motion.section>

          {/* ========== 获取积分途径 ========== */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">免费获取积分</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CREDITS_SOURCES.map((source, index) => {
                const Icon = source.icon
                return (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <Icon className={cn("w-5 h-5", source.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{source.title}</span>
                        <span className={cn("text-sm font-bold", source.color)}>{source.amount}</span>
                      </div>
                      <p className="text-xs text-slate-500">{source.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.section>

          {/* ========== 常见问题 ========== */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-semibold text-white">常见问题</h3>
            </div>
            <div className="space-y-2">
              {FAQ_ITEMS.map((faq, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-white/10 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                    className="w-full flex items-center justify-between p-4 text-left bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-white">{faq.question}</span>
                    {expandedFaq === index ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  <AnimatePresence>
                    {expandedFaq === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="p-4 pt-0 text-sm text-slate-400">{faq.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.section>

          {/* 底部提示 */}
          <div className="text-center pt-4 border-t border-white/5">
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              积分属于虚拟商品，一经充值使用，不支持退款
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
