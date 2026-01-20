"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { motion } from "framer-motion"
import {
    Droplets,
    Plus,
    Trash2,
    Save,
    Loader2,
    Type,
    Image as ImageIcon,
    RotateCw,
    Maximize2,
    Palette,
    Grid3X3,
    Upload,
    X,
    Move,
} from "lucide-react"
import { toast } from "sonner"

import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { getWatermarkedUrl } from "@/lib/tos-watermark"

// Sample image for preview (replace with actual TOS hosted image)
const SAMPLE_IMAGE_URL = "https://sexyspecies-ai-image.tos-cn-beijing.volces.com/BEDDING/2026/01/06/wzh/image-224026-courq5.png?x-tos-process=image/crop,x_0,y_0,w_682,h_682"

type WatermarkTemplate = {
    id: string
    name: string
    type: "IMAGE" | "TEXT"
    content: string
    opacity: number
    rotate: number
    scale: number
    position: string
    xOffset: number
    yOffset: number
    isTiled: boolean
    fontSize: number | null
    fontColor: string | null
    fontName: string | null
    createdAt: string
}

// TOS Gravity positions (3x3 grid)
const POSITIONS = [
    { key: "nw", label: "↖", name: "左上" },
    { key: "north", label: "↑", name: "上" },
    { key: "ne", label: "↗", name: "右上" },
    { key: "west", label: "←", name: "左" },
    { key: "center", label: "●", name: "中" },
    { key: "east", label: "→", name: "右" },
    { key: "sw", label: "↙", name: "左下" },
    { key: "south", label: "↓", name: "下" },
    { key: "se", label: "↘", name: "右下" },
]

// TOS supported fonts
const FONTS = [
    { key: "wqy-zenhei", label: "文泉驿正黑" },
    { key: "fangzhengshusong", label: "方正书宋" },
    { key: "fangzhengkaiti", label: "方正楷体" },
    { key: "fangzhengheiti", label: "方正黑体" },
]

const DEFAULT_TEMPLATE: Omit<WatermarkTemplate, "id" | "createdAt"> = {
    name: "",
    type: "TEXT",
    content: "",
    opacity: 80,
    rotate: 0,
    scale: 50,
    position: "se",
    xOffset: 10,
    yOffset: 10,
    isTiled: false,
    fontSize: 24,
    fontColor: "#FFFFFF",
    fontName: "wqy-zenhei",
}

