"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, Check, Crown, CreditCard, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

const tiers = [
  { id: "tier_30", price: 30, credits: 3000, label: "入门" },
  { id: "tier_100", price: 100, credits: 10000, label: "热销" },
  { id: "tier_300", price: 300, credits: 30000, label: "专业" },
  { id: "tier_1000", price: 1000, credits: 100000, label: "旗舰" },
]

const paymentMethods = [
  { id: "wechat", name: "微信支付", icon: "/wechat-pay.svg" },
  { id: "alipay", name: "支付宝", icon: "/alipay.svg" },
]

interface PricingModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const [selectedTier, setSelectedTier] = useState(tiers[1])
  const [selectedPayment, setSelectedPayment] = useState(paymentMethods[0])
  const [isLoading, setIsLoading] = useState(false)

  const handlePayment = async () => {
    setIsLoading(true)
    // 模拟支付流程
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsLoading(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
            <span className="text-2xl font-bold gradient-text">
              Sexyspecies
            </span>
          </motion.div>
          <DialogTitle className="text-3xl font-bold text-white">
            充值积分
          </DialogTitle>
          <DialogDescription className="text-slate-400 max-w-md mx-auto">
            1元 = 100积分，多充多得
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 pt-4">
          {/* Tiers */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {tiers.map((tier) => (
              <motion.div
                key={tier.id}
                onClick={() => setSelectedTier(tier)}
                className={cn(
                  "relative rounded-2xl p-6 border-2 transition-all duration-300 cursor-pointer",
                  selectedTier.id === tier.id
                    ? "border-purple-500 bg-purple-500/10 shadow-2xl shadow-purple-500/30"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                )}
                whileHover={{ y: -5 }}
              >
                {tier.label === "热销" && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full shadow-lg">
                    推荐
                  </div>
                )}
                <div className="text-4xl font-bold gradient-text-alt">
                  {tier.credits.toLocaleString()}
                </div>
                <div className="text-slate-400 text-sm mb-4">积分</div>
                <div className="text-xl font-semibold text-white">
                  ¥ {tier.price}
                </div>
                {selectedTier.id === tier.id && (
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

          {/* Payment Method */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">选择支付方式</h3>
            <div className="flex gap-4">
              {paymentMethods.map((method) => (
                <motion.div
                  key={method.id}
                  onClick={() => setSelectedPayment(method)}
                  className={cn(
                    "relative flex-1 rounded-2xl p-4 border-2 transition-all duration-300 cursor-pointer flex items-center gap-3",
                    selectedPayment.id === method.id
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                  whileHover={{ y: -3 }}
                >
                  <img src={method.icon} alt={method.name} className="w-8 h-8" />
                  <span className="text-white font-medium">{method.name}</span>
                  {selectedPayment.id === method.id && (
                    <motion.div
                      layoutId="payment-check"
                      className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-white" />
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Purchase Button */}
          <Button
            onClick={handlePayment}
            disabled={isLoading}
            className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white font-semibold text-lg shadow-lg shadow-purple-500/50 transition-all group"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <span>立即支付 ¥{selectedTier.price}</span>
                <span className="ml-2">→</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
