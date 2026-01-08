"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
    Megaphone,
    Plus,
    Edit,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Loader2,
    X,
    Calendar,
    Pin,
    Eye,
    EyeOff,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Announcement = {
    id: string
    title: string
    content: string
    type: "PINNED" | "NORMAL"
    isActive: boolean
    sortOrder: number
    createdAt: string
}

type AnnouncementsResponse = {
    success: boolean
    announcements: Announcement[]
}

const fetcher = async (url: string) => {
    const res = await fetch(url)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || `请求失败: ${res.status}`)
    return data
}

export function AnnouncementsAdminClient() {
    const { data, error, isLoading, mutate } = useSWR<AnnouncementsResponse>(
        "/api/admin/announcements",
        fetcher
    )

    const announcements = data?.announcements ?? []

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Form state
    const [formTitle, setFormTitle] = useState("")
    const [formContent, setFormContent] = useState("")
    const [formType, setFormType] = useState<"PINNED" | "NORMAL">("NORMAL")
    const [formSortOrder, setFormSortOrder] = useState(0)
    const [formIsActive, setFormIsActive] = useState(true)

    // Reset form
    const resetForm = () => {
        setFormTitle("")
        setFormContent("")
        setFormType("NORMAL")
        setFormSortOrder(0)
        setFormIsActive(true)
        setEditingId(null)
    }

    // Open create dialog
    const openCreateDialog = () => {
        resetForm()
        setIsDialogOpen(true)
    }

    // Open edit dialog
    const openEditDialog = (announcement: Announcement) => {
        setFormTitle(announcement.title)
        setFormContent(announcement.content)
        setFormType(announcement.type)
        setFormSortOrder(announcement.sortOrder)
        setFormIsActive(announcement.isActive)
        setEditingId(announcement.id)
        setIsDialogOpen(true)
    }

    // Close dialog
    const closeDialog = () => {
        setIsDialogOpen(false)
        resetForm()
    }

    // Save (create or update)
    const handleSave = async () => {
        if (!formTitle.trim()) {
            toast.error("请输入标题")
            return
        }
        if (!formContent.trim()) {
            toast.error("请输入内容")
            return
        }

        setIsSaving(true)
        try {
            const payload = {
                id: editingId,
                title: formTitle,
                content: formContent,
                type: formType,
                sortOrder: formSortOrder,
                isActive: formIsActive,
            }

            const res = await fetch("/api/admin/announcements", {
                method: editingId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json?.error || "保存失败")

            toast.success(editingId ? "公告已更新" : "公告已创建")
            closeDialog()
            await mutate()
        } catch (e: any) {
            toast.error(e?.message || "保存失败")
        } finally {
            setIsSaving(false)
        }
    }

    // Toggle active
    const handleToggleActive = async (announcement: Announcement) => {
        try {
            const res = await fetch("/api/admin/announcements", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: announcement.id,
                    isActive: !announcement.isActive,
                }),
            })

            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json?.error || "更新失败")

            toast.success(announcement.isActive ? "已禁用" : "已启用")
            await mutate()
        } catch (e: any) {
            toast.error(e?.message || "更新失败")
        }
    }

    // Delete
    const handleDelete = async (announcement: Announcement) => {
        if (!confirm(`确认删除公告「${announcement.title}」？`)) return

        try {
            const res = await fetch(
                `/api/admin/announcements?id=${encodeURIComponent(announcement.id)}`,
                { method: "DELETE" }
            )

            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json?.error || "删除失败")

            toast.success("公告已删除")
            await mutate()
        } catch (e: any) {
            toast.error(e?.message || "删除失败")
        }
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-[calc(100vh-1px)] bg-slate-950 p-8">
                <div className="max-w-5xl mx-auto">
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

    // Error state
    if (error) {
        return (
            <div className="min-h-[calc(100vh-1px)] bg-slate-950 p-8">
                <div className="max-w-5xl mx-auto">
                    <div className="glass rounded-3xl p-8 border border-white/10">
                        <div className="text-rose-400 font-semibold">加载失败</div>
                        <div className="text-slate-400 text-sm mt-2">
                            {String((error as any).message || error)}
                        </div>
                        <div className="mt-6">
                            <Button
                                variant="outline"
                                className="border-white/10 bg-white/5 hover:bg-white/10"
                                onClick={() => mutate()}
                            >
                                重试
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="min-h-[calc(100vh-1px)] bg-slate-950 p-8">
                <div className="max-w-5xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                                <Megaphone className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <div className="text-white text-2xl font-bold">公告管理</div>
                                <div className="text-slate-400 text-sm">
                                    管理系统公告，支持置顶和 Markdown 内容
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={openCreateDialog}
                            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            新建公告
                        </Button>
                    </div>

                    {/* List */}
                    <div className="glass rounded-3xl border border-white/10 overflow-hidden">
                        {announcements.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                <p>暂无公告</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {announcements.map((item) => (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            "p-5 transition-colors",
                                            !item.isActive && "opacity-60"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-white font-semibold truncate">
                                                        {item.title}
                                                    </h3>
                                                    {item.type === "PINNED" && (
                                                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                                            <Pin className="w-3 h-3 mr-1" />
                                                            置顶
                                                        </Badge>
                                                    )}
                                                    {item.type === "NORMAL" && (
                                                        <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
                                                            普通
                                                        </Badge>
                                                    )}
                                                    {item.isActive ? (
                                                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                                            <Eye className="w-3 h-3 mr-1" />
                                                            启用
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">
                                                            <EyeOff className="w-3 h-3 mr-1" />
                                                            禁用
                                                        </Badge>
                                                    )}
                                                </div>

                                                <p className="text-slate-400 text-sm line-clamp-2 mb-2">
                                                    {item.content.slice(0, 150)}
                                                    {item.content.length > 150 && "..."}
                                                </p>

                                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(item.createdAt).toLocaleString("zh-CN")}
                                                    </span>
                                                    <span>排序: {item.sortOrder}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                                                    onClick={() => handleToggleActive(item)}
                                                    title={item.isActive ? "禁用" : "启用"}
                                                >
                                                    {item.isActive ? (
                                                        <ToggleRight className="w-4 h-4" />
                                                    ) : (
                                                        <ToggleLeft className="w-4 h-4" />
                                                    )}
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                                                    onClick={() => openEditDialog(item)}
                                                    title="编辑"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-white/10 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                                                    onClick={() => handleDelete(item)}
                                                    title="删除"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Dialog */}
            <AnimatePresence>
                {isDialogOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={closeDialog}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Dialog header */}
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <h2 className="text-white font-semibold text-lg">
                                    {editingId ? "编辑公告" : "新建公告"}
                                </h2>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-slate-400 hover:text-white"
                                    onClick={closeDialog}
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            {/* Dialog content */}
                            <div className="p-5 space-y-4 max-h-[calc(90vh-140px)] overflow-y-auto">
                                {/* Title */}
                                <div className="space-y-1.5">
                                    <label className="text-xs text-slate-400">标题</label>
                                    <Input
                                        value={formTitle}
                                        onChange={(e) => setFormTitle(e.target.value)}
                                        placeholder="公告标题"
                                        className="bg-white/5 border-white/10 text-white"
                                    />
                                </div>

                                {/* Content */}
                                <div className="space-y-1.5">
                                    <label className="text-xs text-slate-400">
                                        内容（支持 Markdown）
                                    </label>
                                    <Textarea
                                        value={formContent}
                                        onChange={(e) => setFormContent(e.target.value)}
                                        placeholder="公告内容..."
                                        className="min-h-[200px] bg-white/5 border-white/10 text-white font-mono text-sm"
                                    />
                                </div>

                                {/* Type */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs text-slate-400">类型</label>
                                        <Select
                                            value={formType}
                                            onValueChange={(v) =>
                                                setFormType(v as "PINNED" | "NORMAL")
                                            }
                                        >
                                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="NORMAL">普通</SelectItem>
                                                <SelectItem value="PINNED">置顶</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Sort Order */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs text-slate-400">
                                            排序（越大越靠前）
                                        </label>
                                        <Input
                                            type="number"
                                            value={formSortOrder}
                                            onChange={(e) =>
                                                setFormSortOrder(parseInt(e.target.value) || 0)
                                            }
                                            className="bg-white/5 border-white/10 text-white"
                                        />
                                    </div>
                                </div>

                                {/* Active toggle */}
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                    <span className="text-sm text-white">启用此公告</span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className={cn(
                                            "transition-colors",
                                            formIsActive
                                                ? "text-emerald-400"
                                                : "text-slate-400"
                                        )}
                                        onClick={() => setFormIsActive(!formIsActive)}
                                    >
                                        {formIsActive ? (
                                            <ToggleRight className="w-6 h-6" />
                                        ) : (
                                            <ToggleLeft className="w-6 h-6" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Dialog footer */}
                            <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                                <Button
                                    variant="outline"
                                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                                    onClick={closeDialog}
                                >
                                    取消
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : null}
                                    {editingId ? "保存" : "创建"}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
