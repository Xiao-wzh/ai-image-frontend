"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Gift } from "lucide-react"
import { ReferralCampaignModal } from "./referral-campaign-modal"

/**
 * ActivityFAB — 活动全局悬浮入口
 * 位于页面右下角（客服按钮上方），带呼吸灯发光效果
 */
export function ActivityFAB() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* 悬浮按钮 */}
      <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-2 select-none">
        {/* 气泡标签 */}
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0, x: 16, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 16, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="px-3 py-1.5 rounded-full text-xs font-bold text-white whitespace-nowrap
                bg-gradient-to-r from-violet-600 to-pink-600
                border border-purple-400/30
                shadow-[0_0_20px_rgba(168,85,247,0.4)]"
            >
              邀请赢 50% 返利
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB 按钮主体 */}
        <div className="relative">
          {/* 呼吸灯外圈 1 */}
          <motion.div
            className="absolute inset-0 rounded-full bg-purple-500/30 pointer-events-none"
            animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
          />
          {/* 呼吸灯外圈 2（错位） */}
          <motion.div
            className="absolute inset-0 rounded-full bg-purple-500/20 pointer-events-none"
            animate={{ scale: [1, 1.9, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
          />

          {/* 主按钮 */}
          <motion.button
            onClick={() => setIsOpen(true)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            className="relative w-14 h-14 rounded-full cursor-pointer
              bg-gradient-to-br from-violet-600 to-pink-600
              border border-purple-400/40
              shadow-[0_0_24px_rgba(168,85,247,0.55)]
              hover:shadow-[0_0_36px_rgba(168,85,247,0.7)]
              flex items-center justify-center
              transition-shadow duration-300"
            aria-label="打开拉新活动"
          >
            {/* 内部光泽层 */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/15 pointer-events-none" />
            <Gift className="w-6 h-6 text-white relative" />
          </motion.button>
        </div>
      </div>

      {/* 活动主弹窗 */}
      <ReferralCampaignModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}
