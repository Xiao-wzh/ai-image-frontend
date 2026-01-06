"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Copy, Gift, Users, Coins, Share2, Check, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type ReferralStats = {
    code: string | null
    totalInvited: number
    totalEarned: number
    history: Array<{
        id: string
        amount: number
        sourceType: string
        invitee: string
        createdAt: string
    }>
}

export default function ReferralPage() {
    const [stats, setStats] = useState<ReferralStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)

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

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
    }

    return (
        <div className="flex min-h-screen bg-[#0a0a0f]">
            <Sidebar />
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Gift className="w-8 h-8 text-yellow-400" />
                        推广中心
                    </h1>
                    <p className="text-slate-400 mt-2">
                        邀请好友注册，获得永久 <span className="text-yellow-400 font-semibold">10%</span> 返利
                    </p>
                </motion.div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Your Code */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="md:col-span-2 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-6"
                    >
                        <div className="flex items-center gap-2 text-yellow-400 mb-4">
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
                                    className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30"
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
                            好友注册时填写此邀请码，即可绑定推广关系
                        </p>
                    </motion.div>

                    {/* Total Earned */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-6"
                    >
                        <div className="flex items-center gap-2 text-emerald-400 mb-4">
                            <Coins className="w-5 h-5" />
                            <span className="font-medium">累计收益</span>
                        </div>
                        {loading ? (
                            <Skeleton className="h-12 w-32 bg-white/10" />
                        ) : (
                            <div className="text-4xl font-bold text-emerald-400">
                                +{stats?.totalEarned || 0}
                                <span className="text-lg ml-1 text-emerald-400/70">积分</span>
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* Invited Count */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8"
                >
                    <div className="flex items-center gap-2 text-blue-400 mb-4">
                        <Users className="w-5 h-5" />
                        <span className="font-medium">邀请统计</span>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <div className="text-3xl font-bold text-white">
                                {loading ? <Skeleton className="h-8 w-16 bg-white/10" /> : stats?.totalInvited || 0}
                            </div>
                            <div className="text-slate-400 text-sm">已邀请用户</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-white">10%</div>
                            <div className="text-slate-400 text-sm">永久返利比例</div>
                        </div>
                    </div>
                </motion.div>

                {/* History */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6"
                >
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        返利记录
                    </h2>

                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-16 w-full bg-white/10 rounded-xl" />
                            ))}
                        </div>
                    ) : stats?.history && stats.history.length > 0 ? (
                        <div className="space-y-3">
                            {stats.history.map((record) => (
                                <div
                                    key={record.id}
                                    className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <div className="text-white font-medium">{record.invitee}</div>
                                            <div className="text-slate-500 text-sm">
                                                {record.sourceType === "CDK" ? "兑换卡密" : "充值"}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-emerald-400 font-semibold">+{record.amount}</div>
                                        <div className="text-slate-500 text-sm">{formatDate(record.createdAt)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Gift className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400">暂无返利记录</p>
                            <p className="text-slate-500 text-sm mt-2">分享邀请码给好友，开始赚取返利！</p>
                        </div>
                    )}
                </motion.div>
            </main>
        </div>
    )
}
