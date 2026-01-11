"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
    Crown,
    Wallet,
    Users,
    TrendingUp,
    ArrowUpCircle,
    Copy,
    Loader2,
    CheckCircle,
    XCircle,
    Clock,
    ChevronRight,
    Link,
    UserPlus,
} from "lucide-react"

import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { AGENT_LEVEL } from "@/lib/agent-constants"
import { SITE_URL } from "@/lib/constants"

// 代理等级映射 (L1=1 合伙人, L2=2 运营中心, L3=3 推广大使)
const LEVEL_INFO: Record<number, { label: string; color: string; bgColor: string }> = {
    0: { label: "普通用户", color: "text-slate-400", bgColor: "bg-slate-500/20" },
    1: { label: "合伙人", color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
    2: { label: "运营中心", color: "text-blue-400", bgColor: "bg-blue-500/20" },
    3: { label: "推广大使", color: "text-green-400", bgColor: "bg-green-500/20" },
}

// 复制到剪贴板（兼容非 HTTPS 环境）
async function copyToClipboard(text: string): Promise<boolean> {
    // 优先使用 Clipboard API
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text)
            return true
        } catch (e) {
            console.warn('Clipboard API 失败，尝试 fallback:', e)
        }
    }

    // Fallback: 使用 textarea + execCommand
    try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        textarea.style.top = '-9999px'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const success = document.execCommand('copy')
        document.body.removeChild(textarea)
        return success
    } catch (e) {
        console.error('Fallback 复制失败:', e)
        return false
    }
}
type AgentStats = {
    agentLevel: number
    agentBalance: number
    agentQuota: number
    referralCode: string | null
    directCount: number
    teamCount: number
    todayCommission: number
    totalCommission: number
    recentRecords: any[]
}

type TeamMember = {
    id: string
    username: string | null
    email: string
    agentLevel: number
    createdAt: string
    contribution: number
    subTeamCount: number   // L3 的下属客户数量
    teamEarnings: number   // L3 团队带来的总佣金
}

