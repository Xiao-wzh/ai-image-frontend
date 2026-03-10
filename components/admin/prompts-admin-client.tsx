"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  Search,
  Image,
  FileText,
  User,
  Shield,
  ChevronRight,
  Power,
  PowerOff,
  Settings,
  Wand2,
  Zap,
  Hash,
  Globe,
  Lock,
  LayoutList,
  X,
  Crown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { PromptEditor } from "@/components/admin/prompt-editor"

// Types
interface Prompt {
  id: string
  productType: string
  taskType: string
  mode: string
  qualityMode: string
  description: string | null
  promptTemplate: string
  isActive: boolean
  userId: string | null
  user?: {
    id: string
    email: string
    username: string | null
    name: string | null
  } | null
  createdAt: string
  updatedAt: string
}

interface PlatformNode {
  id: string
  key: string
  label: string
  sortOrder: number
  isActive: boolean
  prompts: Prompt[]
}

interface AdminPromptsResponse {
  success: boolean
  platforms: PlatformNode[]
}

interface AdminUser {
  id: string
  email: string
  username: string | null
  name: string | null
  role: string
  createdAt: string
}

interface UsersResponse {
  success: boolean
  users: AdminUser[]
}

type Scope = "all" | "system" | "private"
type TaskType = "MAIN_IMAGE" | "DETAIL_PAGE"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("加载失败")
  return res.json()
}

const userLabel = (u?: AdminUser | null) => {
  if (!u) return "未知用户"
  return u.username || u.name || u.email
}

