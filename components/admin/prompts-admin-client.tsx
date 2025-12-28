"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  Save,
  RotateCcw,
  Loader2,
  FileCode2,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Filter,
  User,
  Shield,
} from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type Prompt = {
  id: string
  productType: string
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

type PlatformNode = {
  id: string
  key: string
  label: string
  sortOrder: number
  isActive: boolean
  prompts: Prompt[]
}

type AdminPromptsResponse = {
  success: boolean
  platforms: PlatformNode[]
}

type AdminUser = {
  id: string
  email: string
  username: string | null
  name: string | null
  role: string
  createdAt: string
}

type UsersResponse = {
  success: boolean
  users: AdminUser[]
}

type Scope = "all" | "system" | "private"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `请求失败: ${res.status}`)
  return data
}

function userLabel(u?: AdminUser | null) {
  if (!u) return ""
  return u.username || u.name || u.email
}

export function PromptsAdminClient() {
  const [scope, setScope] = useState<Scope>("all")

  const {
    data,
    error,
    isLoading,
    mutate: mutatePrompts,
  } = useSWR<AdminPromptsResponse>(`/api/admin/prompts?scope=${scope}`, fetcher)

  const {
    data: usersData,
    mutate: mutateUsers,
    isLoading: isUsersLoading,
  } = useSWR<UsersResponse>("/api/admin/users", fetcher)

  const users = usersData?.users ?? []

  const platforms = data?.platforms ?? []

  const [platformKey, setPlatformKey] = useState<string>("")
  const [activePromptId, setActivePromptId] = useState<string>("")
  const [draft, setDraft] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)

  // create state
  const [isCreating, setIsCreating] = useState(false)
  const [newUserId, setNewUserId] = useState<string>("__SYSTEM__")
  const [newProductType, setNewProductType] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newTemplate, setNewTemplate] = useState("")

  // init selection
  useEffect(() => {
    if (!platforms.length) return

    const firstKey = platformKey || platforms[0].key
    const p = platforms.find((x) => x.key === firstKey) ?? platforms[0]

    setPlatformKey(p.key)

    const firstPrompt = p.prompts[0]
    if (firstPrompt) {
      setActivePromptId(firstPrompt.id)
      setDraft(firstPrompt.promptTemplate)
    } else {
      setActivePromptId("")
      setDraft("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platforms.length])

  const activePlatform = useMemo(() => {
    return platforms.find((p) => p.key === platformKey) ?? null
  }, [platforms, platformKey])

  const prompts = useMemo(() => {
    // 禁用项排后；系统/私有可混排（UI 通过标识区分）
    return (activePlatform?.prompts ?? []).slice().sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
      // 系统优先
      const aSys = a.userId === null
      const bSys = b.userId === null
      if (aSys !== bSys) return aSys ? -1 : 1
      return (a.description || a.productType).localeCompare(b.description || b.productType)
    })
  }, [activePlatform?.prompts])

  const activePrompt = useMemo(() => {
    return prompts.find((p) => p.id === activePromptId) ?? null
  }, [prompts, activePromptId])

  // when platform changes
  useEffect(() => {
    if (!activePlatform) return
    const p0 = (activePlatform.prompts ?? [])[0]
    if (!p0) {
      setActivePromptId("")
      setDraft("")
      return
    }
    setActivePromptId(p0.id)
    setDraft(p0.promptTemplate)
  }, [activePlatform?.id])

  // when prompt changes
  useEffect(() => {
    if (!activePrompt) {
      setDraft("")
      return
    }
    setDraft(activePrompt.promptTemplate)
  }, [activePrompt?.id])

  const dirty = useMemo(() => {
    if (!activePrompt) return false
    return draft !== activePrompt.promptTemplate
  }, [draft, activePrompt])

  const onReset = () => {
    if (!activePrompt) return
    setDraft(activePrompt.promptTemplate)
    toast.message("已重置为未保存版本")
  }

  const onSave = async () => {
    if (!activePrompt) return
    if (!draft.trim()) {
      toast.error("Prompt 内容不能为空")
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch("/api/admin/prompts/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activePrompt.id, promptTemplate: draft }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `保存失败: ${res.status}`)

      toast.success("保存成功")
      await mutatePrompts()
    } catch (e: any) {
      toast.error(e?.message || "保存失败")
    } finally {
      setIsSaving(false)
    }
  }

  const onToggleActive = async (prompt: Prompt) => {
    try {
      const res = await fetch("/api/admin/prompts/toggle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prompt.id, isActive: !prompt.isActive }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `更新失败: ${res.status}`)
      toast.success(prompt.isActive ? "已禁用" : "已启用")
      await mutatePrompts()
    } catch (e: any) {
      toast.error(e?.message || "更新失败")
    }
  }

  const onDeletePrompt = async (prompt: Prompt) => {
    const scopeLabel = prompt.userId ? "私有" : "系统"
    const owner = prompt.userId ? (prompt.user?.email || prompt.user?.username || prompt.user?.name || prompt.userId) : ""

    if (!confirm(`确认删除${scopeLabel} Prompt：${prompt.description || prompt.productType}${owner ? `（${owner}）` : ""}？`)) return

    try {
      const res = await fetch(`/api/admin/prompts/delete?id=${encodeURIComponent(prompt.id)}`, {
        method: "DELETE",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `删除失败: ${res.status}`)

      toast.success("已删除")
      if (prompt.id === activePromptId) {
        setActivePromptId("")
        setDraft("")
      }
      await mutatePrompts()
    } catch (e: any) {
      toast.error(e?.message || "删除失败")
    }
  }

  const onCreatePrompt = async () => {
    if (!activePlatform) return

    const productType = newProductType.trim()
    const description = newDescription.trim()
    const promptTemplate = newTemplate.trim()

    const userId = newUserId === "__SYSTEM__" ? null : newUserId

    if (!productType) {
      toast.error("请输入 productType（例如 MENSWEAR）")
      return
    }
    if (!promptTemplate) {
      toast.error("请输入 promptTemplate")
      return
    }
    if (userId && !users.find((u) => u.id === userId)) {
      toast.error("请选择有效用户")
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch("/api/admin/prompts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformId: activePlatform.id,
          userId,
          productType,
          description: description || null,
          promptTemplate,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `创建失败: ${res.status}`)

      toast.success(userId ? "私有 Prompt 创建成功" : "系统 Prompt 创建成功")
      setNewProductType("")
      setNewDescription("")
      setNewTemplate("")
      setNewUserId("__SYSTEM__")

      await mutatePrompts()

      const createdId = json?.prompt?.id as string | undefined
      if (createdId) {
        setActivePromptId(createdId)
        setDraft(json.prompt.promptTemplate)
      }
    } catch (e: any) {
      toast.error(e?.message || "创建失败")
    } finally {
      setIsCreating(false)
    }
  }

  // if scope changes, clear selection to avoid mismatch
  useEffect(() => {
    setActivePromptId("")
    setDraft("")
    // refresh users if needed
    mutateUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-1px)] bg-slate-950 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="glass rounded-3xl p-8 border border-white/10">
            <div className="text-white text-lg font-semibold flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              加载中...
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-1px)] bg-slate-950 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="glass rounded-3xl p-8 border border-white/10">
            <div className="text-rose-400 font-semibold">加载失败</div>
            <div className="text-slate-400 text-sm mt-2">{String((error as any).message || error)}</div>
            <div className="mt-6">
              <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10" onClick={() => mutatePrompts()}>
                重试
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!platforms.length) {
    return (
      <div className="min-h-[calc(100vh-1px)] bg-slate-950 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="glass rounded-3xl p-8 border border-white/10 text-slate-400">没有可用平台数据</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-1px)] bg-slate-950 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <FileCode2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white text-2xl font-bold">Prompt 管理</div>
              <div className="text-slate-400 text-sm">包含系统 Prompt 与用户私有 Prompt（仅管理员可见）</div>
            </div>
          </div>

          {/* Scope filter */}
          <div className="glass rounded-2xl border border-white/10 p-3 flex items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="筛选范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="system">仅系统</SelectItem>
                <SelectItem value="private">仅私有</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={platformKey} onValueChange={setPlatformKey}>
          <TabsList className="bg-white/5 border border-white/10 rounded-2xl p-1">
            {platforms.map((p) => (
              <TabsTrigger key={p.key} value={p.key} className="rounded-xl">
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {platforms.map((p) => (
            <TabsContent key={p.key} value={p.key} className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-4">
                {/* Left sidebar */}
                <div className="glass rounded-3xl border border-white/10 overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-white/10">
                    <div className="text-white font-semibold">风格列表</div>
                    <div className="text-xs text-slate-500 mt-1">系统 / 私有 都会显示（可用右上筛选）</div>
                  </div>

                  {/* Create new prompt */}
                  <div className="p-4 border-b border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-400">新增 Prompt</div>
                      <div className="text-xs text-slate-500">Available vars: ${"${productName}"}</div>
                    </div>

                    <Select value={newUserId} onValueChange={setNewUserId}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder={isUsersLoading ? "加载用户中..." : "选择归属（系统/用户）"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__SYSTEM__">
                          <span className="inline-flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            系统（userId=null）
                          </span>
                        </SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            <span className="inline-flex items-center gap-2">
                              <User className="w-4 h-4" />
                              {userLabel(u)}
                              {u.role === "ADMIN" ? "（ADMIN）" : ""}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="grid grid-cols-1 gap-2">
                      <Input
                        value={newProductType}
                        onChange={(e) => setNewProductType(e.target.value)}
                        placeholder="productType（如 MENSWEAR）"
                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-600"
                      />
                      <Input
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="描述（如 男装，可选）"
                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-600"
                      />
                      <Button
                        onClick={onCreatePrompt}
                        disabled={!activePlatform || isCreating}
                        className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white"
                      >
                        {isCreating ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        新增
                      </Button>
                    </div>
                    <Textarea
                      value={newTemplate}
                      onChange={(e) => setNewTemplate(e.target.value)}
                      placeholder="promptTemplate（必填）"
                      className="min-h-[120px] font-mono text-xs bg-black/20 border-white/10 text-white placeholder:text-slate-600"
                    />
                  </div>

                  <div className="max-h-[52vh] overflow-auto p-2 space-y-2">
                    {(p.prompts?.length ?? 0) === 0 ? (
                      <div className="p-4 text-sm text-slate-500">该平台暂无 Prompt</div>
                    ) : (
                      prompts.map((prompt) => {
                        const active = prompt.id === activePromptId
                        const label = prompt.description || prompt.productType
                        const isPrivate = !!prompt.userId
                        const owner = isPrivate
                          ? prompt.user?.email || prompt.user?.username || prompt.user?.name || prompt.userId
                          : "系统"

                        return (
                          <div
                            key={prompt.id}
                            className={cn(
                              "rounded-2xl border p-3",
                              active
                                ? "bg-gradient-to-r from-blue-600/30 to-purple-600/30 border-purple-500/40"
                                : "bg-white/5 border-white/10",
                              !prompt.isActive && "opacity-70",
                            )}
                          >
                            <button type="button" onClick={() => setActivePromptId(prompt.id)} className="w-full text-left">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate text-white">{label}</div>
                                  <div className="text-xs text-slate-500 mt-1 truncate">{prompt.productType}</div>
                                  <div className="text-xs text-slate-500 mt-1 truncate">
                                    {isPrivate ? `私有 · ${owner}` : "系统"}
                                  </div>
                                </div>
                                <div className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5 text-slate-300">
                                  {prompt.isActive ? "启用" : "禁用"}
                                </div>
                              </div>
                            </button>

                            <div className="mt-3 flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                                onClick={() => onToggleActive(prompt)}
                                title={prompt.isActive ? "禁用" : "启用"}
                              >
                                {prompt.isActive ? (
                                  <ToggleRight className="w-4 h-4 mr-2" />
                                ) : (
                                  <ToggleLeft className="w-4 h-4 mr-2" />
                                )}
                                {prompt.isActive ? "禁用" : "启用"}
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="border-white/10 bg-rose-500/10 hover:bg-rose-500/20 text-rose-200"
                                onClick={() => onDeletePrompt(prompt)}
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                删除
                              </Button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Editor */}
                <div className="glass rounded-3xl border border-white/10 overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-white font-semibold">
                        {activePrompt
                          ? `${activePrompt.description || activePrompt.productType}${activePrompt.isActive ? "" : "（已禁用）"}`
                          : "请选择左侧风格"}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Available vars: ${"${productName}"}</div>
                      {activePrompt?.userId && (
                        <div className="text-xs text-slate-500 mt-1">
                          私有归属：{activePrompt.user?.email || activePrompt.user?.username || activePrompt.user?.name || activePrompt.userId}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="border-white/10 bg-white/5 hover:bg-white/10"
                        disabled={!activePrompt || !dirty || isSaving}
                        onClick={onReset}
                        title="重置未保存修改"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        重置
                      </Button>

                      <Button
                        className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white"
                        disabled={!activePrompt || !dirty || isSaving}
                        onClick={onSave}
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        保存修改
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 flex-1">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={activePrompt ? "请输入 promptTemplate..." : "请先选择左侧风格"}
                      disabled={!activePrompt}
                      className="min-h-[520px] font-mono text-sm bg-black/20 border-white/10 text-white placeholder:text-slate-600"
                    />
                    {dirty && <div className="mt-2 text-xs text-amber-400">你有未保存的修改</div>}
                  </div>

                  <div className="p-4 border-t border-white/10 text-xs text-slate-500 flex items-center justify-between">
                    <span>保存后会立即影响新生成任务</span>
                    <span>{activePrompt?.userId ? "用户私有 Prompt" : "系统 Prompt（userId = null）"}</span>
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