export default function AgentCenterPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [stats, setStats] = useState<AgentStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [loadingTeam, setLoadingTeam] = useState(true)

    // 提现弹窗
    const [showWithdrawDialog, setShowWithdrawDialog] = useState(false)
    const [withdrawAmount, setWithdrawAmount] = useState("")
    const [withdrawAccount, setWithdrawAccount] = useState("")
    const [withdrawName, setWithdrawName] = useState("")
    const [withdrawType, setWithdrawType] = useState<"alipay" | "wechat">("alipay")
    const [submittingWithdraw, setSubmittingWithdraw] = useState(false)

    // 升级确认弹窗
    const [showPromoteDialog, setShowPromoteDialog] = useState(false)
    const [promoteTarget, setPromoteTarget] = useState<TeamMember | null>(null)
    const [promoting, setPromoting] = useState(false)

    // 获取代理统计
    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch("/api/agent/stats")
            if (res.ok) {
                const data = await res.json()
                setStats(data)
            }
        } catch (e) {
            console.error("获取代理统计失败:", e)
        } finally {
            setLoading(false)
        }
    }, [])

    // 获取团队成员
    const fetchTeam = useCallback(async () => {
        try {
            const res = await fetch("/api/agent/team")
            if (res.ok) {
                const data = await res.json()
                setTeamMembers(data.members || [])
            }
        } catch (e) {
            console.error("获取团队成员失败:", e)
        } finally {
            setLoadingTeam(false)
        }
    }, [])

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/")
            return
        }
        if (session?.user) {
            fetchStats()
            fetchTeam()
        }
    }, [session, status, router, fetchStats, fetchTeam])

    // 复制邀请码
    const copyReferralCode = () => {
        if (stats?.referralCode) {
            navigator.clipboard.writeText(stats.referralCode)
            toast.success("邀请码已复制")
        }
    }

    // 提交提现
    const handleWithdraw = async () => {
        const amount = Number(withdrawAmount)
        if (!amount || amount < 100) {
            toast.error("最低提现金额为 100 积分")
            return
        }
        if (!withdrawAccount.trim() || !withdrawName.trim()) {
            toast.error("请填写完整的收款信息")
            return
        }

        setSubmittingWithdraw(true)
        try {
            const res = await fetch("/api/agent/withdraw", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount,
                    bankInfo: {
                        type: withdrawType,
                        account: withdrawAccount.trim(),
                        name: withdrawName.trim(),
                    },
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "提现失败")

            toast.success("提现申请已提交")
            setShowWithdrawDialog(false)
            setWithdrawAmount("")
            setWithdrawAccount("")
            setWithdrawName("")
            fetchStats()
        } catch (e: any) {
            toast.error(e.message || "提现失败")
        } finally {
            setSubmittingWithdraw(false)
        }
    }

    // 升级下级
    const handlePromote = async () => {
        if (!promoteTarget) return

        setPromoting(true)
        try {
            const res = await fetch("/api/agent/promote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetUserId: promoteTarget.id }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "升级失败")

            toast.success(`已将 ${promoteTarget.username || promoteTarget.email} 升级为运营中心`)
            setShowPromoteDialog(false)
            setPromoteTarget(null)
            fetchStats()
            fetchTeam()
        } catch (e: any) {
            toast.error(e.message || "升级失败")
        } finally {
            setPromoting(false)
        }
    }

    const levelInfo = LEVEL_INFO[stats?.agentLevel ?? 0] || LEVEL_INFO[0]
    const isL1 = stats?.agentLevel === AGENT_LEVEL.L1
    const isL2 = stats?.agentLevel === AGENT_LEVEL.L2
    const isL3 = stats?.agentLevel === AGENT_LEVEL.L3
    const isManager = isL1 || isL2 // L1/L2 是管理层，可以查看团队数据

    return (
        <div className="flex h-screen bg-slate-950">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto">
                    {/* Hero Background */}
                    <div className="relative pt-8 pb-8 px-8">
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl"></div>
                            <div className="absolute top-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                        </div>

                        {/* Header */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative z-10 mb-8"
                        >
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-lg">
                                    <Crown className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-white">
                                        {isL3 ? "推广中心" : "合伙人中心"}
                                    </h1>
                                    <p className="text-sm text-slate-400">
                                        {isL3 ? "推广赚钱，轻松变现" : "管理你的团队，追踪收益"}
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        {/* Stats Cards - L3 显示 3 张，L1/L2 显示 4 张 */}
                        <div className={cn(
                            "relative z-10 grid gap-4 mb-8",
                            isL3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
                        )}>
                            {loading ? (
                                Array(isL3 ? 3 : 4).fill(0).map((_, i) => (
                                    <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />
                                ))
                            ) : (
                                <>
                                    {/* 代理等级 */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 }}
                                        className="glass rounded-2xl p-5 border border-white/10"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm text-slate-400">我的等级</span>
                                            <Badge className={cn("text-xs", levelInfo.bgColor, levelInfo.color)}>
                                                {levelInfo.label}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Crown className={cn("w-8 h-8", levelInfo.color)} />
                                            <div>
                                                <div className="text-xl font-bold text-white">
                                                    L{stats?.agentLevel || 0}
                                                </div>
                                                {isL1 && (
                                                    <div className="text-xs text-yellow-400">
                                                        剩余名额: {stats?.agentQuota || 0}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* 可提现佣金 */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="glass rounded-2xl p-5 border border-white/10"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm text-slate-400">可提现佣金</span>
                                            <Wallet className="w-5 h-5 text-green-400" />
                                        </div>
                                        <div className="text-2xl font-bold text-green-400">
                                            ¥{((stats?.agentBalance || 0) / 100).toFixed(2)}
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => setShowWithdrawDialog(true)}
                                            disabled={!stats?.agentBalance || stats.agentBalance < 100}
                                            className="mt-3 w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:opacity-90 text-xs"
                                        >
                                            申请提现
                                        </Button>
                                    </motion.div>

                                    {/* 累计收益 */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="glass rounded-2xl p-5 border border-white/10"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm text-slate-400">累计收益</span>
                                            <TrendingUp className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div className="text-2xl font-bold text-purple-400">
                                            ¥{((stats?.totalCommission || 0) / 100).toFixed(2)}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            今日: ¥{((stats?.todayCommission || 0) / 100).toFixed(2)}
                                        </div>
                                    </motion.div>

                                    {/* 团队人数 - 仅 L1/L2 显示 */}
                                    {isManager && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.4 }}
                                            className="glass rounded-2xl p-5 border border-white/10"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm text-slate-400">团队规模</span>
                                                <Users className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div className="text-2xl font-bold text-blue-400">
                                                {stats?.teamCount || 0}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                直推: {stats?.directCount || 0} 人
                                            </div>
                                        </motion.div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* 双向邀请链接 */}
                        {stats?.referralCode && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="relative z-10 glass rounded-2xl p-5 border border-white/10 mb-8"
                            >
                                <div className="text-sm text-slate-400 mb-4">我的邀请码: <span className="font-mono font-bold text-white">{stats.referralCode}</span></div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* 推广获客链接 - 所有代理 */}
                                    <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-4">
                                        <div className="flex items-center gap-2 text-emerald-400 mb-2">
                                            <Link className="w-4 h-4" />
                                            <span className="font-medium">推广获客链接</span>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-3">
                                            邀请用户注册消费，您获{" "}
                                            <span className="text-emerald-400 font-semibold">
                                                {isL1 ? "20%" : isL2 ? "17%" : "12%"}
                                            </span>
                                            {" "}佣金
                                        </p>
                                        <Button
                                            size="sm"
                                            onClick={async () => {
                                                // 推广获客链接不需要签名，直接用邀请码即可
                                                const baseUrl = SITE_URL || window.location.origin
                                                const link = `${baseUrl}/?inviteCode=${stats.referralCode}`
                                                const copied = await copyToClipboard(link)
                                                if (copied) {
                                                    toast.success("推广链接已复制")
                                                } else {
                                                    toast.error("复制失败，请手动复制: " + link)
                                                }
                                            }}
                                            className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
                                        >
                                            <Copy className="w-4 h-4 mr-2" />
                                            复制推广链接
                                        </Button>
                                    </div>

                                    {/* 招募代理链接 - 仅 L1/L2 可见 */}
                                    {isManager && (
                                        <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-4">
                                            <div className="flex items-center gap-2 text-yellow-400 mb-2">
                                                <UserPlus className="w-4 h-4" />
                                                <span className="font-medium">招募代理链接</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mb-3">
                                                招募 L3 推广员，为您裂变团队
                                            </p>
                                            <Button
                                                size="sm"
                                                onClick={async () => {
                                                    try {
                                                        const res = await fetch("/api/agent/invite-link?type=agent")
                                                        const data = await res.json()
                                                        if (data.success) {
                                                            const baseUrl = SITE_URL || window.location.origin
                                                            const link = `${baseUrl}/?${data.params}`
                                                            const copied = await copyToClipboard(link)
                                                            if (copied) {
                                                                toast.success("代理招募链接已复制")
                                                            } else {
                                                                toast.error("复制失败，请手动复制: " + link)
                                                            }
                                                        } else {
                                                            toast.error(data.error || "生成链接失败")
                                                        }
                                                    } catch (e) {
                                                        console.error("生成链接失败:", e)
                                                        toast.error("生成链接失败")
                                                    }
                                                }}
                                                className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30"
                                            >
                                                <Copy className="w-4 h-4 mr-2" />
                                                复制招募链接
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* 团队管理 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="relative z-10 glass rounded-2xl border border-white/10 overflow-hidden"
                        >
                            <div className="p-5 border-b border-white/10">
                                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <Users className="w-5 h-5 text-blue-400" />
                                    {isL3 ? "我的直推客户" : "我的直推团队"}
                                </h2>
                            </div>

                            {loadingTeam ? (
                                <div className="p-8 text-center">
                                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                                </div>
                            ) : teamMembers.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">
                                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>{isL3 ? "暂无推广客户" : "暂无团队成员"}</p>
                                    <p className="text-xs mt-1">
                                        {isL3 ? "分享你的邀请码开始推广赚钱" : "分享你的邀请码开始发展团队"}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {teamMembers.map((member) => {
                                        const memberLevel = LEVEL_INFO[member.agentLevel] || LEVEL_INFO[0]
                                        // L1 可以将 L3 (推广大使) 升级为 L2 (运营中心)
                                        // L3=3, L2=2, 所以检查 member.agentLevel === L3
                                        const canPromote = isL1 && member.agentLevel === AGENT_LEVEL.L3 && (stats?.agentQuota || 0) > 0

                                        return (
                                            <div
                                                key={member.id}
                                                className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                                                        {(member.username || member.email).slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-white">
                                                            {member.username || member.email.split("@")[0]}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            {new Date(member.createdAt).toLocaleDateString("zh-CN")}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    {/* L1/L2 查看 L3 成员时，显示团队数据 */}
                                                    {isManager && (member.agentLevel === AGENT_LEVEL.L2 || member.agentLevel === AGENT_LEVEL.L3) && (
                                                        <div className="text-right mr-2">
                                                            <div className="text-xs text-slate-400">
                                                                团队 {member.subTeamCount || 0} 人
                                                            </div>
                                                            <div className="text-xs text-emerald-400">
                                                                贡献 ¥{((member.contribution + member.teamEarnings) / 100).toFixed(2)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <Badge className={cn("text-xs", memberLevel.bgColor, memberLevel.color)}>
                                                        {memberLevel.label}
                                                    </Badge>

                                                    {canPromote && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => {
                                                                setPromoteTarget(member)
                                                                setShowPromoteDialog(true)
                                                            }}
                                                            className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs hover:opacity-90"
                                                        >
                                                            <ArrowUpCircle className="w-3.5 h-3.5 mr-1" />
                                                            授权升级
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </motion.div>

                        {/* 最近佣金记录 */}
                        {stats?.recentRecords && stats.recentRecords.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7 }}
                                className="relative z-10 glass rounded-2xl border border-white/10 overflow-hidden mt-8"
                            >
                                <div className="p-5 border-b border-white/10">
                                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-green-400" />
                                        最近佣金记录
                                    </h2>
                                </div>
                                <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
                                    {stats.recentRecords.map((record: any, idx: number) => {
                                        // 获取佣金来源用户的名称
                                        const sourceName = record.sourceUser?.username ||
                                            record.sourceUser?.email?.split("@")[0] || "用户"

                                        // 获取来源用户的邀请人（即团队成员），用于管理奖励和顶级奖励
                                        const teamMemberName = record.sourceUser?.invitedBy?.username ||
                                            record.sourceUser?.invitedBy?.email?.split("@")[0]

                                        // 判断是否显示团队来源（level 2/3 且有邀请人）
                                        const showTeamSource = (record.level === 2 || record.level === 3) && teamMemberName

                                        return (
                                            <div key={idx} className="flex items-center justify-between p-4">
                                                <div>
                                                    <div className="text-sm text-white">
                                                        来自 {sourceName}
                                                        {showTeamSource && (
                                                            <span className="text-slate-400 text-xs ml-2">
                                                                ({teamMemberName} 的客户)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {record.level === 1 && "直推奖励"}
                                                        {record.level === 2 && "管理奖励"}
                                                        {record.level === 3 && "顶级奖励"}
                                                        {" · "}
                                                        {new Date(record.createdAt).toLocaleString("zh-CN")}
                                                    </div>
                                                </div>
                                                <div className="text-green-400 font-semibold">
                                                    +¥{(record.amount / 100).toFixed(2)}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </main>
            </div>

            {/* 提现弹窗 */}
            <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
                <DialogContent className="bg-slate-900/95 border-white/10 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-green-400" />
                            申请提现
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            当前可提现: ¥{((stats?.agentBalance || 0) / 100).toFixed(2)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                        <div>
                            <Label className="text-slate-300">提现金额 (最低100)</Label>
                            <Input
                                type="number"
                                placeholder="请输入提现金额"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                className="mt-1 bg-white/5 border-white/10 text-white"
                            />
                        </div>

                        <div>
                            <Label className="text-slate-300">收款方式</Label>
                            <div className="flex gap-2 mt-1">
                                <Button
                                    type="button"
                                    variant={withdrawType === "alipay" ? "default" : "outline"}
                                    onClick={() => setWithdrawType("alipay")}
                                    className={cn(
                                        "flex-1",
                                        withdrawType === "alipay"
                                            ? "bg-blue-600 text-white"
                                            : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                                    )}
                                >
                                    支付宝
                                </Button>
                                <Button
                                    type="button"
                                    variant={withdrawType === "wechat" ? "default" : "outline"}
                                    onClick={() => setWithdrawType("wechat")}
                                    className={cn(
                                        "flex-1",
                                        withdrawType === "wechat"
                                            ? "bg-green-600 text-white"
                                            : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                                    )}
                                >
                                    微信
                                </Button>
                            </div>
                        </div>

                        <div>
                            <Label className="text-slate-300">收款账号</Label>
                            <Input
                                placeholder="请输入收款账号"
                                value={withdrawAccount}
                                onChange={(e) => setWithdrawAccount(e.target.value)}
                                className="mt-1 bg-white/5 border-white/10 text-white"
                            />
                        </div>

                        <div>
                            <Label className="text-slate-300">真实姓名</Label>
                            <Input
                                placeholder="请输入真实姓名"
                                value={withdrawName}
                                onChange={(e) => setWithdrawName(e.target.value)}
                                className="mt-1 bg-white/5 border-white/10 text-white"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <Button
                            variant="outline"
                            onClick={() => setShowWithdrawDialog(false)}
                            className="flex-1 border-white/10 bg-white/5 text-white hover:bg-white/10"
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleWithdraw}
                            disabled={submittingWithdraw}
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:opacity-90"
                        >
                            {submittingWithdraw && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            提交申请
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 升级确认弹窗 */}
            <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
                <DialogContent className="bg-slate-900/95 border-white/10 text-white max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ArrowUpCircle className="w-5 h-5 text-yellow-400" />
                            确认升级
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p className="text-slate-300">
                            确定要将 <span className="text-white font-semibold">{promoteTarget?.username || promoteTarget?.email}</span> 升级为运营中心(L2)吗？
                        </p>
                        <p className="text-sm text-yellow-400 mt-2">
                            此操作将消耗 1 个授权名额 (剩余: {stats?.agentQuota || 0})
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setShowPromoteDialog(false)}
                            className="flex-1 border-white/10 bg-white/5 text-white hover:bg-white/10"
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handlePromote}
                            disabled={promoting}
                            className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:opacity-90"
                        >
                            {promoting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            确认升级
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