function formatRelativeTime(dateString: string): string {
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

export function PromptsAdminClient() {
  // Filters
  const [taskType, setTaskType] = useState<TaskType>("MAIN_IMAGE")
  const [promptMode, setPromptMode] = useState<"CREATIVE" | "CLONE">("CREATIVE")
  const [qualityModeFilter, setQualityModeFilter] = useState<"STANDARD" | "PRO">("STANDARD")
  const [activePlatformId, setActivePlatformId] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Editor state
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [editDraft, setEditDraft] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editProductType, setEditProductType] = useState("")
  const [editMode, setEditMode] = useState<"CREATIVE" | "CLONE">("CREATIVE")
  const [editQualityMode, setEditQualityMode] = useState<"STANDARD" | "PRO">("STANDARD")
  const [editIsActive, setEditIsActive] = useState(true)
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Data fetching
  const { data, error, isLoading, mutate } = useSWR<AdminPromptsResponse>(
    `/api/admin/prompts?scope=${scope}`,
    fetcher
  )
  const { data: usersData } = useSWR<UsersResponse>("/api/admin/users", fetcher)

  const platforms = data?.platforms || []
  const users = usersData?.users || []

  // Auto-select first platform
  useEffect(() => {
    if (platforms.length > 0 && !activePlatformId) {
      setActivePlatformId(platforms[0].id)
    }
  }, [platforms, activePlatformId])

  // Get current platform
  const currentPlatform = useMemo(() => {
    return platforms.find((p) => p.id === activePlatformId) || null
  }, [platforms, activePlatformId])

  // Filter prompts by taskType, mode, and search
  const filteredPrompts = useMemo(() => {
    if (!currentPlatform) return []
    let prompts = currentPlatform.prompts.filter(
      (p) => p.taskType === taskType && (p.mode || "CREATIVE") === promptMode && (p.qualityMode || "STANDARD") === qualityModeFilter
    )

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      prompts = prompts.filter(
        (p) =>
          p.productType.toLowerCase().includes(query) ||
          (p.description?.toLowerCase().includes(query) ?? false) ||
          p.promptTemplate.toLowerCase().includes(query)
      )
    }

    return prompts
  }, [currentPlatform, taskType, promptMode, qualityModeFilter, searchQuery])

  // Compute stats
  const stats = useMemo(() => {
    const allPrompts = platforms.flatMap((p) => p.prompts)
    return {
      total: allPrompts.length,
      system: allPrompts.filter((p) => !p.userId).length,
      private: allPrompts.filter((p) => p.userId).length,
      active: allPrompts.filter((p) => p.isActive).length,
      inactive: allPrompts.filter((p) => !p.isActive).length,
    }
  }, [platforms])

  // Get selected prompt
  const selectedPrompt = useMemo(() => {
    if (!selectedPromptId) return null
    return filteredPrompts.find((p) => p.id === selectedPromptId) || null
  }, [filteredPrompts, selectedPromptId])

  // Sync editor when selection changes
  useEffect(() => {
    if (selectedPrompt && !isCreating) {
      setEditDraft(selectedPrompt.promptTemplate)
      setEditDescription(selectedPrompt.description || "")
      setEditProductType(selectedPrompt.productType)
      setEditIsActive(selectedPrompt.isActive)
      setEditUserId(selectedPrompt.userId)
      setEditQualityMode((selectedPrompt.qualityMode as "STANDARD" | "PRO") || "STANDARD")
    }
  }, [selectedPrompt, isCreating])

  // Reset selection when filters change
  useEffect(() => {
    setSelectedPromptId(null)
    setIsCreating(false)
  }, [taskType, activePlatformId, promptMode, qualityModeFilter])

  const isDirty = useMemo(() => {
    if (isCreating) return editDraft.trim().length > 0
    if (!selectedPrompt) return false
    return editDraft !== selectedPrompt.promptTemplate
  }, [isCreating, selectedPrompt, editDraft])

  // Action handlers
  const handleSave = useCallback(async () => {
    if (!selectedPrompt || isCreating) return
    if (!editDraft.trim()) {
      toast.error("Prompt 内容不能为空")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/admin/prompts/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedPrompt.id, promptTemplate: editDraft, qualityMode: editQualityMode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "保存失败")
      toast.success("保存成功")
      mutate()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }, [selectedPrompt, isCreating, editDraft, mutate])

  const handleCreate = useCallback(async () => {
    if (!activePlatformId || !editProductType.trim() || !editDraft.trim()) {
      toast.error("请填写完整信息")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/admin/prompts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformId: activePlatformId,
          productType: editProductType.trim(),
          taskType,
          mode: editMode,
          qualityMode: editQualityMode,
          description: editDescription.trim() || null,
          promptTemplate: editDraft.trim(),
          userId: editUserId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "创建失败")
      toast.success("创建成功")
      setIsCreating(false)
      mutate()
      setSelectedPromptId(data.prompt?.id || null)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }, [activePlatformId, editProductType, taskType, editMode, editQualityMode, editDescription, editDraft, editUserId, mutate])

  const handleDelete = useCallback(async () => {
    if (!selectedPrompt) return
    if (!confirm("确定删除这条 Prompt？此操作不可恢复。")) return

    setDeleting(true)
    try {
      const res = await fetch("/api/admin/prompts/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedPrompt.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "删除失败")
      toast.success("删除成功")
      setSelectedPromptId(null)
      mutate()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
    }
  }, [selectedPrompt, mutate])

  const handleToggleActive = useCallback(async () => {
    if (!selectedPrompt) return

    try {
      const res = await fetch("/api/admin/prompts/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedPrompt.id, isActive: !selectedPrompt.isActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "切换失败")
      toast.success(data.prompt?.isActive ? "已启用" : "已禁用")
      mutate()
    } catch (e: any) {
      toast.error(e.message)
    }
  }, [selectedPrompt, mutate])

  const startCreate = useCallback(() => {
    setIsCreating(true)
    setSelectedPromptId(null)
    setEditDraft("")
    setEditDescription("")
    setEditProductType("")
    setEditMode(promptMode)
    setEditQualityMode(qualityModeFilter)
    setEditIsActive(true)
    setEditUserId(null)
  }, [promptMode, qualityModeFilter])

  const cancelCreate = useCallback(() => {
    setIsCreating(false)
    setEditDraft("")
  }, [])

  if (error) {
    return (
      <div className="p-8 text-center text-red-400">
        加载失败: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <Settings className="w-7 h-7 text-purple-400" />
            </div>
            提示词管理
          </h1>
          <p className="text-slate-400 mt-1.5 ml-14">管理各平台的 Prompt 模板配置</p>
        </div>

        {/* Stats Capsules */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 flex-wrap"
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-white/10">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">总计</span>
            <span className="text-sm font-semibold text-white">{stats.total}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-blue-300">系统</span>
            <span className="text-sm font-semibold text-blue-300">{stats.system}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Lock className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-purple-300">私有</span>
            <span className="text-sm font-semibold text-purple-300">{stats.private}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <Power className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-green-300">启用</span>
            <span className="text-sm font-semibold text-green-300">{stats.active}</span>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Unified Toolbar ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-wrap items-center gap-3 bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-xl p-3"
      >
        {/* Task Type Toggle */}
        <Tabs value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
          <TabsList className="bg-slate-800/60 border border-white/10 p-0.5 h-9">
            <TabsTrigger
              value="MAIN_IMAGE"
              className="cursor-pointer data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white px-4 gap-1.5 h-8 text-xs"
            >
              <Image className="w-3.5 h-3.5" />
              电商主图
            </TabsTrigger>
            <TabsTrigger
              value="DETAIL_PAGE"
              className="cursor-pointer data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white px-4 gap-1.5 h-8 text-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              详情长图
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Divider */}
        <div className="w-px h-7 bg-white/10 hidden sm:block" />

        {/* Mode Toggle - Creative vs Clone */}
        <Tabs value={promptMode} onValueChange={(v) => setPromptMode(v as "CREATIVE" | "CLONE")}>
          <TabsList className="bg-slate-800/60 border border-white/10 p-0.5 h-9">
            <TabsTrigger
              value="CREATIVE"
              className="cursor-pointer data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white px-4 gap-1.5 h-8 text-xs"
            >
              <Wand2 className="w-3.5 h-3.5" />
              创意模式
            </TabsTrigger>
            <TabsTrigger
              value="CLONE"
              className="cursor-pointer data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-600 data-[state=active]:text-white px-4 gap-1.5 h-8 text-xs"
            >
              <Zap className="w-3.5 h-3.5" />
              克隆模式
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Divider */}
        <div className="w-px h-7 bg-white/10 hidden sm:block" />

        {/* Quality Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-0.5 border border-white/10">
          <button
            onClick={() => setQualityModeFilter("STANDARD")}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer h-8",
              qualityModeFilter === "STANDARD"
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            标准极速
          </button>
          <button
            onClick={() => setQualityModeFilter("PRO")}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer h-8",
              qualityModeFilter === "PRO"
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            <Crown className="w-3.5 h-3.5" />
            PRO 增强
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-7 bg-white/10 hidden sm:block" />

        {/* Scope Filter */}
        <div className="flex items-center gap-1 bg-slate-800/40 rounded-lg p-0.5 border border-white/5">
          {(
            [
              { value: "all" as Scope, label: "全部", icon: LayoutList },
              { value: "system" as Scope, label: "系统", icon: Shield },
              { value: "private" as Scope, label: "私有", icon: User },
            ] as const
          ).map((item) => (
            <button
              key={item.value}
              onClick={() => setScope(item.value)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer",
                scope === item.value
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              )}
            >
              <item.icon className="w-3 h-3" />
              {item.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Platform Tabs ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2 overflow-x-auto pb-1"
      >
        {platforms.map((p, i) => {
          const promptCount = p.prompts.filter(
            (pr) => pr.taskType === taskType && (pr.mode || "CREATIVE") === promptMode && (pr.qualityMode || "STANDARD") === qualityModeFilter
          ).length
          return (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.03 }}
              onClick={() => setActivePlatformId(p.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer",
                activePlatformId === p.id
                  ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30 shadow-lg shadow-blue-500/5"
                  : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
              )}
            >
              {p.label}
              <span className={cn(
                "ml-2 text-[10px] px-1.5 py-0.5 rounded-full",
                activePlatformId === p.id
                  ? "bg-white/15 text-white/80"
                  : "bg-white/5 text-slate-500"
              )}>
                {promptCount}
              </span>
            </motion.button>
          )
        })}
      </motion.div>

      {/* ── Main Content — Split View ── */}
      <div className="flex gap-4" style={{ height: "calc(100vh - 340px)", minHeight: "400px" }}>
        {/* Left Sidebar — Prompt List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="w-80 shrink-0 flex flex-col bg-slate-900/50 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden"
        >
          {/* Sidebar Header */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索 prompt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Prompt List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  <span className="text-xs text-slate-500">加载中...</span>
                </div>
              </div>
            ) : filteredPrompts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-3 bg-slate-800/50 rounded-xl mb-3">
                  <FileText className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-sm text-slate-500">暂无 Prompt</p>
                <p className="text-xs text-slate-600 mt-1">点击下方按钮创建新的 Prompt</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {filteredPrompts.map((prompt, i) => (
                  <motion.button
                    key={prompt.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                    onClick={() => {
                      setIsCreating(false)
                      setSelectedPromptId(prompt.id)
                    }}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-all group cursor-pointer",
                      selectedPromptId === prompt.id && !isCreating
                        ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 shadow-lg shadow-blue-500/5"
                        : "hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm truncate">
                          {prompt.description || prompt.productType}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400 font-mono">
                            {prompt.productType}
                          </span>
                          {prompt.userId ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 flex items-center gap-0.5">
                              <User className="w-2.5 h-2.5" />
                              私有
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 flex items-center gap-0.5">
                              <Shield className="w-2.5 h-2.5" />
                              系统
                            </span>
                          )}
                          {(prompt.qualityMode || "STANDARD") === "PRO" ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 flex items-center gap-0.5 font-medium">
                              <Crown className="w-2.5 h-2.5" />
                              PRO
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400 flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" />
                              标准
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-600 mt-1">
                          {formatRelativeTime(prompt.updatedAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full ring-2",
                            prompt.isActive
                              ? "bg-green-500 ring-green-500/20"
                              : "bg-red-500 ring-red-500/20"
                          )}
                        />
                        <ChevronRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Create Button */}
          <div className="p-3 border-t border-white/10">
            <Button
              onClick={startCreate}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-500/10 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              新建 Prompt
            </Button>
          </div>
        </motion.div>

        {/* Right Editor */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="flex-1 flex flex-col bg-slate-900/50 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden"
        >
          {!selectedPrompt && !isCreating ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
              <div className="p-5 bg-slate-800/30 rounded-2xl">
                <FileText className="w-12 h-12 text-slate-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-400">选择一个 Prompt 进行编辑</p>
                <p className="text-xs text-slate-600 mt-1">或点击左侧 &quot;新建 Prompt&quot; 创建新模板</p>
              </div>
            </div>
          ) : (
            <>
              {/* Editor Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-white truncate">
                    {isCreating ? "新建 Prompt" : selectedPrompt?.description || selectedPrompt?.productType}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    {isCreating ? (
                      <>
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {currentPlatform?.label}
                        </span>
                        <span className="text-slate-700">/</span>
                        <span>{taskType === "MAIN_IMAGE" ? "电商主图" : "详情长图"}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-slate-600">
                          {selectedPrompt?.id.slice(0, 8)}...
                        </span>
                        <span className="text-slate-700">|</span>
                        {selectedPrompt?.userId ? (
                          <span className="flex items-center gap-1 text-purple-400">
                            <User className="w-3 h-3" />
                            {selectedPrompt?.user?.email}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-blue-400">
                            <Shield className="w-3 h-3" />
                            系统默认
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {!isCreating && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleActive}
                        className={cn(
                          "border-white/10 cursor-pointer transition-all",
                          selectedPrompt?.isActive
                            ? "text-green-400 hover:text-green-300 hover:border-green-500/30"
                            : "text-red-400 hover:text-red-300 hover:border-red-500/30"
                        )}
                      >
                        {selectedPrompt?.isActive ? (
                          <>
                            <Power className="w-4 h-4 mr-1" />
                            启用中
                          </>
                        ) : (
                          <>
                            <PowerOff className="w-4 h-4 mr-1" />
                            已禁用
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer transition-all"
                      >
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </>
                  )}
                  {isCreating && (
                    <Button variant="outline" size="sm" onClick={cancelCreate} className="border-white/10 text-slate-400 cursor-pointer">
                      取消
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={isCreating ? handleCreate : handleSave}
                    disabled={saving || (!isDirty && !isCreating)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-blue-500/10 cursor-pointer transition-all"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                    {isCreating ? "创建" : "保存"}
                  </Button>
                </div>
              </div>

              {/* Editor Form */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isCreating && (
                  <>
                    {/* Mode Display */}
                    <div className="p-3 rounded-lg bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-white/10">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-400">创建模式:</span>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5",
                          editMode === "CREATIVE"
                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
                            : "bg-gradient-to-r from-amber-600 to-orange-600 text-white"
                        )}>
                          {editMode === "CREATIVE" ? (
                            <><Wand2 className="w-3 h-3" /> 创意模式</>
                          ) : (
                            <><Zap className="w-3 h-3" /> 克隆模式</>
                          )}
                        </span>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5",
                          editQualityMode === "PRO"
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                            : "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                        )}>
                          {editQualityMode === "PRO" ? (
                            <><Crown className="w-3 h-3" /> PRO 增强</>
                          ) : (
                            <><Zap className="w-3 h-3" /> 标准极速</>
                          )}
                        </span>
                        <span className="text-xs text-slate-500 ml-auto">
                          (由当前选中的标签决定)
                        </span>
                      </div>
                    </div>

                    {/* Product Type */}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">产品类型 (productType)</label>
                      <Input
                        value={editProductType}
                        onChange={(e) => setEditProductType(e.target.value.toUpperCase())}
                        placeholder="例如: MENSWEAR, BEDDING"
                        className="bg-white/5 border-white/10 text-white h-10"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">描述 (可选)</label>
                      <Input
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="例如: 男装, 寝具"
                        className="bg-white/5 border-white/10 text-white h-10"
                      />
                    </div>

                    {/* User (for private prompts) */}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">归属用户 (留空为系统默认)</label>
                      <Select value={editUserId || "_system"} onValueChange={(v) => setEditUserId(v === "_system" ? null : v)}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                          <SelectValue placeholder="系统默认" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10">
                          <SelectItem value="_system" className="text-white">系统默认</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id} className="text-white">
                              {userLabel(u)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quality Mode (edit only for create) */}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">画质引擎模式</label>
                      <Select value={editQualityMode} onValueChange={(v) => setEditQualityMode(v as "STANDARD" | "PRO")}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10">
                          <SelectItem value="STANDARD" className="text-white">⚡ 标准极速 (STANDARD)</SelectItem>
                          <SelectItem value="PRO" className="text-white">👑 PRO 增强</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Quality Mode — edit mode */}
                {!isCreating && selectedPrompt && (
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-white/10">
                    <label className="block text-sm font-medium text-slate-400 mb-2">画质引擎模式</label>
                    <Select value={editQualityMode} onValueChange={(v) => setEditQualityMode(v as "STANDARD" | "PRO")}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10">
                        <SelectItem value="STANDARD" className="text-white">⚡ 标准极速 (STANDARD)</SelectItem>
                        <SelectItem value="PRO" className="text-white">👑 PRO 增强</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Prompt Template */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-400">Prompt 模板</label>
                    <span className="text-xs text-slate-600 font-mono">
                      {editDraft.length.toLocaleString()} 字符
                    </span>
                  </div>
                  <PromptEditor
                    value={editDraft}
                    onChange={setEditDraft}
                    placeholder="输入 Prompt 模板内容..."
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>支持:</span>
                      <code className="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">{'{{productName}}'}</code>
                      <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{'{{#if proStyle}}...{{/if}}'}</code>
                      <code className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{'{{else}}'}</code>
                    </div>
                    {isDirty && !isCreating && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-xs text-amber-400 flex items-center gap-1"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        未保存的更改
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
