"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Check, CreditCard, Loader2, ExternalLink, Gift } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

// const STORE_URL = "http://yunjishou.com/shop/B0L04JL9"
const STORE_URL = "http://yunjishou.com/shop/5AE4JRCQ"

const tiers = [
  { id: "tier_30", price: 30, credits: 3000, bonus: 0, label: "入门" },
  { id: "tier_100", price: 100, credits: 10000, bonus: 300, label: "热销" },
  { id: "tier_300", price: 300, credits: 30000, bonus: 1000, label: "专业" },
  { id: "tier_1000", price: 1000, credits: 100000, bonus: 5000, label: "旗舰" },
]

interface PricingModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const { data: session, update } = useSession()

  const [selectedTier, setSelectedTier] = useState(tiers[1])
  const [redeemCode, setRedeemCode] = useState("")
  const [isRedeeming, setIsRedeeming] = useState(false)

  const handleGoStore = () => {
    window.open(STORE_URL, "_blank")
  }

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

      // 同步 session 余额
      if (typeof data?.balance?.credits === "number" && typeof data?.balance?.bonusCredits === "number") {
        await update({
          ...session,
          user: {
            ...(session?.user || {}),
            credits: data.balance.credits,
            bonusCredits: data.balance.bonusCredits,
          },
        })
      }

      setRedeemCode("")
      onClose()
    } catch (e: any) {
      toast.error(e?.message || "兑换失败")
    } finally {
      setIsRedeeming(false)
    }
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
            <span className="text-2xl font-bold gradient-text">Sexyspecies</span>
          </motion.div>
          <DialogTitle className="text-3xl font-bold text-white">充值积分</DialogTitle>
          <DialogDescription className="text-slate-400 max-w-md mx-auto">
            选择档位后前往商店购买卡密，再回来输入卡密兑换
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
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                )}
                whileHover={{ y: -5 }}
              >
                {tier.label === "热销" && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full shadow-lg">
                    推荐
                  </div>
                )}

                <div className="text-4xl font-bold gradient-text-alt">{tier.credits.toLocaleString()}</div>
                <div className="text-slate-400 text-sm">付费积分</div>
                {tier.bonus > 0 && (
                  <div className="mt-2 text-xs font-semibold text-emerald-400 flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5" />
                    赠送 {tier.bonus.toLocaleString()}
                  </div>
                )}

                <div className="text-slate-400 text-sm mb-4">&nbsp;</div>

                <div className="text-xl font-semibold text-white">¥ {tier.price}</div>

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

          {/* Go Store */}
          <Button
            onClick={handleGoStore}
            className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white font-semibold text-lg shadow-lg shadow-purple-500/50 transition-all group"
          >
            <span>前往商店购买卡密</span>
            <ExternalLink className="w-5 h-5 ml-2" />
          </Button>

          {/* Divider */}
          <div className="my-8 h-px bg-white/10" />

          {/* Redeem */}
          <div>
            <div className="text-white font-semibold mb-2">兑换卡密</div>
            <div className="text-xs text-slate-500 mb-4">请输入你在商店购买的卡密，兑换后会自动到账。</div>

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
