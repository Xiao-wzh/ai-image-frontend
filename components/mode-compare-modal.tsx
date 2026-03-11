"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, Crown, X, Check, Minus } from "lucide-react"

interface ModeCompareModalProps {
  open: boolean
  onClose: () => void
}

// 对比数据行
const COMPARE_ROWS = [
  {
    dimension: "最佳适用场景",
    standard: "快速铺货 / 社交媒体发帖 / 测图测款",
    pro: "爆款精细化打磨 / 独立站视觉 / 高级品牌感（抖音、亚马逊、独立站等平台商品用pro模式效果更佳）",
    standardHighlight: false,
    proHighlight: false,
  },
  {
    dimension: "出图方式",
    standard: "主图9张，详情6张直出",
    pro: "并发生成多张独立高清 2K 大图",
    standardHighlight: false,
    proHighlight: true,
  },
  {
    dimension: "视觉呈现",
    standard: "自动化匹配主流电商风格，转化率导向",
    pro: "深度理解复杂提示词，完美还原定制化场景",
    standardHighlight: false,
    proHighlight: true,
  },
  {
    dimension: "细节把控",
    standard: "满足日常极速上新需求",
    pro: "光影更真实、材质细节更细腻、质感拉满",
    standardHighlight: false,
    proHighlight: true,
  },
  {
    dimension: "自定义参数",
    standard: null, // 不支持
    pro: "张数 / 比例 / 风格 / 功能关键词",
    standardHighlight: false,
    proHighlight: true,
  },
  // {
  //   dimension: "计费方式",
  //   standard: "固定积分，一次出九图",
  //   pro: "按张计费，灵活控制成本",
  //   standardHighlight: false,
  //   proHighlight: false,
  // },
]

export function ModeCompareModal({ open, onClose }: ModeCompareModalProps) {
  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 遮罩层 */}
          <motion.div
            key="mode-compare-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* 弹窗主体 */}
          <motion.div
            key="mode-compare-modal"
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-2xl pointer-events-auto rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 顶部装饰光带 */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-8 bg-blue-500/10 blur-xl" />

              {/* 标题栏 */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">模式对比一览</h2>
                  <p className="text-xs text-slate-400 mt-0.5">根据你的需求选择最合适的生成模式</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 模式标题行 */}
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-0 px-6 pb-3">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest self-end pb-1">
                  核心维度
                </div>
                {/* 标准极速 */}
                <div className="mx-1.5 rounded-xl bg-blue-950/40 border border-blue-500/20 p-3 text-center">
                  <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/25 mb-1">
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-bold text-blue-300">标准极速</span>
                  </div>
                  <p className="text-[10px] text-blue-400/60 font-mono mt-0.5">STANDARD</p>
                </div>
                {/* PRO 增强 */}
                <div className="mx-1.5 rounded-xl bg-amber-950/30 border border-amber-500/25 p-3 text-center relative overflow-hidden">
                  {/* PRO 呼吸光晕 */}
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    animate={{
                      boxShadow: [
                        "inset 0 0 16px 0px rgba(245,158,11,0.0)",
                        "inset 0 0 16px 2px rgba(245,158,11,0.08)",
                        "inset 0 0 16px 0px rgba(245,158,11,0.0)",
                      ],
                    }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 mb-1 relative">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300">PRO 增强</span>
                  </div>
                  <p className="text-[10px] text-amber-400/50 font-mono mt-0.5">PROFESSIONAL</p>
                  {/* 推荐角标 */}
                  <div className="absolute top-2 right-2 text-[9px] font-bold text-amber-300/70 border border-amber-500/30 rounded px-1 py-0.5 bg-amber-500/10">
                    推荐
                  </div>
                </div>
              </div>

              {/* 分割线 */}
              <div className="mx-6 h-[1px] bg-white/5 mb-1" />

              {/* 对比行列表 */}
              <div className="px-6 pb-5 space-y-0.5">
                {COMPARE_ROWS.map((row, idx) => (
                  <motion.div
                    key={row.dimension}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + idx * 0.04, duration: 0.25 }}
                    className="grid grid-cols-[1fr_1fr_1fr] gap-0 py-2.5 border-b border-white/5 last:border-b-0 group"
                  >
                    {/* 维度名 */}
                    <div className="text-xs text-slate-400 font-medium pr-3 self-center leading-relaxed">
                      {row.dimension}
                    </div>

                    {/* 标准极速值 */}
                    <div className="mx-1.5 px-3 py-1.5 rounded-lg bg-white/[0.02] group-hover:bg-blue-500/5 transition-colors self-center">
                      {row.standard === null ? (
                        <div className="flex items-center gap-1.5">
                          <Minus className="w-3 h-3 text-slate-600 shrink-0" />
                          <span className="text-[11px] text-slate-600">不支持</span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-300 leading-relaxed">{row.standard}</p>
                      )}
                    </div>

                    {/* PRO 增强值 */}
                    <div className={`mx-1.5 px-3 py-1.5 rounded-lg transition-colors self-center ${row.proHighlight ? "bg-amber-500/8 group-hover:bg-amber-500/12" : "bg-white/[0.02] group-hover:bg-amber-500/5"}`}>
                      <div className="flex items-start gap-1.5">
                        {row.proHighlight && (
                          <Check className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <p className={`text-[11px] leading-relaxed ${row.proHighlight ? "text-amber-200" : "text-slate-300"}`}>
                          {row.pro}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* 底部提示 */}
              <div className="mx-6 mb-5 rounded-xl bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-amber-500/5 border border-white/8 px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <span className="text-blue-300 font-medium">标准极速</span> 适合快速测款铺货；
                    <span className="text-amber-300 font-medium"> PRO 增强</span> 适合打造爆款精品。两种模式均支持失败自动退积分。
                  </p>
                </div>
              </div>

              {/* 底部右装饰光带 */}
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
