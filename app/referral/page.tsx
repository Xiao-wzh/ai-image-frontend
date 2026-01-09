"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Copy, Gift, Users, Check, Share2, Crown, ArrowRight, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { INVITE_CODE_BONUS } from "@/lib/constants"

type ReferralStats = {
    code: string | null
    totalInvited: number
}

export default function ReferralPage() {
    const { data: session } = useSession()
    const router = useRouter()
    const [stats, setStats] = useState<ReferralStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)

    // 代理等级判断
    const agentLevel = session?.user?.agentLevel ?? 0
    const isAgent = agentLevel > 0

    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch("/api/user/referral/stats")
                if (res.ok) {
                    const data = await res.json()
                    setStats(data)
                }
            } catch (err) {
                console.error("获取推广数据失败:", err)
            } finally {
                setLoading(false)
            }
        }
        fetchStats()
    }, [])

    const handleCopy = async () => {
        if (!stats?.code) return
        try {
            await navigator.clipboard.writeText(stats.code)
            setCopied(true)
            toast.success("邀请码已复制")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("复制失败")
        }
    }

    return (
        <div className="flex min-h-screen bg-[#0a0a0f]">
            <Sidebar />
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                {/* 代理商引导 Banner */}
                {isAgent && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl p-4 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                                <Crown className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div>
                                <div className="text-yellow-400 font-medium">尊贵的合伙人</div>
                                <div className="text-slate-400 text-sm">查看您的现金收益和团队管理，请前往合伙人中心</div>
                            </div>
                        </div>
                        <Button
                            onClick={() => router.push("/agent")}
                            className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:opacity-90"
                        >
                            合伙人中心
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </motion.div>
                )}

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Gift className="w-8 h-8 text-purple-400" />
                        邀请好友送积分
                    </h1>
                    <p className="text-slate-400 mt-2">
                        邀请好友注册，<span className="text-purple-400 font-semibold">好友得 {INVITE_CODE_BONUS} 积分</span>，互惠互利！
                    </p>
                </motion.div>

                {/* 奖励说明卡片 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="mb-8 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6"
                >
                    <div className="flex items-center gap-2 text-purple-400 mb-4">
                        <Sparkles className="w-5 h-5" />
                        <span className="font-medium">积分奖励规则</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-4 bg-white/5 rounded-xl p-4">
                            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-2xl">
                                🎁
                            </div>
                            <div>
                                <div className="text-white font-semibold">好友奖励</div>
                                <div className="text-slate-400 text-sm">使用你的邀请码注册，好友额外获得 <span className="text-purple-400 font-medium">{INVITE_CODE_BONUS} 积分</span></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-white/5 rounded-xl p-4">
                            <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center text-2xl">
                                🤝
                            </div>
                            <div>
                                <div className="text-white font-semibold">互惠双赢</div>
                                <div className="text-slate-400 text-sm">好友成功注册后，你们都能享受积分奖励</div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Your Code */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl p-6"
                    >
                        <div className="flex items-center gap-2 text-cyan-400 mb-4">
                            <Share2 className="w-5 h-5" />
                            <span className="font-medium">我的邀请码</span>
                        </div>
                        {loading ? (
                            <Skeleton className="h-12 w-48 bg-white/10" />
                        ) : (
                            <div className="flex items-center gap-4">
                                <span className="text-4xl font-bold text-white tracking-[0.3em] font-mono">
                                    {stats?.code || "生成中..."}
                                </span>
                                <Button
                                    onClick={handleCopy}
                                    disabled={!stats?.code}
                                    className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-4 h-4 mr-1" />
                                            已复制
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4 mr-1" />
                                            复制
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                        <p className="text-slate-400 text-sm mt-4">
                            分享此邀请码给好友，好友注册时填写即可获得额外积分奖励
                        </p>
                    </motion.div>

                    {/* Invited Count */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-6"
                    >
                        <div className="flex items-center gap-2 text-emerald-400 mb-4">
                            <Users className="w-5 h-5" />
                            <span className="font-medium">邀请统计</span>
                        </div>
                        {loading ? (
                            <Skeleton className="h-12 w-32 bg-white/10" />
                        ) : (
                            <div className="text-4xl font-bold text-emerald-400">
                                {stats?.totalInvited || 0}
                                <span className="text-lg ml-2 text-emerald-400/70">人</span>
                            </div>
                        )}
                        <p className="text-slate-400 text-sm mt-4">
                            已成功邀请的好友数量
                        </p>
                    </motion.div>
                </div>

                {/* 使用说明 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6"
                >
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Gift className="w-5 h-5 text-pink-400" />
                        如何邀请好友？
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                1
                            </div>
                            <div>
                                <div className="text-white font-medium">复制邀请码</div>
                                <div className="text-slate-400 text-sm">点击上方复制按钮</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                2
                            </div>
                            <div>
                                <div className="text-white font-medium">分享给好友</div>
                                <div className="text-slate-400 text-sm">通过微信、QQ等方式分享</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                3
                            </div>
                            <div>
                                <div className="text-white font-medium">好友注册</div>
                                <div className="text-slate-400 text-sm">好友注册时填写邀请码即可</div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </main>
        </div>
    )
}
