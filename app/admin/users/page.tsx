"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import {
    Users,
    Activity,
    Clock,
    Copy,
    Check,
    Search,
    RefreshCw,
    ArrowUpDown,
    ChevronUp,
    ChevronDown,
    Gift,
    Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Sidebar } from "@/components/sidebar"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

type User = {
    id: string
    email: string
    username: string | null
    name: string | null
    role: string
    credits: number
    bonusCredits: number
    totalCredits: number
    totalConsumed: number
    createdAt: string
    lastActiveAt: string | null
    isActive: boolean
}

type Stats = {
    total: number
    active: number
    inactive: number
}

type SortField = "createdAt" | "credits" | "totalConsumed"
type SortOrder = "asc" | "desc"

function formatTimeAgo(dateString: string | null): string {
    if (!dateString) return "从未活跃"

    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 60) return `${diffMins} 分钟前`
    if (diffHours < 24) return `${diffHours} 小时前`
    if (diffDays < 30) return `${diffDays} 天前`
    return `${Math.floor(diffDays / 30)} 个月前`
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [copied, setCopied] = useState(false)
    const [sortBy, setSortBy] = useState<SortField>("createdAt")
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

    // Gift credits state
    const [giftOpen, setGiftOpen] = useState(false)
    const [giftUser, setGiftUser] = useState<User | null>(null)
    const [giftAmount, setGiftAmount] = useState("")
    const [giftReason, setGiftReason] = useState("")
    const [gifting, setGifting] = useState(false)

    const fetchUsers = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (statusFilter !== "all") params.set("status", statusFilter)
            params.set("sortBy", sortBy)
            params.set("sortOrder", sortOrder)

            const res = await fetch(`/api/admin/users?${params.toString()}`)
            if (!res.ok) throw new Error("获取失败")

            const data = await res.json()
            setUsers(data.users || [])
            setStats(data.stats || null)
        } catch (err) {
            toast.error("获取用户列表失败")
        } finally {
            setLoading(false)
        }
    }, [statusFilter, sortBy, sortOrder])

    useEffect(() => {
        fetchUsers()
    }, [fetchUsers])

    // Filter by search query locally
    const filteredUsers = users.filter(user => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
            user.email.toLowerCase().includes(q) ||
            user.username?.toLowerCase().includes(q) ||
            user.name?.toLowerCase().includes(q)
        )
    })

    // Copy emails feature
    const copyEmails = () => {
        const emails = filteredUsers.map(u => u.email).join("\n")
        navigator.clipboard.writeText(emails).then(() => {
            setCopied(true)
            toast.success(`已复制 ${filteredUsers.length} 个邮箱到剪贴板`)
            setTimeout(() => setCopied(false), 2000)
        }).catch(() => {
            toast.error("复制失败")
        })
    }

    // Toggle sort
    const handleSort = (field: SortField) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === "desc" ? "asc" : "desc")
        } else {
            setSortBy(field)
            setSortOrder("desc")
        }
    }

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortBy !== field) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />
        return sortOrder === "desc"
            ? <ChevronDown className="w-4 h-4 ml-1 text-purple-400" />
            : <ChevronUp className="w-4 h-4 ml-1 text-purple-400" />
    }

    // Open gift dialog
    const openGiftDialog = (user: User) => {
        setGiftUser(user)
        setGiftAmount("")
        setGiftReason("")
        setGiftOpen(true)
    }

    // Submit gift
    const handleGift = async () => {
        if (!giftUser || !giftAmount) return

        setGifting(true)
        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: giftUser.id,
                    amount: Number(giftAmount),
                    reason: giftReason || undefined,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "赠送失败")
            toast.success(data.message || "赠送成功")
            setGiftOpen(false)
            fetchUsers() // Refresh list
        } catch (err: any) {
            toast.error(err.message || "赠送失败")
        } finally {
            setGifting(false)
        }
    }


    return (
        <div className="flex h-screen bg-slate-950">
            <Sidebar />
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                                <Users className="w-8 h-8 text-purple-400" />
                                用户管理
                            </h1>
                            <p className="text-slate-400 mt-1">监控用户活跃度，管理用户状态</p>
                        </div>
                        <Button
                            onClick={fetchUsers}
                            variant="outline"
                            disabled={loading}
                            className="bg-slate-800 border-slate-700 hover:bg-slate-700"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                            刷新
                        </Button>
                    </div>

                    {/* Stats Cards */}
                    {stats && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-900/50 border border-white/10 rounded-xl p-5"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-blue-500/10 rounded-lg">
                                        <Users className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-400">总用户数</p>
                                        <p className="text-2xl font-bold text-white">{stats.total}</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-slate-900/50 border border-white/10 rounded-xl p-5"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-green-500/10 rounded-lg">
                                        <Activity className="w-6 h-6 text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-400">活跃用户 (48h)</p>
                                        <p className="text-2xl font-bold text-green-400">{stats.active}</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-slate-900/50 border border-white/10 rounded-xl p-5"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-slate-500/10 rounded-lg">
                                        <Clock className="w-6 h-6 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-400">沉睡用户</p>
                                        <p className="text-2xl font-bold text-slate-400">{stats.inactive}</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Filters & Actions */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/50 border border-white/10 rounded-xl p-4">
                        <div className="flex flex-wrap gap-3 w-full md:w-auto">
                            {/* Status Filter */}
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700">
                                    <SelectValue placeholder="筛选状态" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">📊 全部用户</SelectItem>
                                    <SelectItem value="active">🟢 活跃 (48h内)</SelectItem>
                                    <SelectItem value="inactive">⚪ 沉睡 (&gt;48h)</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="搜索邮箱、用户名..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 bg-slate-800 border-slate-700"
                                />
                            </div>
                        </div>

                        {/* Copy Emails Button */}
                        <Button
                            onClick={copyEmails}
                            variant="outline"
                            className="bg-slate-800 border-slate-700 hover:bg-slate-700 whitespace-nowrap"
                            disabled={filteredUsers.length === 0}
                        >
                            {copied ? (
                                <Check className="w-4 h-4 mr-2 text-green-400" />
                            ) : (
                                <Copy className="w-4 h-4 mr-2" />
                            )}
                            复制邮箱 ({filteredUsers.length})
                        </Button>
                    </div>

                    {/* Users Table */}
                    <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-white/10 hover:bg-transparent">
                                    <TableHead className="text-slate-300">用户</TableHead>
                                    <TableHead className="text-slate-300">邮箱</TableHead>
                                    <TableHead
                                        className="text-slate-300 cursor-pointer hover:text-white transition-colors"
                                        onClick={() => handleSort("credits")}
                                    >
                                        <div className="flex items-center">
                                            积分余额
                                            <SortIcon field="credits" />
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="text-slate-300 cursor-pointer hover:text-white transition-colors"
                                        onClick={() => handleSort("totalConsumed")}
                                    >
                                        <div className="flex items-center">
                                            总消耗
                                            <SortIcon field="totalConsumed" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-slate-300">角色</TableHead>
                                    <TableHead className="text-slate-300">活跃状态</TableHead>
                                    <TableHead
                                        className="text-slate-300 cursor-pointer hover:text-white transition-colors"
                                        onClick={() => handleSort("createdAt")}
                                    >
                                        <div className="flex items-center">
                                            注册时间
                                            <SortIcon field="createdAt" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-slate-300">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i} className="border-b border-white/5">
                                            <TableCell><Skeleton className="h-4 w-32 bg-slate-700" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-48 bg-slate-700" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16 bg-slate-700" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16 bg-slate-700" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16 bg-slate-700" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24 bg-slate-700" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24 bg-slate-700" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                                            暂无数据
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <TableRow
                                            key={user.id}
                                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                        >
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-white">
                                                        {user.username || user.name || "未设置"}
                                                    </p>
                                                    <p className="text-xs text-slate-500">{user.id.slice(0, 8)}...</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-slate-300">{user.email}</TableCell>
                                            <TableCell>
                                                <span className="text-purple-400 font-medium">
                                                    {user.totalCredits.toLocaleString()}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-orange-400 font-medium">
                                                    {user.totalConsumed.toLocaleString()}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={user.role === "ADMIN" ? "destructive" : "secondary"}
                                                    className={user.role === "ADMIN" ? "" : "bg-slate-700"}
                                                >
                                                    {user.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {user.isActive ? (
                                                        <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
                                                            🟢 活跃
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-slate-500/20 text-slate-400 hover:bg-slate-500/30">
                                                            ⚪ 沉睡
                                                        </Badge>
                                                    )}
                                                    <span className="text-xs text-slate-500">
                                                        {formatTimeAgo(user.lastActiveAt)}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-slate-400 text-sm">
                                                {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openGiftDialog(user)}
                                                    className="bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 hover:text-green-300"
                                                >
                                                    <Gift className="w-4 h-4 mr-1" />
                                                    赠送
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Footer info */}
                    <div className="text-center text-sm text-slate-500">
                        显示 {filteredUsers.length} 个用户
                        {statusFilter !== "all" && ` (筛选: ${statusFilter === "active" ? "活跃" : "沉睡"})`}
                    </div>
                </div>
            </main>

            {/* Gift Credits Dialog */}
            <Dialog open={giftOpen} onOpenChange={setGiftOpen}>
                <DialogContent className="bg-slate-900 border-slate-700">
                    <DialogHeader>
                        <DialogTitle className="text-white">
                            赠送积分给 {giftUser?.username || giftUser?.email}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-slate-300">积分数量</Label>
                            <Input
                                type="number"
                                min="1"
                                placeholder="输入积分数量"
                                value={giftAmount}
                                onChange={(e) => setGiftAmount(e.target.value)}
                                className="bg-slate-800 border-slate-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">赠送原因（可选）</Label>
                            <Input
                                placeholder="如：新用户活动、补偿等"
                                value={giftReason}
                                onChange={(e) => setGiftReason(e.target.value)}
                                className="bg-slate-800 border-slate-700"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setGiftOpen(false)}
                            className="border-slate-600"
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleGift}
                            disabled={!giftAmount || gifting}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            {gifting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    赠送中...
                                </>
                            ) : (
                                <>
                                    <Gift className="w-4 h-4 mr-2" />
                                    确认赠送
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