export default function WatermarkSettingsPage() {
    const [templates, setTemplates] = useState<WatermarkTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Editor state
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [draft, setDraft] = useState(DEFAULT_TEMPLATE)

    // Pending file for deferred upload
    const [pendingFile, setPendingFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Fetch templates
    const fetchTemplates = useCallback(async () => {
        try {
            const res = await fetch("/api/user/watermarks")
            if (res.ok) {
                const data = await res.json()
                setTemplates(data.templates || [])
            }
        } catch {
            toast.error("获取水印模板失败")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchTemplates()
    }, [fetchTemplates])

    // Generate preview URL using TOS watermark utility
    const previewUrl = useMemo(() => {
        if (!draft.content) return SAMPLE_IMAGE_URL

        // For image watermarks, we need a valid TOS URL
        // For text watermarks, we can generate preview
        if (draft.type === "TEXT") {
            const url = getWatermarkedUrl(SAMPLE_IMAGE_URL, {
                type: "TEXT",
                content: draft.content,
                opacity: draft.opacity,
                rotate: draft.rotate,
                scale: draft.scale,
                position: draft.position,
                xOffset: draft.xOffset,
                yOffset: draft.yOffset,
                isTiled: draft.isTiled,
                fontSize: draft.fontSize,
                fontColor: draft.fontColor,
                fontName: draft.fontName,
            })
            // console.log("[水印预览URL]", url)
            return url
        }

        // For image watermarks with pending file, show base64 preview
        if (draft.content.startsWith("data:")) {
            // console.log("[水印预览URL] 使用本地 base64 预览")
            return SAMPLE_IMAGE_URL // Can't preview base64 with TOS
        }

        // For saved image watermarks, use TOS preview
        const url = getWatermarkedUrl(SAMPLE_IMAGE_URL, {
            type: "IMAGE",
            content: draft.content,
            opacity: draft.opacity,
            rotate: draft.rotate,
            scale: draft.scale,
            position: draft.position,
            xOffset: draft.xOffset,
            yOffset: draft.yOffset,
            isTiled: draft.isTiled,
            fontSize: null,
            fontColor: null,
            fontName: null,
        })
        // console.log("[水印预览URL]", url)
        return url
    }, [draft])

    // Select template
    const selectTemplate = (template: WatermarkTemplate) => {
        setSelectedId(template.id)
        setIsCreating(false)
        setPendingFile(null)
        setDraft({
            name: template.name,
            type: template.type,
            content: template.content,
            opacity: template.opacity,
            rotate: template.rotate,
            scale: template.scale,
            position: template.position,
            xOffset: template.xOffset,
            yOffset: template.yOffset,
            isTiled: template.isTiled,
            fontSize: template.fontSize,
            fontColor: template.fontColor,
            fontName: template.fontName,
        })
    }

    // Start creating new
    const startCreating = () => {
        setSelectedId(null)
        setIsCreating(true)
        setPendingFile(null)
        setDraft({ ...DEFAULT_TEMPLATE })
    }

    // Handle image selection
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith("image/")) {
            toast.error("请上传图片文件")
            return
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error("图片大小不能超过 2MB")
            return
        }

        setPendingFile(file)

        const reader = new FileReader()
        reader.onload = (event) => {
            const base64 = event.target?.result as string
            setDraft({ ...draft, content: base64, type: "IMAGE" })
        }
        reader.readAsDataURL(file)

        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    // Save template
    const handleSave = async () => {
        if (!draft.name.trim()) {
            toast.error("请输入模板名称")
            return
        }
        if (!draft.content.trim()) {
            toast.error(draft.type === "TEXT" ? "请输入水印文字" : "请上传水印图片")
            return
        }

        setSaving(true)
        try {
            let contentUrl = draft.content

            // Upload pending image to TOS
            if (pendingFile && draft.type === "IMAGE" && draft.content.startsWith("data:")) {
                const formData = new FormData()
                formData.append("file", pendingFile)

                const uploadRes = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                })

                if (!uploadRes.ok) {
                    throw new Error("图片上传失败")
                }

                const uploadData = await uploadRes.json()
                contentUrl = uploadData.url
            }

            const saveData = { ...draft, content: contentUrl }

            if (isCreating) {
                const res = await fetch("/api/user/watermarks", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(saveData),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || "创建失败")

                toast.success("模板创建成功")
                setTemplates((prev) => [data.template, ...prev])
                setSelectedId(data.template.id)
                setIsCreating(false)
                setPendingFile(null)
            } else if (selectedId) {
                const res = await fetch("/api/user/watermarks", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: selectedId, ...saveData }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || "更新失败")

                toast.success("模板已保存")
                setTemplates((prev) =>
                    prev.map((t) => (t.id === selectedId ? data.template : t))
                )
                setPendingFile(null)
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "保存失败"
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

    // Delete template
    const handleDelete = async (id: string) => {
        if (!confirm("确定删除此模板？")) return

        try {
            const res = await fetch(`/api/user/watermarks?id=${id}`, {
                method: "DELETE",
            })
            if (!res.ok) throw new Error("删除失败")

            toast.success("模板已删除")
            setTemplates((prev) => prev.filter((t) => t.id !== id))
            if (selectedId === id) {
                setSelectedId(null)
                setIsCreating(false)
            }
        } catch {
            toast.error("删除失败")
        }
    }

    return (
        <div className="flex h-screen bg-[#0a0a0f] overflow-hidden">
            <Sidebar />
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Droplets className="w-6 h-6 text-cyan-400" />
                        水印模板管理
                    </h1>
                    <p className="text-slate-400 mt-1">创建和管理您的水印预设 (实时预览)</p>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
                    {/* Left: Template List */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                    >
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h2 className="text-white font-semibold">我的模板</h2>
                            <Button
                                size="sm"
                                onClick={startCreating}
                                disabled={templates.length >= 10}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                新建
                            </Button>
                        </div>

                        <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-3 space-y-2">
                            {loading ? (
                                <>
                                    <Skeleton className="h-14 w-full bg-white/10 rounded-xl" />
                                    <Skeleton className="h-14 w-full bg-white/10 rounded-xl" />
                                </>
                            ) : templates.length === 0 && !isCreating ? (
                                <div className="text-center py-8 text-slate-500">
                                    <Droplets className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                    <p className="text-sm">暂无模板</p>
                                </div>
                            ) : (
                                templates.map((tpl) => (
                                    <div
                                        key={tpl.id}
                                        onClick={() => selectTemplate(tpl)}
                                        className={cn(
                                            "p-3 rounded-xl cursor-pointer transition-all border",
                                            selectedId === tpl.id
                                                ? "bg-cyan-500/20 border-cyan-500/40"
                                                : "bg-white/5 border-transparent hover:border-white/20"
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {tpl.type === "TEXT" ? (
                                                    <Type className="w-4 h-4 text-cyan-400" />
                                                ) : (
                                                    <ImageIcon className="w-4 h-4 text-purple-400" />
                                                )}
                                                <span className="text-white font-medium text-sm truncate max-w-[150px]">
                                                    {tpl.name}
                                                </span>
                                            </div>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="w-6 h-6 text-slate-400 hover:text-red-400"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDelete(tpl.id)
                                                }}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-3 border-t border-white/10 text-xs text-slate-500 text-center">
                            {templates.length} / 10 个模板
                        </div>
                    </motion.div>

                    {/* Right: Editor */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                    >
                        {!selectedId && !isCreating ? (
                            <div className="flex items-center justify-center h-full min-h-[500px] text-slate-500">
                                <div className="text-center">
                                    <Droplets className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p className="text-sm">选择或新建模板</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-5 space-y-5">
                                {/* Preview - Real TOS watermark */}
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 flex items-center gap-2">
                                        实时预览 (TOS API)
                                    </label>
                                    <div className="flex justify-center">
                                        <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-white/10">
                                            <img
                                                key={previewUrl}
                                                src={previewUrl}
                                                alt="水印预览"
                                                className="w-[340px] h-[340px] object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = SAMPLE_IMAGE_URL
                                                }}
                                            />
                                            {/* <div className="absolute bottom-2 right-2 text-xs text-white/50 bg-black/50 px-2 py-1 rounded">
                                                682×682
                                            </div> */}
                                        </div>
                                    </div>
                                </div>

                                {/* Form */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Left Column */}
                                    <div className="space-y-4">
                                        {/* Name */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs text-slate-400">模板名称</label>
                                            <Input
                                                value={draft.name}
                                                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                                placeholder="例如：品牌水印"
                                                className="h-9 bg-white/5 border-white/10 text-white text-sm"
                                            />
                                        </div>

                                        {/* Type */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs text-slate-400">水印类型</label>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setDraft({ ...draft, type: "TEXT", content: "" })}
                                                    className={cn(
                                                        "flex-1 h-9 border-white/10",
                                                        draft.type === "TEXT"
                                                            ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                                                            : "bg-white/5 text-slate-400"
                                                    )}
                                                >
                                                    <Type className="w-3.5 h-3.5 mr-1.5" />
                                                    文字
                                                </Button>
                                                {/* 图片水印暂时隐藏 */}
                                                {/* <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setDraft({ ...draft, type: "IMAGE", content: "" })}
                                                    className={cn(
                                                        "flex-1 h-9 border-white/10",
                                                        draft.type === "IMAGE"
                                                            ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                                                            : "bg-white/5 text-slate-400"
                                                    )}
                                                >
                                                    <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                                                    图片
                                                </Button> */}
                                            </div>
                                        </div>

                                        {/* Content - Text or Image Upload */}
                                        {draft.type === "TEXT" ? (
                                            <>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs text-slate-400">水印文字</label>
                                                    <Input
                                                        value={draft.content}
                                                        onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                                                        placeholder="输入水印文字..."
                                                        className="h-9 bg-white/5 border-white/10 text-white text-sm"
                                                    />
                                                </div>

                                                {/* Font Family */}
                                                <div className="space-y-1.5">
                                                    <label className="text-xs text-slate-400">字体</label>
                                                    <Select
                                                        value={draft.fontName || "wqy-zenhei"}
                                                        onValueChange={(v) => setDraft({ ...draft, fontName: v })}
                                                    >
                                                        <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-slate-900 border-white/10">
                                                            {FONTS.map((font) => (
                                                                <SelectItem
                                                                    key={font.key}
                                                                    value={font.key}
                                                                    className="text-white"
                                                                >
                                                                    {font.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Font Size & Color */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs text-slate-400 flex items-center gap-1">
                                                            <Type className="w-3 h-3" /> 字号
                                                        </label>
                                                        <Input
                                                            type="number"
                                                            value={draft.fontSize || 24}
                                                            onChange={(e) =>
                                                                setDraft({ ...draft, fontSize: parseInt(e.target.value) || 24 })
                                                            }
                                                            min={12}
                                                            max={200}
                                                            className="h-9 bg-white/5 border-white/10 text-white text-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs text-slate-400 flex items-center gap-1">
                                                            <Palette className="w-3 h-3" /> 颜色
                                                        </label>
                                                        <div className="flex gap-1">
                                                            <input
                                                                type="color"
                                                                value={draft.fontColor || "#FFFFFF"}
                                                                onChange={(e) => setDraft({ ...draft, fontColor: e.target.value.toUpperCase() })}
                                                                className="w-9 h-9 rounded cursor-pointer border-0"
                                                            />
                                                            <Input
                                                                value={draft.fontColor || "#FFFFFF"}
                                                                onChange={(e) => setDraft({ ...draft, fontColor: e.target.value.toUpperCase() })}
                                                                className="flex-1 h-9 bg-white/5 border-white/10 text-white text-sm uppercase"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <label className="text-xs text-slate-400">水印图片</label>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={handleImageSelect}
                                                />
                                                {draft.content ? (
                                                    <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10">
                                                        <img
                                                            src={draft.content}
                                                            alt="水印"
                                                            className="w-10 h-10 object-contain rounded"
                                                        />
                                                        <span className="flex-1 text-xs text-slate-400 truncate">
                                                            {pendingFile ? "待上传" : "已上传"}
                                                        </span>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="w-6 h-6 text-slate-400 hover:text-red-400"
                                                            onClick={() => {
                                                                setDraft({ ...draft, content: "" })
                                                                setPendingFile(null)
                                                            }}
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        className="w-full h-9 bg-white/5 border-white/10 text-slate-400 hover:text-white"
                                                        onClick={() => fileInputRef.current?.click()}
                                                    >
                                                        <Upload className="w-4 h-4 mr-2" />
                                                        选择图片
                                                    </Button>
                                                )}
                                            </div>
                                        )}

                                        {/* Tile Toggle */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs text-slate-400 flex items-center gap-1">
                                                <Grid3X3 className="w-3 h-3" /> 平铺模式
                                            </label>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setDraft({ ...draft, isTiled: false })}
                                                    className={cn(
                                                        "flex-1 h-9 border-white/10",
                                                        !draft.isTiled
                                                            ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                                                            : "bg-white/5 text-slate-400"
                                                    )}
                                                >
                                                    单个
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setDraft({ ...draft, isTiled: true })}
                                                    className={cn(
                                                        "flex-1 h-9 border-white/10",
                                                        draft.isTiled
                                                            ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                                                            : "bg-white/5 text-slate-400"
                                                    )}
                                                >
                                                    平铺
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column */}
                                    <div className="space-y-4">
                                        {/* Position Grid (Gravity) */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs text-slate-400 flex items-center gap-1">
                                                <Move className="w-3 h-3" /> 位置 (Gravity)
                                            </label>
                                            <div className="grid grid-cols-3 gap-1 w-fit">
                                                {POSITIONS.map((pos) => (
                                                    <button
                                                        key={pos.key}
                                                        onClick={() => setDraft({ ...draft, position: pos.key })}
                                                        title={pos.name}
                                                        className={cn(
                                                            "w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all",
                                                            draft.position === pos.key
                                                                ? "bg-cyan-500 text-white"
                                                                : "bg-white/10 text-slate-400 hover:bg-white/20"
                                                        )}
                                                    >
                                                        {pos.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* X/Y Offset */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-xs text-slate-400">X 边距 (px)</label>
                                                <Input
                                                    type="number"
                                                    value={draft.xOffset}
                                                    onChange={(e) => setDraft({ ...draft, xOffset: parseInt(e.target.value) || 0 })}
                                                    min={0}
                                                    max={500}
                                                    className="h-9 bg-white/5 border-white/10 text-white text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs text-slate-400">Y 边距 (px)</label>
                                                <Input
                                                    type="number"
                                                    value={draft.yOffset}
                                                    onChange={(e) => setDraft({ ...draft, yOffset: parseInt(e.target.value) || 0 })}
                                                    min={0}
                                                    max={500}
                                                    className="h-9 bg-white/5 border-white/10 text-white text-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* Opacity */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs text-slate-400 flex items-center justify-between">
                                                <span className="flex items-center gap-1">
                                                    <Droplets className="w-3 h-3" /> 不透明度
                                                </span>
                                                <span className="text-cyan-400">{draft.opacity}%</span>
                                            </label>
                                            <Slider
                                                value={[draft.opacity]}
                                                onValueChange={([v]: number[]) => setDraft({ ...draft, opacity: v })}
                                                min={0}
                                                max={100}
                                                step={5}
                                            />
                                        </div>

                                        {/* Rotate */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs text-slate-400 flex items-center justify-between">
                                                <span className="flex items-center gap-1">
                                                    <RotateCw className="w-3 h-3" /> 旋转
                                                </span>
                                                <span className="text-cyan-400">{draft.rotate}°</span>
                                            </label>
                                            <Slider
                                                value={[draft.rotate]}
                                                onValueChange={([v]: number[]) => setDraft({ ...draft, rotate: v })}
                                                min={0}
                                                max={360}
                                                step={15}
                                            />
                                        </div>

                                        {/* Scale (for image watermarks) */}
                                        {draft.type === "IMAGE" && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs text-slate-400 flex items-center justify-between">
                                                    <span className="flex items-center gap-1">
                                                        <Maximize2 className="w-3 h-3" /> 缩放
                                                    </span>
                                                    <span className="text-cyan-400">{draft.scale}%</span>
                                                </label>
                                                <Slider
                                                    value={[draft.scale]}
                                                    onValueChange={([v]: number[]) => setDraft({ ...draft, scale: v })}
                                                    min={1}
                                                    max={100}
                                                    step={5}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Save Button */}
                                <div className="flex justify-end pt-4 border-t border-white/10">
                                    <Button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white px-6"
                                    >
                                        {saving ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4 mr-2" />
                                        )}
                                        {isCreating ? "创建" : "保存"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            </main>
        </div>
    )
}
