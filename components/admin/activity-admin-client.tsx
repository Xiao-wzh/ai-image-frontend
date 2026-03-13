"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Trophy,
  Users,
  Calendar,
  Shuffle,
  X,
  Zap,
  AlertCircle,
  Gift,
  CheckCircle2,
  Clock,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ============================================================
// 类型定义
// ============================================================

type ActivityTier = {
  id: string
  activityId: string
  tierLevel: number
  conditions: { minAmount?: number } & Record<string, unknown>
  rewards: { credits?: number } & Record<string, unknown>
  createdAt: string
}

type VirtualLeaderboardEntry = {
  id: string
  activityId: string
  fakeName: string
  fakeAvatar: string | null
  fakeAmount: number
  createdAt: string
}

type Activity = {
  id: string
  name: string
  startTime: string
  endTime: string
  isActive: boolean
  createdAt: string
  tiers?: ActivityTier[]
  virtualLeaderboard?: VirtualLeaderboardEntry[]
  _count?: { activityReferrals: number }
}

type ActivitiesResponse = {
  activities: Activity[]
}

type ActivityDetailResponse = {
  activity: Activity
}

// ============================================================
// 工具函数
// ============================================================

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `请求失败: ${res.status}`)
  return data
}

/** 生成随机昵称 */
const surnames = ["李", "王", "张", "刘", "陈", "赵", "周", "吴", "郑", "孙"]
const suffixes = ["小丽", "大宝", "小哥", "总", "老板", "宝宝", "同学", "小明"]
const randomName = () =>
  surnames[Math.floor(Math.random() * surnames.length)] +
  suffixes[Math.floor(Math.random() * suffixes.length)]

