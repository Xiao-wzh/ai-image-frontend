"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Copy, Check, Crown, Trophy, ChevronRight, Flame, Zap } from "lucide-react"
import { toast } from "sonner"
import { useSession } from "next-auth/react"

// ============================================================
// 类型定义（与后端 API 响应对齐，全部可选链防崩溃）
// ============================================================

interface TierConditions {
  minAmount?: number
  minInvites?: number
  [key: string]: unknown
}

interface TierRewards {
  credits?: number
  vipDays?: number
  [key: string]: unknown
}

interface ActivityTier {
  id: string
  tierLevel: number
  conditions: TierConditions
  rewards: TierRewards
}

interface Activity {
  id: string
  name: string
  startTime: string
  endTime: string
  tiers: ActivityTier[]
}

interface LeaderboardEntry {
  type: "real" | "virtual"
  userId?: string
  name: string
  avatar: string | null
  totalAmount: number
}

interface UserProgress {
  totalAmount: number
  validInviteCount: number
  currentTierLevel: number
  currentRewards: TierRewards | null
  nextTierLevel: number | null
  nextConditions: TierConditions | null
  nextRewards: TierRewards | null
  gapToNext: { amountGap: number; inviteGap: number } | null
}

interface ApiResponse {
  activity: Activity | null
  leaderboard: LeaderboardEntry[]
  userProgress: UserProgress | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

// ============================================================
// 格式化工具函数
// ============================================================

function formatAmount(fen: number): string {
  return `¥${(fen / 100).toFixed(0)}`
}

// 排名对应的皇冠颜色与样式
const RANK_STYLES = [
  { bg: "from-yellow-500/20 to-amber-600/10", border: "border-yellow-500/30", text: "text-yellow-400", crown: "text-yellow-400", label: "1st" },
  { bg: "from-slate-400/20 to-slate-500/10", border: "border-slate-400/30", text: "text-slate-300", crown: "text-slate-300", label: "2nd" },
  { bg: "from-amber-700/20 to-orange-900/10", border: "border-amber-700/30", text: "text-amber-600", crown: "text-amber-600", label: "3rd" },
]

// ============================================================
// 子组件：阶梯进度节点（含左右连接线）
// ============================================================

function TierNode({
  tier,
  index,
  totalTiers,
  userProgress,
  isActive,
  isCompleted,
  prevCompleted,
}: {
  tier: ActivityTier
  index: number
  totalTiers: number
  userProgress: UserProgress | null
  isActive: boolean
  isCompleted: boolean
  prevCompleted: boolean
}) {
  const minAmount = tier.conditions?.minAmount ?? 0
  const credits = tier.rewards?.credits ?? 0
  const gapAmount = isActive ? (userProgress?.gapToNext?.amountGap ?? 0) : 0

  // 左侧线段：i=0 时由"自身是否完成"决定（起点→第一档），其余由前一档决定
  const leftLineCompleted = index === 0 ? isCompleted : prevCompleted
  // 右侧线段（连接当前节点到下一个节点）：当前节点已完成则紫色
  const rightLineCompleted = isCompleted

  return (
    <div className="flex-1 min-w-0 flex flex-col items-center">
      {/* 奖励标签 - 固定高度区域，保证圆圈行对齐 */}
      <div className="h-7 flex items-center mb-1.5">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap
            ${isCompleted
              ? "bg-purple-500/30 text-purple-300 border border-purple-500/40"
              : isActive
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
              : "bg-slate-800/60 text-slate-500 border border-slate-700/40"
            }`}
        >
          +{credits.toLocaleString()} 积分
        </motion.div>
      </div>

      {/* 连接线 + 圆圈 - 三段横向 flex 保证圆圈与线在同一水平线 */}
      <div className="w-full flex items-center">
        {/* 左侧连接线（首节点左半线正常显示，由起点圆圈引入） */}
        <div className={`flex-1 h-0.5 overflow-hidden rounded-full bg-slate-700/60`}>
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500/80 to-purple-400"
            initial={{ width: "0%" }}
            animate={{ width: leftLineCompleted ? "100%" : "0%" }}
            transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.08 }}
          />
        </div>

        {/* 节点圆圈 */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
          className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 mx-1
            ${isCompleted
              ? "bg-purple-600 border-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.6)]"
              : isActive
              ? "bg-slate-800 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]"
              : "bg-slate-800/50 border-slate-600"
            }`}
        >
          {isCompleted ? (
            <Check className="w-5 h-5 text-white" strokeWidth={2.5} />
          ) : isActive ? (
            <Zap className="w-5 h-5 text-amber-300" />
          ) : (
            <span className="text-xs font-bold text-slate-500">{index + 1}</span>
          )}

          {/* 当前目标：闪烁光晕 */}
          {isActive && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-amber-400/50"
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </motion.div>

        {/* 右侧连接线（末节点隐藏） */}
        <div className={`flex-1 h-0.5 overflow-hidden rounded-full ${index === totalTiers - 1 ? "invisible" : ""} bg-slate-700/60`}>
          <motion.div
            className="h-full bg-gradient-to-r from-purple-400 to-purple-500/80"
            initial={{ width: "0%" }}
            animate={{ width: rightLineCompleted ? "100%" : "0%" }}
            transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.08 + 0.1 }}
          />
        </div>
      </div>

