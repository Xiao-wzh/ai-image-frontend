"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, Check, Crown } from "lucide-react"
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
  { rmb: 30, credits: 3000, popular: false },
  { rmb: 100, credits: 10000, popular: true },
  { rmb: 300, credits: 30000, popular: false },
  { rmb: 1000, credits: 100000, popular: false },
]

interface PricingModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const [selectedTier, setSelectedTier] = useState(tiers[1])

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
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text">
              Sexyspecies
            </span>
          </motion.div>
          <DialogTitle className="text-3xl font-bold text-white">
            选择充值套餐
          </DialogTitle>
          <DialogDescription className="text-slate-400 max-w-md mx-auto">
            1 元 = 100 积分。选择一个适合您的套餐，开始您的 AI 创作之旅。
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 pt-4">
          {/* Tiers */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {tiers.map((tier) => (
              <motion.div
                key={tier.rmb}
                onClick={() => setSelectedTier(tier)}
                className={cn(
                  "relative rounded-2xl p-6 border-2 transition-all duration-300 cursor-pointer",
                  selectedTier.rmb === tier.rmb
                    ? "border-purple-500 bg-purple-500/10 shadow-2xl shadow-purple-500/30"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                )}
                whileHover={{ y: -5 }}
              >
                {tier.popular && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full shadow-lg">
                    推荐
                  </div>
                )}
                <div className="text-4xl font-bold gradient-text-alt">
                  {tier.credits.toLocaleString()}
                </div>
                <div className="text-slate-400 text-sm mb-4">积分</div>
                <div className="text-xl font-semibold text-white">
                  ¥ {tier.rmb}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Purchase Button */}
          <Button
            className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white font-semibold text-lg shadow-lg shadow-purple-500/50 transition-all group"
          >
            立即支付 ¥{selectedTier.rmb}
            <span className="ml-2">→</span>
          </Button>

          {/* Features */}
          <div className="mt-8 text-center text-slate-400 text-sm">
            <p className="mb-4">所有套餐均包含：</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {[
                "无限次生成",
                "高清图片下载",
                "优先访问新模型",
                "专属社区访问",
                "商业使用权",
                "24/7 技术支持",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