/** 生成 DiceBear 随机头像 URL */
const randomAvatar = () =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random().toString(36).slice(2)}`

/** 将 datetime-local 字符串转为 ISO-8601（endTime 强制设置为当天 23:59:59.999） */
const toISOStart = (dtLocal: string): string => {
  if (!dtLocal) return ""
  return new Date(dtLocal).toISOString()
}

const toISOEnd = (dtLocal: string): string => {
  if (!dtLocal) return ""
  const d = new Date(dtLocal)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

/** 将 ISO 字符串转为 datetime-local 格式（本地时间） */
const toDatetimeLocal = (iso: string): string => {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 对阶梯按 minAmount 升序排序，并重置 tierLevel 为 1,2,3... */
const normalizeTierLevels = (
  tiers: { minAmount: number; credits: number; id?: string }[]
): { tierLevel: number; conditions: { minAmount: number }; rewards: { credits: number }; id?: string }[] => {
  return [...tiers]
    .sort((a, b) => a.minAmount - b.minAmount)
    .map((t, idx) => ({
      id: t.id,
      tierLevel: idx + 1,
      conditions: { minAmount: t.minAmount },
      rewards: { credits: t.credits },
    }))
}

/** 计算活动状态 */
const getActivityStatus = (activity: Activity): "进行中" | "未开始" | "已结束" => {
  const now = Date.now()
  const start = new Date(activity.startTime).getTime()
  const end = new Date(activity.endTime).getTime()
  if (now < start) return "未开始"
  if (now > end) return "已结束"
  return "进行中"
}

const statusColor = {
  进行中: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  未开始: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  已结束: "bg-rose-500/20 text-rose-400 border-rose-500/30",
}

// ============================================================
// 空状态组件
// ============================================================

function EmptyStateGuard() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-white/10 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-slate-500" />
      </div>
      <p className="text-slate-400 text-sm">请先在「活动基础配置」中创建或选择一个活动</p>
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================

export function ActivityAdminClient() {
  // 活动列表
  const {
    data: listData,
    isLoading: listLoading,
    error: listError,
    mutate: mutateList,
  } = useSWR<ActivitiesResponse>("/api/admin/activity", fetcher)

  const activities = listData?.activities ?? []

  // 当前选中活动 ID
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 活动详情（含 tiers + virtualLeaderboard）
  const {
    data: detailData,
    isLoading: detailLoading,
    mutate: mutateDetail,
  } = useSWR<ActivityDetailResponse>(
    selectedId ? `/api/admin/activity/${selectedId}` : null,
    fetcher
  )

  const selectedActivity = detailData?.activity ?? null

  // ── 新建活动 Dialog ──────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createStart, setCreateStart] = useState("")
  const [createEnd, setCreateEnd] = useState("")
  const [createActive, setCreateActive] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  const openCreateDialog = () => {
    setCreateName("")
    setCreateStart("")
    setCreateEnd("")
    setCreateActive(true)
    setIsCreateOpen(true)
  }

  const handleCreateActivity = async () => {
    if (!createName.trim()) { toast.error("请输入活动名称"); return }
    if (!createStart) { toast.error("请选择开始时间"); return }
    if (!createEnd) { toast.error("请选择结束时间"); return }

    setIsCreating(true)
    try {
      const res = await fetch("/api/admin/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          startTime: toISOStart(createStart),
          endTime: toISOEnd(createEnd),
          isActive: createActive,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "创建失败")

      toast.success("活动已创建")
      setIsCreateOpen(false)
      await mutateList()
      // 自动选中新建活动
      setSelectedId(json.activity?.id ?? null)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "创建失败")
    } finally {
      setIsCreating(false)
    }
  }

  // ── Tab 1：活动基础配置 ──────────────────────────────────────
  const [editName, setEditName] = useState("")
  const [editStart, setEditStart] = useState("")
  const [editEnd, setEditEnd] = useState("")
  const [editActive, setEditActive] = useState(true)
  const [isSavingBasic, setIsSavingBasic] = useState(false)

  // 选中活动后同步表单
  const syncBasicForm = (a: Activity) => {
    setEditName(a.name)
    setEditStart(toDatetimeLocal(a.startTime))
    setEditEnd(toDatetimeLocal(a.endTime))
    setEditActive(a.isActive)
  }

  // 当详情加载完成后同步
  const [lastSyncedId, setLastSyncedId] = useState<string | null>(null)
  if (selectedActivity && selectedActivity.id !== lastSyncedId) {
    syncBasicForm(selectedActivity)
    setLastSyncedId(selectedActivity.id)
  }

  const handleSaveBasic = async () => {
    if (!selectedId) return
    if (!editName.trim()) { toast.error("请输入活动名称"); return }
    if (!editStart) { toast.error("请选择开始时间"); return }
    if (!editEnd) { toast.error("请选择结束时间"); return }

    setIsSavingBasic(true)
    try {
      const res = await fetch(`/api/admin/activity/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          startTime: toISOStart(editStart),
          endTime: toISOEnd(editEnd),
          isActive: editActive,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "保存失败")

      toast.success("活动配置已保存")
      await Promise.all([mutateList(), mutateDetail()])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "保存失败")
    } finally {
      setIsSavingBasic(false)
    }
  }

  // ── Tab 2：阶梯规则 ─────────────────────────────────────────
  const tiers = selectedActivity?.tiers ?? []

  const [isTierDialogOpen, setIsTierDialogOpen] = useState(false)
  const [editingTierId, setEditingTierId] = useState<string | null>(null)
  const [tierAmount, setTierAmount] = useState("")
  const [tierCredits, setTierCredits] = useState("")
  const [isSavingTier, setIsSavingTier] = useState(false)

  const openAddTier = () => {
    setEditingTierId(null)
    setTierAmount("")
    setTierCredits("")
    setIsTierDialogOpen(true)
  }

  const openEditTier = (tier: ActivityTier) => {
    setEditingTierId(tier.id)
    // DB 存储单位为分，表单展示为元
    setTierAmount(String((tier.conditions?.minAmount ?? 0) / 100))
    setTierCredits(String(tier.rewards?.credits ?? ""))
    setIsTierDialogOpen(true)
  }

  const handleSaveTier = async () => {
    if (!selectedId) return

    const amountVal = Number(tierAmount)
    const creditsVal = Number(tierCredits)

    if (!tierAmount || isNaN(amountVal) || amountVal <= 0) {
      toast.error("请输入有效的充值金额")
      return
    }
    if (!tierCredits || isNaN(creditsVal) || creditsVal <= 0) {
      toast.error("请输入有效的赠送积分")
      return
    }

    // 前端校验：金额不能与现有阶梯重复（DB 存分，转元后与输入比较）
    const allAmounts = tiers
      .filter(t => t.id !== editingTierId)
      .map(t => (t.conditions?.minAmount ?? 0) / 100)
    if (allAmounts.some(a => a === amountVal)) {
      toast.error("该金额档位已存在，请修改")
      return
    }

    setIsSavingTier(true)
    try {
      // 组装保存后新的全量阶梯（含本次修改），按 minAmount 全局重排
      // 注意：otherTiers 的 minAmount 从 DB 读取为分，统一转元再排序
      const otherTiers = tiers
        .filter(t => t.id !== editingTierId)
        .map(t => ({
          id: t.id,
          minAmount: (t.conditions?.minAmount ?? 0) / 100,  // 分→元，与用户输入单位统一
          credits: t.rewards?.credits ?? 0,
        }))

      const allTiersSorted = normalizeTierLevels([
        ...otherTiers,
        { minAmount: amountVal, credits: creditsVal },
      ])

      if (editingTierId) {
        // 更新：只需保存当前编辑的阶梯，tierLevel 用排序后的值
        const sortedEntry = allTiersSorted.find(
          t => t.conditions.minAmount === amountVal && t.rewards.credits === creditsVal
        )
        const res = await fetch(
          `/api/admin/activity/${selectedId}/tiers/${editingTierId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tierLevel: sortedEntry?.tierLevel ?? 1,
              conditions: { minAmount: amountVal * 100 },  // 元→分
              rewards: { credits: creditsVal },
            }),
          }
        )
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || "更新失败")

        // 同时更新其他阶梯的 tierLevel（保持全局有序，conditions.minAmount 转回分）
        await Promise.all(
          allTiersSorted
            .filter(t => t.id && t.id !== editingTierId)
            .map(t =>
              fetch(`/api/admin/activity/${selectedId}/tiers/${t.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  tierLevel: t.tierLevel,
                  conditions: { minAmount: t.conditions.minAmount * 100 },  // 元→分
                  rewards: t.rewards,
                }),
              })
            )
        )
      } else {
        // 新增：先 POST 新阶梯，再全量重排
        const newTierEntry = allTiersSorted.find(
          t => !t.id && t.conditions.minAmount === amountVal
        )
        const res = await fetch(`/api/admin/activity/${selectedId}/tiers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tierLevel: newTierEntry?.tierLevel ?? allTiersSorted.length,
            conditions: { minAmount: amountVal * 100 },  // 元→分
            rewards: { credits: creditsVal },
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || "创建失败")

        // 更新已有阶梯的 tierLevel（conditions.minAmount 转回分）
        await Promise.all(
          allTiersSorted
            .filter(t => t.id)
            .map(t =>
              fetch(`/api/admin/activity/${selectedId}/tiers/${t.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  tierLevel: t.tierLevel,
                  conditions: { minAmount: t.conditions.minAmount * 100 },  // 元→分
                  rewards: t.rewards,
                }),
              })
            )
        )
      }

      toast.success(editingTierId ? "阶梯已更新" : "阶梯已创建")
      setIsTierDialogOpen(false)
      await mutateDetail()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "操作失败")
    } finally {
      setIsSavingTier(false)
    }
  }

  const handleDeleteTier = async (tier: ActivityTier) => {
    if (!selectedId) return
    if (!confirm(`确认删除第 ${tier.tierLevel} 档阶梯（满 ¥${(tier.conditions?.minAmount ?? 0) / 100}）？`)) return

    try {
      const res = await fetch(
        `/api/admin/activity/${selectedId}/tiers/${tier.id}`,
        { method: "DELETE" }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "删除失败")

      toast.success("阶梯已删除")
      await mutateDetail()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "删除失败")
    }
  }

  // ── Tab 3：气氛组管理 ───────────────────────────────────────
  const virtualEntries = selectedActivity?.virtualLeaderboard ?? []

  const [isVirtualDialogOpen, setIsVirtualDialogOpen] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [vName, setVName] = useState("")
  const [vAvatar, setVAvatar] = useState("")
  const [vAmount, setVAmount] = useState("")
  const [isSavingVirtual, setIsSavingVirtual] = useState(false)

  const openAddVirtual = () => {
    setEditingEntryId(null)
    setVName(randomName())
    setVAvatar(randomAvatar())
    setVAmount("")
    setIsVirtualDialogOpen(true)
  }

  const openEditVirtual = (entry: VirtualLeaderboardEntry) => {
    setEditingEntryId(entry.id)
    setVName(entry.fakeName)
    setVAvatar(entry.fakeAvatar ?? "")
    setVAmount(String(entry.fakeAmount / 100))  // DB 存分，表单展示为元
    setIsVirtualDialogOpen(true)
  }

  const handleSaveVirtual = async () => {
    if (!selectedId) return
    if (!vName.trim()) { toast.error("请输入昵称"); return }
    const amtVal = Number(vAmount)
    if (!vAmount || isNaN(amtVal) || amtVal < 0) {
      toast.error("请输入有效的充值金额")
      return
    }

    setIsSavingVirtual(true)
    try {
      if (editingEntryId) {
        const res = await fetch(
          `/api/admin/activity/virtual-leaderboard/${editingEntryId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fakeName: vName.trim(),
              ...(vAvatar.trim() ? { fakeAvatar: vAvatar.trim() } : {}),
              fakeAmount: amtVal * 100,  // 元→分
            }),
          }
        )
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || "更新失败")
        toast.success("气氛组成员已更新")
      } else {
        const res = await fetch("/api/admin/activity/virtual-leaderboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activityId: selectedId,
            fakeName: vName.trim(),
            ...(vAvatar.trim() ? { fakeAvatar: vAvatar.trim() } : {}),
            fakeAmount: amtVal * 100,  // 元→分
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || "创建失败")
        toast.success("气氛组成员已添加")
      }

      setIsVirtualDialogOpen(false)
      await mutateDetail()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "操作失败")
    } finally {
      setIsSavingVirtual(false)
    }
  }

  const handleDeleteVirtual = async (entry: VirtualLeaderboardEntry) => {
    if (!confirm(`确认删除「${entry.fakeName}」？`)) return
    try {
      const res = await fetch(
        `/api/admin/activity/virtual-leaderboard/${entry.id}`,
        { method: "DELETE" }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "删除失败")
      toast.success("已删除")
      await mutateDetail()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "删除失败")
    }
  }

  // ── 渲染 ───────────────────────────────────────────────────

  if (listLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 bg-white/5" />
        <Skeleton className="h-96 w-full bg-white/5 rounded-2xl" />
      </div>
    )
  }

  if (listError) {
    return (
      <div className="glass rounded-3xl border border-white/10 p-8 text-rose-400">
        加载失败：{String(listError?.message ?? listError)}
      </div>
    )
  }

  const currentStatus = selectedActivity ? getActivityStatus(selectedActivity) : null

  return (
    <>
      {/* ─── 页面顶部 ─────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white text-2xl font-bold">拉新活动控制台</h1>
              {currentStatus && (
                <Badge className={cn("text-xs", statusColor[currentStatus])}>
                  {currentStatus}
                </Badge>
              )}
            </div>
            <p className="text-slate-400 text-sm">
              管理推荐充值活动、阶梯规则和虚拟气氛排行榜
            </p>
          </div>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-2" />
          新建活动
        </Button>
      </div>

      {/* ─── 活动选择器 ───────────────────────────────────────── */}
      <div className="mb-6 bg-slate-900/50 border border-white/10 rounded-2xl p-4">
        <label className="block text-xs text-slate-400 mb-2">选择管理的活动</label>
        {activities.length === 0 ? (
          <p className="text-slate-500 text-sm">暂无活动，请点击「新建活动」创建第一个</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activities.map(a => {
              const st = getActivityStatus(a)
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all cursor-pointer",
                    selectedId === a.id
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 border-transparent text-white shadow-lg shadow-purple-500/20"
                      : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span>{a.name}</span>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    st === "进行中" ? "bg-emerald-500/20 text-emerald-400" :
                    st === "未开始" ? "bg-slate-500/20 text-slate-400" :
                    "bg-rose-500/20 text-rose-400"
                  )}>
                    {st}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Tabs 主体 ────────────────────────────────────────── */}
      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="bg-slate-900/50 border border-white/10 p-1 rounded-xl">
          <TabsTrigger
            value="basic"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white text-slate-400 rounded-lg cursor-pointer"
          >
            <Calendar className="w-4 h-4 mr-1.5" />
            活动基础配置
          </TabsTrigger>
          <TabsTrigger
            value="tiers"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white text-slate-400 rounded-lg cursor-pointer"
          >
            <Trophy className="w-4 h-4 mr-1.5" />
            阶梯规则引擎
          </TabsTrigger>
          <TabsTrigger
            value="virtual"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white text-slate-400 rounded-lg cursor-pointer"
          >
            <Users className="w-4 h-4 mr-1.5" />
            气氛组管理
          </TabsTrigger>
          <TabsTrigger
            value="rewards"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white text-slate-400 rounded-lg cursor-pointer"
          >
            <Gift className="w-4 h-4 mr-1.5" />
            奖励发放
          </TabsTrigger>
        </TabsList>

        {/* ══════════ Tab 1：活动基础配置 ══════════ */}
        <TabsContent value="basic">
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
            {!selectedId ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-500 text-sm">请先选择或创建一个活动</p>
              </div>
            ) : detailLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
              </div>
            ) : (
              <div className="space-y-5 max-w-lg">
                {/* 活动名称 */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">活动名称</label>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="例如：3月春季充值活动"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                </div>

                {/* 开始时间 */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">开始时间</label>
                  <Input
                    type="datetime-local"
                    value={editStart}
                    onChange={e => setEditStart(e.target.value)}
                    className="bg-white/5 border-white/10 text-white [color-scheme:dark]"
                  />
                </div>

                {/* 结束时间 */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">
                    结束时间
                    <span className="ml-2 text-slate-500 text-xs">（保存时自动设为当天 23:59:59）</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={editEnd}
                    onChange={e => setEditEnd(e.target.value)}
                    className="bg-white/5 border-white/10 text-white [color-scheme:dark]"
                  />
                </div>

                {/* 活动开关 */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <span className="text-sm text-white">活动开关</span>
                    <p className="text-xs text-slate-500 mt-0.5">关闭后用户将无法参与此活动</p>
                  </div>
                  <button
                    onClick={() => setEditActive(v => !v)}
                    className={cn(
                      "transition-colors cursor-pointer",
                      editActive ? "text-emerald-400" : "text-slate-500"
                    )}
                    aria-label={editActive ? "禁用活动" : "启用活动"}
                  >
                    {editActive ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8" />
                    )}
                  </button>
                </div>

                {/* 统计信息 */}
                {selectedActivity?._count && (
                  <div className="flex gap-3 text-sm text-slate-500">
                    <span>已参与：{selectedActivity._count.activityReferrals} 人</span>
                    <span>·</span>
                    <span>
                      创建于 {new Date(selectedActivity.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                )}

                <Button
                  onClick={handleSaveBasic}
                  disabled={isSavingBasic}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white cursor-pointer"
                >
                  {isSavingBasic ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  保存修改
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════ Tab 2：阶梯规则引擎 ══════════ */}
        <TabsContent value="tiers">
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
            {!selectedId ? (
              <EmptyStateGuard />
            ) : detailLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-20 w-full bg-white/5 rounded-2xl" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-slate-400 text-sm">
                    共 {tiers.length} 个阶梯，按充值金额自动排序
                  </p>
                  <Button
                    onClick={openAddTier}
                    disabled={!selectedId}
                    size="sm"
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white cursor-pointer"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    新增阶梯
                  </Button>
                </div>

                {tiers.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                    <p className="text-slate-500 text-sm">暂无阶梯，点击「新增阶梯」添加</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {tiers.map(tier => (
                        <motion.div
                          key={tier.id}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          className="bg-slate-800/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-purple-500/30 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                              {tier.tierLevel}
                            </div>
                            <div>
                              <div className="text-white font-medium text-sm">
                                充值满{" "}
                                <span className="text-purple-300">
                                  ¥{((tier.conditions?.minAmount ?? 0) / 100).toLocaleString("zh-CN")}
                                </span>
                              </div>
                              <div className="text-slate-400 text-xs mt-0.5">
                                赠送{" "}
                                <span className="text-pink-300">
                                  {tier.rewards?.credits ?? "—"} 积分
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditTier(tier)}
                              className="border-white/10 bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteTier(tier)}
                              className="border-white/10 bg-rose-500/10 hover:bg-rose-500/20 text-red-400 hover:text-red-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* ══════════ Tab 3：气氛组管理 ══════════ */}
        <TabsContent value="virtual">
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
            {!selectedId ? (
              <EmptyStateGuard />
            ) : detailLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-14 w-full bg-white/5 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-slate-400 text-sm">
                    共 {virtualEntries.length} 位气氛组成员
                  </p>
                  <Button
                    onClick={openAddVirtual}
                    disabled={!selectedId}
                    size="sm"
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white cursor-pointer"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    添加假人
                  </Button>
                </div>

                {virtualEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                    <p className="text-slate-500 text-sm">暂无气氛组成员，点击「添加假人」开始</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="text-slate-400 text-xs uppercase tracking-wider">
                            头像
                          </TableHead>
                          <TableHead className="text-slate-400 text-xs uppercase tracking-wider">
                            昵称
                          </TableHead>
                          <TableHead className="text-slate-400 text-xs uppercase tracking-wider">
                            设定充值金额（元）
                          </TableHead>
                          <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">
                            操作
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence>
                          {virtualEntries.map(entry => (
                            <TableRow
                              key={entry.id}
                              className="border-white/5 hover:bg-white/5 transition-colors"
                            >
                              <TableCell>
                                <Avatar className="w-8 h-8">
                                  <AvatarImage
                                    src={entry.fakeAvatar ?? undefined}
                                    alt={entry.fakeName}
                                  />
                                  <AvatarFallback className="bg-purple-600/20 text-purple-300 text-xs">
                                    {entry.fakeName.slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                              </TableCell>
                              <TableCell className="text-white font-medium">
                                {entry.fakeName}
                              </TableCell>
                              <TableCell className="text-slate-300">
                                ¥{(entry.fakeAmount / 100).toLocaleString("zh-CN")}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditVirtual(entry)}
                                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteVirtual(entry)}
                                    className="border-white/10 bg-rose-500/10 hover:bg-rose-500/20 text-red-400 hover:text-red-300 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* ══════════ Tab 4：奖励发放 ══════════ */}
        <TabsContent value="rewards">
          <RewardsTab selectedId={selectedId} />
        </TabsContent>
      </Tabs>

      {/* ══════════ Dialog：新建活动 ══════════ */}
      <AnimatePresence>
        {isCreateOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsCreateOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-white font-semibold text-lg">新建活动</h2>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">活动名称</label>
                  <Input
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    placeholder="例如：3月春季充值活动"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">开始时间</label>
                  <Input
                    type="datetime-local"
                    value={createStart}
                    onChange={e => setCreateStart(e.target.value)}
                    className="bg-white/5 border-white/10 text-white [color-scheme:dark]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">
                    结束时间
                    <span className="ml-2 text-slate-500 text-xs">（自动设为当天 23:59:59）</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={createEnd}
                    onChange={e => setCreateEnd(e.target.value)}
                    className="bg-white/5 border-white/10 text-white [color-scheme:dark]"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <span className="text-sm text-white">创建后立即启用</span>
                  <button
                    onClick={() => setCreateActive(v => !v)}
                    className={cn(
                      "transition-colors cursor-pointer",
                      createActive ? "text-emerald-400" : "text-slate-500"
                    )}
                    aria-label={createActive ? "取消启用" : "立即启用"}
                  >
                    {createActive ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                >
                  取消
                </Button>
                <Button
                  onClick={handleCreateActivity}
                  disabled={isCreating}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white cursor-pointer"
                >
                  {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  创建活动
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════ Dialog：新增/编辑阶梯 ══════════ */}
      <AnimatePresence>
        {isTierDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsTierDialogOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-white font-semibold text-lg">
                  {editingTierId ? "编辑阶梯" : "新增阶梯"}
                </h2>
                <button
                  onClick={() => setIsTierDialogOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">
                    目标充值金额（元）
                    <span className="ml-2 text-slate-500">达成条件</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={tierAmount}
                    onChange={e => setTierAmount(e.target.value)}
                    placeholder="例如：1000"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">
                    赠送积分额度
                    <span className="ml-2 text-slate-500">奖励内容</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={tierCredits}
                    onChange={e => setTierCredits(e.target.value)}
                    placeholder="例如：500"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                </div>

                {tierAmount && tierCredits && (
                  <div className="p-3 bg-purple-600/10 border border-purple-500/20 rounded-xl text-sm text-slate-300">
                    预览：充值满{" "}
                    <span className="text-purple-300 font-medium">¥{tierAmount}</span>
                    {" "}→ 赠送{" "}
                    <span className="text-pink-300 font-medium">{tierCredits} 积分</span>
                  </div>
                )}

                <p className="text-xs text-slate-500">
                  保存后系统将按充值金额自动重新排序所有阶梯层级
                </p>
              </div>

              <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsTierDialogOpen(false)}
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                >
                  取消
                </Button>
                <Button
                  onClick={handleSaveTier}
                  disabled={isSavingTier}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white cursor-pointer"
                >
                  {isSavingTier ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {editingTierId ? "保存" : "创建"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════ Dialog：新增/编辑气氛组成员 ══════════ */}
      <AnimatePresence>
        {isVirtualDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsVirtualDialogOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-white font-semibold text-lg">
                  {editingEntryId ? "编辑气氛组成员" : "添加假人"}
                </h2>
                <button
                  onClick={() => setIsVirtualDialogOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* 头像预览 */}
                <div className="flex items-center gap-4">
                  <Avatar className="w-14 h-14 border border-white/10">
                    <AvatarImage src={vAvatar || undefined} alt={vName} />
                    <AvatarFallback className="bg-purple-600/20 text-purple-300">
                      {vName.slice(0, 2) || "？"}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setVAvatar(randomAvatar())}
                    className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5 mr-1.5" />
                    随机头像
                  </Button>
                </div>

                {/* 头像 URL */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">头像 URL（留空自动生成）</label>
                  <Input
                    value={vAvatar}
                    onChange={e => setVAvatar(e.target.value)}
                    placeholder="https://..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-xs"
                  />
                </div>

                {/* 昵称 */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">虚拟昵称</label>
                  <div className="flex gap-2">
                    <Input
                      value={vName}
                      onChange={e => setVName(e.target.value)}
                      placeholder="例如：王小丽"
                      className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setVName(randomName())}
                      className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 shrink-0 cursor-pointer"
                      title="随机生成昵称"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* 金额 */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">设定充值金额（元）</label>
                  <Input
                    type="number"
                    min={0}
                    value={vAmount}
                    onChange={e => setVAmount(e.target.value)}
                    placeholder="例如：5000"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsVirtualDialogOpen(false)}
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                >
                  取消
                </Button>
                <Button
                  onClick={handleSaveVirtual}
                  disabled={isSavingVirtual}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white cursor-pointer"
                >
                  {isSavingVirtual ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {editingEntryId ? "保存" : "添加"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ============================================================
// Tab 4：奖励发放子组件
// ============================================================

type RewardRow = {
  inviterId: string
  inviterName: string
  totalAmount: number       // 分
  inviteCount: number
  tierLevel: number | null
  creditsToGrant: number
  distributed: boolean
  distributedAmount: number
}

type RewardsResponse = {
  activity: { id: string; name: string }
  rewards: RewardRow[]
}

function RewardsTab({ selectedId }: { selectedId: string | null }) {
  const {
    data,
    isLoading,
    error,
    mutate,
  } = useSWR<RewardsResponse>(
    selectedId ? `/api/admin/activity/${selectedId}/rewards` : null,
    fetcher
  )

  const [distributing, setDistributing] = useState<string | "ALL" | null>(null)

  const rewards = data?.rewards ?? []
  const pendingCount = rewards.filter((r) => !r.distributed && r.creditsToGrant > 0).length
  const distributedCount = rewards.filter((r) => r.distributed).length

  const handleDistribute = async (inviterIds: string[]) => {
    if (!selectedId) return
    const isAll = inviterIds[0] === "__ALL__"
    setDistributing(isAll ? "ALL" : inviterIds[0])
    try {
      const res = await fetch(`/api/admin/activity/${selectedId}/rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviterIds }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "发放失败")

      toast.success(
        isAll
          ? `已发放 ${json.granted} 人，跳过 ${json.skipped} 人`
          : "积分已发放"
      )
      await mutate()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "发放失败")
    } finally {
      setDistributing(null)
    }
  }

  if (!selectedId) return <EmptyStateGuard />

  if (isLoading) {
    return (
      <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full bg-white/5 rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 text-rose-400 text-sm">
        加载失败：{String(error?.message ?? error)}
      </div>
    )
  }

  return (
    <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span>共 <span className="text-white font-medium">{rewards.length}</span> 位邀请人</span>
          <span className="text-slate-600">·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            待发放 <span className="text-amber-400 font-medium ml-1">{pendingCount}</span> 人
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            已发放 <span className="text-emerald-400 font-medium ml-1">{distributedCount}</span> 人
          </span>
        </div>

        {pendingCount > 0 && (
          <Button
            onClick={() => handleDistribute(["__ALL__"])}
            disabled={distributing === "ALL"}
            size="sm"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white cursor-pointer"
          >
            {distributing === "ALL" ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Gift className="w-4 h-4 mr-1.5" />
            )}
            一键发放全部（{pendingCount} 人）
          </Button>
        )}
      </div>

      {rewards.length === 0 ? (
        <div className="text-center py-12">
          <Gift className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <p className="text-slate-500 text-sm">暂无拉新数据</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-slate-400 text-xs uppercase tracking-wider">邀请人</TableHead>
                <TableHead className="text-slate-400 text-xs uppercase tracking-wider">累计拉新金额</TableHead>
                <TableHead className="text-slate-400 text-xs uppercase tracking-wider">有效人数</TableHead>
                <TableHead className="text-slate-400 text-xs uppercase tracking-wider">达成档位</TableHead>
                <TableHead className="text-slate-400 text-xs uppercase tracking-wider">应发积分</TableHead>
                <TableHead className="text-slate-400 text-xs uppercase tracking-wider">状态</TableHead>
                <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewards.map((row) => (
                <TableRow key={row.inviterId} className="border-white/5 hover:bg-white/5 transition-colors">
                  <TableCell className="text-white font-medium">{row.inviterName}</TableCell>
                  <TableCell className="text-slate-300">
                    ¥{(row.totalAmount / 100).toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell className="text-slate-300">{row.inviteCount} 人</TableCell>
                  <TableCell>
                    {row.tierLevel ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/20">
                        第 {row.tierLevel} 档
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">未达标</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "font-semibold",
                      row.creditsToGrant > 0 ? "text-pink-300" : "text-slate-600"
                    )}>
                      {row.creditsToGrant > 0 ? `+${row.creditsToGrant}` : "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.distributed ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        已发放
                      </span>
                    ) : row.creditsToGrant > 0 ? (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                        待发放
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">无需发放</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!row.distributed && row.creditsToGrant > 0 && (
                      <Button
                        size="sm"
                        onClick={() => handleDistribute([row.inviterId])}
                        disabled={distributing === row.inviterId}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white cursor-pointer text-xs"
                      >
                        {distributing === row.inviterId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "发放"
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