      {/* 金额标签 */}
      <div className={`mt-2 text-xs font-semibold whitespace-nowrap
        ${isCompleted ? "text-purple-300" : isActive ? "text-amber-300" : "text-slate-500"}
      `}>
        {formatAmount(minAmount)}
      </div>

      {/* 当前目标：差额气泡 */}
      {isActive && gapAmount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-1.5 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-[10px] text-amber-300 whitespace-nowrap"
        >
          还差 {formatAmount(gapAmount)}
        </motion.div>
      )}
    </div>
  )
}

// ============================================================
// 主弹窗组件
// ============================================================

export function ReferralCampaignModal({ isOpen, onClose }: Props) {
  const { data: session } = useSession()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [inviteLink, setInviteLink] = useState("")

  // 生成邀请链接（利用已有 referral stats API）
  useEffect(() => {
    if (session?.user && isOpen) {
      fetch("/api/user/referral/stats")
        .then((r) => r.json())
        .then((d) => {
          const code = d?.code
          if (code) {
            const base = typeof window !== "undefined" ? window.location.origin : ""
            setInviteLink(`${base}?inviteCode=${code}`)
          }
        })
        .catch(() => {})
    }
  }, [session, isOpen])

  // 拉取排行榜数据
  const fetchData = useCallback(async () => {
    if (!isOpen) return
    setLoading(true)
    try {
      const res = await fetch("/api/activity/leaderboard")
      const json: ApiResponse = await res.json()
      setData(json)
    } catch {
      toast.error("加载活动数据失败")
    } finally {
      setLoading(false)
    }
  }, [isOpen])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 复制邀请链接
  const handleCopy = useCallback(() => {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true)
      toast.success("邀请链接已复制！快去分享给好友吧 🎉")
      setTimeout(() => setCopied(false), 2000)
    })
  }, [inviteLink])

  const activity = data?.activity
  const leaderboard = data?.leaderboard ?? []
  const userProgress = data?.userProgress ?? null
  const tiers = activity?.tiers ?? []

  // 找出当前用户在排行榜中的位置（仅真实用户）
  const userId = session?.user?.id
  const userRank = userId
    ? leaderboard.findIndex((e) => e.type === "real" && e.userId === userId) + 1
    : 0
  const userEntry = userId
    ? leaderboard.find((e) => e.type === "real" && e.userId === userId)
    : null

  // 距离第十名还差多少（如果未上榜）
  const tenthEntry = leaderboard[9]
  const gapToTen = tenthEntry && userProgress
    ? Math.max(0, tenthEntry.totalAmount - (userProgress.totalAmount ?? 0))
    : null

  // 内容区动画配置
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.07, delayChildren: 0.1 },
    },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[90vh] flex flex-col
              bg-slate-900/90 backdrop-blur-2xl
              border border-white/10
              rounded-3xl shadow-[0_8px_80px_rgba(0,0,0,0.7)]
              overflow-hidden"
          >
            {/* 背景装饰光晕 */}
            <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

            {/* ── Hero 头部 ── */}
            <div className="relative px-6 pt-7 pb-5 text-center border-b border-white/8">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>

              {/* 火焰图标 */}
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600
                  flex items-center justify-center
                  shadow-[0_0_30px_rgba(168,85,247,0.5)]"
              >
                <Flame className="w-7 h-7 text-white" />
              </motion.div>

              <h2 className="text-2xl font-black leading-tight bg-gradient-to-r from-violet-300 via-purple-200 to-pink-300 bg-clip-text text-transparent">
                拉新充值阶梯返利
              </h2>
              <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                邀友充值，共享最高 <span className="text-amber-400 font-semibold">50%</span> 巨额积分返利
                {activity && (
                  <span className="ml-2 text-slate-500 text-xs">
                    · 活动截止 {new Date(activity.endTime).toLocaleDateString("zh-CN")}
                  </span>
                )}
              </p>
            </div>

            {/* ── 滚动内容区 ── */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {loading && !data ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
                </div>
              ) : !activity ? (
                <div className="py-16 text-center text-slate-500 text-sm">
                  当前暂无进行中的活动
                </div>
              ) : (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="px-5 py-5 space-y-6"
                >
                  {/* ── 阶梯进度条 ── */}
                  <motion.div variants={itemVariants}>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5 text-purple-400" />
                      我的拉新进度
                    </h3>

                    {/* 响应式：PC 横向，手机支持横向滚动 */}
                    <div className="overflow-x-auto pb-2">
                      <div
                        className="flex items-start"
                        style={{ minWidth: `${tiers.length * 100 + 48}px` }}
                      >
                        {/* 起点圆圈 */}
                        {(() => {
                          const firstTierCompleted = (userProgress?.currentTierLevel ?? 0) >= (tiers[0]?.tierLevel ?? 1)
                          return (
                            <div className="flex flex-col items-center shrink-0">
                              <div className="h-7 mb-1.5" />
                              {/* 高度与 TierNode 圆圈行一致（h-10 = 40px），保证连线对齐 */}
                              <div className="h-10 flex items-center">
                                <motion.div
                                  initial={{ scale: 0.5, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ type: "spring", stiffness: 200 }}
                                  className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors duration-500
                                    ${firstTierCompleted
                                      ? "bg-purple-600 border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                                      : "bg-slate-600 border-slate-500"
                                    }`}
                                />
                                {/* 起点到第一档的连接线（带动画） */}
                                <div className="w-6 h-0.5 overflow-hidden rounded-full bg-slate-700/60">
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-purple-500/80 to-purple-400"
                                    initial={{ width: "0%" }}
                                    animate={{ width: firstTierCompleted ? "100%" : "0%" }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                  />
                                </div>
                              </div>
                              <div className="mt-2 text-[10px] text-slate-600 whitespace-nowrap">起点</div>
                            </div>
                          )
                        })()}

                        {tiers.map((tier, i) => {
                          const currentLevel = userProgress?.currentTierLevel ?? 0
                          const isCompleted = currentLevel >= tier.tierLevel
                          const isActive = !isCompleted && tier.tierLevel === (userProgress?.nextTierLevel ?? null)
                          const prevCompleted = i > 0 ? currentLevel >= tiers[i - 1].tierLevel : false

                          return (
                            <TierNode
                              key={tier.id}
                              tier={tier}
                              index={i}
                              totalTiers={tiers.length}
                              userProgress={userProgress}
                              isActive={isActive}
                              isCompleted={isCompleted}
                              prevCompleted={prevCompleted}
                            />
                          )
                        })}
                      </div>
                    </div>

                    {/* 当前统计概览 */}
                    {userProgress && (
                      <motion.div
                        variants={itemVariants}
                        className="mt-4 grid grid-cols-2 gap-3"
                      >
                        <div className="rounded-2xl p-3 bg-purple-500/10 border border-purple-500/20 text-center">
                          <div className="text-xl font-black text-purple-300">
                            {formatAmount(userProgress.totalAmount)}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">累计拉新充值</div>
                        </div>
                        <div className="rounded-2xl p-3 bg-blue-500/10 border border-blue-500/20 text-center">
                          <div className="text-xl font-black text-blue-300">
                            {userProgress.validInviteCount}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">有效拉新人数</div>
                        </div>
                      </motion.div>
                    )}

                    {/* 未登录提示 */}
                    {!session && (
                      <p className="text-xs text-slate-500 text-center mt-3">
                        登录后查看专属拉新进度
                      </p>
                    )}
                  </motion.div>

                  {/* ── 排行榜 ── */}
                  <motion.div variants={itemVariants}>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      邀请排行榜 Top 10
                    </h3>

                    <div className="space-y-2">
                      {leaderboard.length === 0 && (
                        <p className="text-center text-slate-500 text-sm py-6">
                          暂无榜单数据，快去成为第一！
                        </p>
                      )}
                      {leaderboard.map((entry, i) => {
                        const style = RANK_STYLES[i] ?? null
                        const isMe = entry.type === "real" && entry.userId === userId

                        return (
                          <motion.div
                            key={`${entry.userId ?? entry.name}-${i}`}
                            variants={itemVariants}
                            className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl border
                              ${style
                                ? `bg-gradient-to-r ${style.bg} ${style.border}`
                                : "bg-slate-800/40 border-white/5"
                              }
                              ${isMe ? "ring-1 ring-purple-500/50" : ""}
                            `}
                          >
                            {/* 排名 */}
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-black
                              ${style ? style.text : "text-slate-500"}
                            `}>
                              {i < 3 ? (
                                <Crown className={`w-4 h-4 ${style?.crown ?? ""}`} />
                              ) : (
                                <span>{i + 1}</span>
                              )}
                            </div>

                            {/* 头像 */}
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-700 shrink-0 flex items-center justify-center">
                              {entry.avatar ? (
                                <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-slate-300 text-sm font-bold">
                                  {entry.name.slice(0, 1)}
                                </span>
                              )}
                            </div>

                            {/* 昵称 */}
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-white truncate block">
                                {entry.name}
                                {isMe && (
                                  <span className="ml-2 text-[10px] text-purple-400 font-normal">（我）</span>
                                )}
                              </span>
                            </div>

                            {/* 金额 */}
                            <div className={`text-sm font-bold shrink-0 ${style ? style.text : "text-slate-300"}`}>
                              {formatAmount(entry.totalAmount)}
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </motion.div>

                  {/* ── 奖励发放说明 ── */}
                  <motion.div
                    variants={itemVariants}
                    className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-amber-300/80"
                  >
                    <span className="mt-0.5 shrink-0">⏳</span>
                    <span>
                      阶梯积分奖励将在<strong className="text-amber-300">活动结束后</strong>由管理员统一审核发放，请耐心等待到账通知。
                    </span>
                  </motion.div>
                </motion.div>
              )}
            </div>

            {/* ── 吸底栏：用户状态 + 邀请按钮 ── */}
            <div className="relative shrink-0 px-5 py-4 border-t border-white/8 bg-slate-900/80 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                {/* 左侧：用户状态 */}
                <div className="flex-1 min-w-0">
                  {session ? (
                    userRank > 0 && userEntry ? (
                      <div>
                        <p className="text-xs text-slate-400">当前排名</p>
                        <p className="text-sm font-bold text-white leading-tight">
                          第 <span className="text-amber-400">{userRank}</span> 名
                          <span className="text-slate-400 font-normal ml-1">·</span>
                          <span className="text-purple-300 ml-1">{formatAmount(userEntry.totalAmount)}</span>
                        </p>
                      </div>
                    ) : userProgress ? (
                      <div>
                        <p className="text-xs text-slate-400">暂未上榜</p>
                        <p className="text-sm font-semibold text-slate-300 leading-tight">
                          {gapToTen != null && gapToTen > 0
                            ? `距前十名还差 ${formatAmount(gapToTen)}`
                            : "继续努力，冲击排行榜！"}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">邀请好友，共同赚积分</p>
                    )
                  ) : (
                    <p className="text-sm text-slate-400">登录后开始邀请</p>
                  )}
                </div>

                {/* 右侧：复制邀请链接按钮 */}
                {session && (
                  <motion.button
                    onClick={handleCopy}
                    whileTap={{ scale: 0.96 }}
                    className={`relative shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl
                      font-semibold text-sm text-white cursor-pointer overflow-hidden
                      transition-all duration-200
                      ${copied
                        ? "bg-green-600/80 border border-green-500/50"
                        : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_28px_rgba(168,85,247,0.5)]"
                      }`}
                  >
                    {/* 流光效果 */}
                    {!copied && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                        animate={{ x: ["-150%", "200%"] }}
                        transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
                      />
                    )}
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span className="relative">{copied ? "已复制！" : "复制邀请链接"}</span>
                    {!copied && <ChevronRight className="w-3.5 h-3.5 relative" />}
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
