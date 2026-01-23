"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  Save,
  RotateCcw,
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// Types
interface Prompt {
  id: string
  productType: string
  taskType: string
  mode: string  // 添加 mode 字段
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

export function PromptsAdminClient() {
  // Filters
  const [taskType, setTaskType] = useState<TaskType>("MAIN_IMAGE")
  const [promptMode, setPromptMode] = useState<"CREATIVE" | "CLONE">("CREATIVE")  // New: mode filter
  const [activePlatformId, setActivePlatformId] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Editor state
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [editDraft, setEditDraft] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editProductType, setEditProductType] = useState("")
  const [editMode, setEditMode] = useState<"CREATIVE" | "CLONE">("CREATIVE")  // New: mode for create/edit
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
      (p) => p.taskType === taskType && (p.mode || "CREATIVE") === promptMode
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
  }, [currentPlatform, taskType, promptMode, searchQuery])

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
    }
  }, [selectedPrompt, isCreating])

  // Reset selection when filters change
  useEffect(() => {
    setSelectedPromptId(null)
    setIsCreating(false)
  }, [taskType, activePlatformId, promptMode])  // 添加 promptMode 到依赖

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
        body: JSON.stringify({ id: selectedPrompt.id, promptTemplate: editDraft }),
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
  }, [activePlatformId, editProductType, taskType, editMode, editDescription, editDraft, editUserId, mutate])

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
    setEditMode(promptMode)  // Use current mode filter
    setEditIsActive(true)
    setEditUserId(null)
  }, [promptMode])

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
    <div className="h-[calc(100vh-120px)] flex flex-col gap-4">
      {/* Top Control Bar */}
      <div className="space-y-4 shrink-0">
        {/* Task Type Toggle */}
        <Tabs value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
          <TabsList className="bg-slate-800/50 border border-white/10 p-1">
            <TabsTrigger
              value="MAIN_IMAGE"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white px-6 gap-2"
            >
              <Image className="w-4 h-4" />
              电商主图
            </TabsTrigger>
            <TabsTrigger
              value="DETAIL_PAGE"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white px-6 gap-2"
            >
              <FileText className="w-4 h-4" />
              详情长图
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Mode Toggle - Creative vs Clone */}
        <Tabs value={promptMode} onValueChange={(v) => setPromptMode(v as "CREATIVE" | "CLONE")}>
          <TabsList className="bg-slate-800/50 border border-white/10 p-1">
            <TabsTrigger
              value="CREATIVE"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white px-5"
            >
              ✨ 创意模式
            </TabsTrigger>
            <TabsTrigger
              value="CLONE"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-600 data-[state=active]:text-white px-5"
            >
              ⚡ 克隆模式
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Platform Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {platforms.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePlatformId(p.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                activePlatformId === p.id
                  ? "bg-white/10 text-white border border-white/20"
                  : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
              )}
            >
              {p.label}
              <span className="ml-2 text-xs opacity-60">
                ({p.prompts.filter((pr) => pr.taskType === taskType).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left Sidebar - Prompt List */}
        <div className="w-80 shrink-0 flex flex-col bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden">
          {/* Sidebar Header */}
          <div className="p-3 border-b border-white/10 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索 prompt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>

            {/* Scope Filter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScope("all")}
                className={cn(
                  "flex-1 py-1.5 text-xs rounded-lg transition-colors",
                  scope === "all" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                )}
              >
                全部
              </button>
              <button
                onClick={() => setScope("system")}
                className={cn(
                  "flex-1 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-center gap-1",
                  scope === "system" ? "bg-blue-500/20 text-blue-300" : "text-slate-400 hover:text-white"
                )}
              >
                <Shield className="w-3 h-3" />
                系统
              </button>
              <button
                onClick={() => setScope("private")}
                className={cn(
                  "flex-1 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-center gap-1",
                  scope === "private" ? "bg-purple-500/20 text-purple-300" : "text-slate-400 hover:text-white"
                )}
              >
                <User className="w-3 h-3" />
                私有
              </button>
            </div>
          </div>

          {/* Prompt List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : filteredPrompts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                暂无 Prompt
              </div>
            ) : (
              filteredPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => {
                    setIsCreating(false)
                    setSelectedPromptId(prompt.id)
                  }}
                  className={cn(
                    "w-full p-3 rounded-lg text-left transition-all group",
                    selectedPromptId === prompt.id && !isCreating
                      ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30"
                      : "hover:bg-white/5 border border-transparent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm truncate">
                        {prompt.description || prompt.productType}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400">
                          {prompt.productType}
                        </span>
                        {prompt.userId ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                            私有
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                            系统
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          prompt.isActive ? "bg-green-500" : "bg-red-500"
                        )}
                      />
                      <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Create Button */}
          <div className="p-3 border-t border-white/10">
            <Button
              onClick={startCreate}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              新建 Prompt
            </Button>
          </div>
        </div>

        {/* Right Editor */}
        <div className="flex-1 flex flex-col bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden">
          {!selectedPrompt && !isCreating ? (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              选择一个 Prompt 进行编辑，或点击 "新建 Prompt"
            </div>
          ) : (
            <>
              {/* Editor Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {isCreating ? "新建 Prompt" : selectedPrompt?.description || selectedPrompt?.productType}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1">
                    {isCreating ? (
                      `${currentPlatform?.label} / ${taskType === "MAIN_IMAGE" ? "电商主图" : "详情长图"}`
                    ) : (
                      `ID: ${selectedPrompt?.id.slice(0, 8)}... | ${selectedPrompt?.userId ? `私有: ${selectedPrompt?.user?.email}` : "系统默认"}`
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isCreating && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleActive}
                        className={cn(
                          "border-white/10",
                          selectedPrompt?.isActive
                            ? "text-green-400 hover:text-green-300"
                            : "text-red-400 hover:text-red-300"
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
                        className="border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </>
                  )}
                  {isCreating && (
                    <Button variant="outline" size="sm" onClick={cancelCreate} className="border-white/10 text-slate-400">
                      取消
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={isCreating ? handleCreate : handleSave}
                    disabled={saving || (!isDirty && !isCreating)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600"
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-400">创建模式:</span>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-semibold",
                          editMode === "CREATIVE" 
                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
                            : "bg-gradient-to-r from-amber-600 to-orange-600 text-white"
                        )}>
                          {editMode === "CREATIVE" ? "✨ 创意模式" : "⚡ 克隆模式"}
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
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">描述 (可选)</label>
                      <Input
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="例如: 男装, 寝具"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>

                    {/* User (for private prompts) */}
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">归属用户 (留空为系统默认)</label>
                      <Select value={editUserId || "_system"} onValueChange={(v) => setEditUserId(v === "_system" ? null : v)}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
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
                  </>
                )}

                {/* Prompt Template */}
                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-medium text-slate-400 mb-2">Prompt 模板</label>
                  <Textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    placeholder="输入 Prompt 模板内容..."
                    className="flex-1 min-h-[400px] bg-white/5 border-white/10 text-white font-mono text-sm resize-none"
                  />
                  <div className="text-xs text-slate-500 mt-2">
                    支持变量: <code className="text-blue-400">{'${productName}'}</code>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
