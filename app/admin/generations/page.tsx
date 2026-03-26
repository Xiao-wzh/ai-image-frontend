"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Search, RefreshCw, ChevronLeft, ChevronRight, User, Loader2, X, ZoomIn, Crown,
    Image, Sparkles, TrendingUp, CheckCircle, Zap, Filter, LayoutGrid, Layers, Palette, Calendar
} from "lucide-react"
import { format } from "date-fns"

import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductTypeLabel } from "@/lib/constants"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { getThumbnailUrl } from "@/lib/cdnUrl"
import { LazyImage } from "@/components/lazy-image"

type UserOption = {
    id: string
    name: string | null
    username: string | null
    email: string
    image: string | null
}

type PlatformOption = {
    key: string
    name: string
    prompts: { productType: string; productTypeLabel: string }[]
}

type Generation = {
    id: string
    productName: string
    productType: string
    productTypeDescription: string | null
    taskType: string | null
    status: string
    qualityMode: string | null
    mode: string | null
    imageCount: number | null
    costPerImage: number | null
    totalCost: number | null
    originalImage: string[]
    refImages: string[]
    generatedImage: string | null
    generatedImages: string[]
    outputLanguage: string | null
    createdAt: string
    user: UserOption | null
}

type Stats = {
    todayCount: number
    totalCost: number
    proCount: number
    completedCount: number
    successRate: number
    proRate: number
}

export default function AdminGenerationsPage() {
    // Filter states
    const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)
    const [userSearchOpen, setUserSearchOpen] = useState(false)
    const [userSearchQuery, setUserSearchQuery] = useState("")
    const [userOptions, setUserOptions] = useState<UserOption[]>([])
    const [userLoading, setUserLoading] = useState(false)

    const [productSearch, setProductSearch] = useState("")
    const [platform, setPlatform] = useState<string>("all")
    const [productType, setProductType] = useState<string>("all")
    const [status, setStatus] = useState<string>("all")
    const [qualityMode, setQualityMode] = useState<string>("all")
    const [taskType, setTaskType] = useState<string>("all")
    const [mode, setMode] = useState<string>("all")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    // Platforms and product types from database
    const [platforms, setPlatforms] = useState<PlatformOption[]>([])
    const [filteredProductTypes, setFilteredProductTypes] = useState<{ key: string; label: string }[]>([])

    // Data states
    const [data, setData] = useState<Generation[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const limit = 10  // 减少每页数量，避免图片请求过多

    // Image preview
    const [previewImages, setPreviewImages] = useState<string[]>([])
    const [previewImageIndex, setPreviewImageIndex] = useState(0)
    const previewImage = previewImages[previewImageIndex] ?? null

    const openPreview = useCallback((images: string[], index = 0) => {
        setPreviewImages(images)
        setPreviewImageIndex(index)
    }, [])
    const closePreview = useCallback(() => setPreviewImages([]), [])
    const prevImage = useCallback(() => setPreviewImageIndex(i => Math.max(0, i - 1)), [])
    const nextImage = useCallback(() => setPreviewImageIndex(i => Math.min(previewImages.length - 1, i + 1)), [previewImages.length])

    // Keyboard navigation
    useEffect(() => {
        if (!previewImages.length) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") prevImage()
            else if (e.key === "ArrowRight") nextImage()
            else if (e.key === "Escape") closePreview()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [previewImages.length, prevImage, nextImage, closePreview])

    // Fetch platforms
    useEffect(() => {
        const fetchPlatforms = async () => {
            try {
                const res = await fetch("/api/config/platforms")
                if (res.ok) {
                    const result = await res.json()
                    const platformList: PlatformOption[] = (Array.isArray(result) ? result : []).map((p: any) => ({
                        key: p.value,
                        name: p.label,
                        prompts: (p.types || []).map((t: any) => ({
                            productType: t.value,
                            productTypeLabel: t.label || t.value,
                        })),
                    }))
                    setPlatforms(platformList)

                    const allTypes: { key: string; label: string }[] = []
                    const seen = new Set<string>()
                    platformList.forEach((p) => {
                        p.prompts.forEach((pr) => {
                            if (!seen.has(pr.productType)) {
                                seen.add(pr.productType)
                                allTypes.push({ key: pr.productType, label: pr.productTypeLabel })
                            }
                        })
                    })
                    setFilteredProductTypes(allTypes)
                }
            } catch (err) {
                console.error("获取平台失败:", err)
            }
        }
        fetchPlatforms()
    }, [])

    // Update product types when platform changes
    useEffect(() => {
        if (platform === "all") {
            const allTypes: { key: string; label: string }[] = []
            const seen = new Set<string>()
            platforms.forEach((p) => {
                p.prompts.forEach((pr) => {
                    if (!seen.has(pr.productType)) {
                        seen.add(pr.productType)
                        allTypes.push({ key: pr.productType, label: pr.productTypeLabel })
                    }
                })
            })
            setFilteredProductTypes(allTypes)
        } else {
            const selectedPlatform = platforms.find((p) => p.key === platform)
            if (selectedPlatform) {
                setFilteredProductTypes(
                    selectedPlatform.prompts.map((pr) => ({
                        key: pr.productType,
                        label: pr.productTypeLabel,
                    }))
                )
            }
        }
        setProductType("all")
    }, [platform, platforms])

    // User search
    const searchUsers = useCallback(async (query: string) => {
        setUserLoading(true)
        try {
            const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`)
            if (res.ok) {
                const users = await res.json()
                setUserOptions(users)
            }
        } catch (err) {
            console.error("搜索用户失败:", err)
        } finally {
            setUserLoading(false)
        }
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => {
            searchUsers(userSearchQuery)
        }, 300)
        return () => clearTimeout(timer)
    }, [userSearchQuery, searchUsers])

    // Fetch generations
    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.set("page", String(page))
            params.set("limit", String(limit))
            if (selectedUser) params.set("userId", selectedUser.id)
            if (productSearch) params.set("productSearch", productSearch)
            if (productType && productType !== "all") params.set("productType", productType)
            if (status && status !== "all") params.set("status", status)
            if (qualityMode && qualityMode !== "all") params.set("qualityMode", qualityMode)
            if (taskType && taskType !== "all") params.set("taskType", taskType)
            if (mode && mode !== "all") params.set("mode", mode)
            if (startDate) params.set("startDate", startDate)
            if (endDate) params.set("endDate", endDate)

            const res = await fetch(`/api/admin/generations/list?${params}`)
            if (res.ok) {
                const result = await res.json()
                setData(result.data)
                setTotal(result.total)
                setTotalPages(result.totalPages)
                setStats(result.stats)
            }
        } catch (err) {
            console.error("获取数据失败:", err)
        } finally {
            setLoading(false)
        }
    }, [page, selectedUser, productSearch, productType, status, qualityMode, taskType, mode, startDate, endDate])

    useEffect(() => {
        fetchData()
    }, [page])

    const handleSearch = () => {
        setPage(1)
        fetchData()
    }

    const handleReset = () => {
        setSelectedUser(null)
        setProductSearch("")
        setPlatform("all")
        setProductType("all")
        setStatus("all")
        setQualityMode("all")
        setTaskType("all")
        setMode("all")
        setStartDate("")
        setEndDate("")
        setPage(1)
    }

    // Status badge
    const getStatusBadge = (s: string) => {
        const config: Record<string, { color: string; label: string }> = {
            PENDING: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "处理中" },
            PROCESSING: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "生成中" },
            COMPLETED: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "已完成" },
            PARTIAL_SUCCESS: { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", label: "部分成功" },
            FAILED: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "失败" },
        }
        const c = config[s] || { color: "bg-gray-500/20 text-gray-400", label: s }
        return <Badge className={`${c.color} border text-xs`}>{c.label}</Badge>
    }

    // Get product type label
    const getProductTypeLabel = (item: Generation) => {
        if (item.productTypeDescription) return item.productTypeDescription
        const found = filteredProductTypes.find(t => t.key === item.productType)
        if (found) return found.label
        for (const p of platforms) {
            const pr = p.prompts.find(pr => pr.productType === item.productType)
            if (pr) return pr.productTypeLabel
        }
        return (ProductTypeLabel as any)[item.productType] || item.productType
    }

    // Get task type label
    const getTaskTypeLabel = (t: string | null) => {
        const labels: Record<string, string> = {
            MAIN_IMAGE: "主图",
            DETAIL_PAGE: "详情页",
        }
        return t ? labels[t] || t : "-"
    }

    // Get mode label
    const getModeLabel = (m: string | null) => {
        const labels: Record<string, { label: string; color: string }> = {
            CREATIVE: { label: "创意", color: "text-purple-400" },
            CLONE: { label: "克隆", color: "text-cyan-400" },
        }
        if (!m) return "-"
        const config = labels[m]
        return config ? <span className={config.color}>{config.label}</span> : m
    }

    return (
        <div className="flex h-screen bg-[#0a0a0f]">
            <Sidebar />
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <LayoutGrid className="w-6 h-6 text-blue-400" />
                        生成记录管理
                    </h1>
                    <p className="text-slate-400 mt-1">查看和管理所有用户的生成记录</p>
                </motion.div>

                {/* Stats Cards */}
                {stats && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
                    >
                        {/* 今日生成 */}
                        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-500/20 rounded-lg">
                                    <Zap className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">今日生成</p>
                                    <p className="text-xl font-bold text-white">{stats.todayCount}</p>
                                </div>
                            </div>
                        </div>

                        {/* 筛选消耗 */}
                        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-purple-500/20 rounded-lg">
                                    <Sparkles className="w-5 h-5 text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">筛选消耗</p>
                                    <p className="text-xl font-bold text-white">{stats.totalCost.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* PRO占比 */}
                        <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/20 rounded-lg">
                                    <Crown className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">PRO占比</p>
                                    <p className="text-xl font-bold text-white">{stats.proRate}%</p>
                                </div>
                            </div>
                        </div>

                        {/* 成功率 */}
                        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-500/20 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">成功率</p>
                                    <p className="text-xl font-bold text-white">{stats.successRate}%</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Filter Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6"
                >
                    {/* Row 1: User, Product, Platform, ProductType */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        {/* User Combobox */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                                <User className="w-3 h-3" /> 用户
                            </label>
                            <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className="w-full justify-between h-9 bg-white/5 border-white/10 text-white hover:bg-white/10 text-sm"
                                    >
                                        {selectedUser ? (
                                            <div className="flex items-center gap-2 truncate">
                                                <Avatar className="w-4 h-4">
                                                    <AvatarImage src={selectedUser.image || ""} />
                                                    <AvatarFallback className="text-[10px] bg-blue-500">
                                                        {(selectedUser.name || selectedUser.email)?.[0]?.toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="truncate">{selectedUser.username || selectedUser.email}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-500">选择用户...</span>
                                        )}
                                        {selectedUser ? (
                                            <X className="w-3.5 h-3.5 text-slate-400 hover:text-white" onClick={(e) => { e.stopPropagation(); setSelectedUser(null) }} />
                                        ) : (
                                            <User className="w-3.5 h-3.5 text-slate-500" />
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[280px] p-0 bg-slate-900 border-white/10">
                                    <Command className="bg-transparent">
                                        <CommandInput placeholder="搜索用户..." value={userSearchQuery} onValueChange={setUserSearchQuery} className="text-white" />
                                        <CommandList>
                                            {userLoading ? (
                                                <div className="p-4 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" /></div>
                                            ) : userOptions.length === 0 ? (
                                                <CommandEmpty className="text-slate-400 py-4">未找到用户</CommandEmpty>
                                            ) : (
                                                <CommandGroup>
                                                    {userOptions.slice(0, 10).map((user) => (
                                                        <CommandItem key={user.id} value={user.email} onSelect={() => { setSelectedUser(user); setUserSearchOpen(false) }} className="cursor-pointer text-white hover:bg-white/10">
                                                            <Avatar className="w-5 h-5 mr-2">
                                                                <AvatarImage src={user.image || ""} />
                                                                <AvatarFallback className="text-[10px] bg-blue-500">{(user.name || user.email)?.[0]?.toUpperCase()}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-sm">{user.username || user.name || "无名称"}</span>
                                                                <span className="text-xs text-slate-500">{user.email}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            )}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Product Search */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">产品名称</label>
                            <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="搜索..." className="h-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-sm" />
                        </div>

                        {/* Platform */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">平台</label>
                            <Select value={platform} onValueChange={setPlatform}>
                                <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm"><SelectValue placeholder="全部平台" /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10 max-h-[280px] overflow-y-auto">
                                    <SelectItem value="all" className="text-white">全部平台</SelectItem>
                                    {platforms.map((p) => (<SelectItem key={p.key} value={p.key} className="text-white">{p.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Product Type */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                                <Palette className="w-3 h-3" /> 风格
                            </label>
                            <Select value={productType} onValueChange={setProductType}>
                                <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm"><SelectValue placeholder="全部风格" /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10 max-h-[280px] overflow-y-auto">
                                    <SelectItem value="all" className="text-white">全部风格</SelectItem>
                                    {filteredProductTypes.map((type) => (<SelectItem key={type.key} value={type.key} className="text-white">{type.label}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 2: Status, QualityMode, TaskType, Mode, DateRange, Buttons */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                        {/* Status */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">状态</label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm"><SelectValue placeholder="全部" /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="all" className="text-white">全部</SelectItem>
                                    <SelectItem value="PENDING" className="text-white">处理中</SelectItem>
                                    <SelectItem value="PROCESSING" className="text-white">生成中</SelectItem>
                                    <SelectItem value="COMPLETED" className="text-white">已完成</SelectItem>
                                    <SelectItem value="PARTIAL_SUCCESS" className="text-white">部分成功</SelectItem>
                                    <SelectItem value="FAILED" className="text-white">失败</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Quality Mode */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                                <Crown className="w-3 h-3" /> 画质
                            </label>
                            <Select value={qualityMode} onValueChange={setQualityMode}>
                                <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm"><SelectValue placeholder="全部" /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="all" className="text-white">全部</SelectItem>
                                    <SelectItem value="PRO" className="text-white">PRO</SelectItem>
                                    <SelectItem value="STANDARD" className="text-white">标准</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Task Type */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                                <Layers className="w-3 h-3" /> 任务
                            </label>
                            <Select value={taskType} onValueChange={setTaskType}>
                                <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm"><SelectValue placeholder="全部" /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="all" className="text-white">全部</SelectItem>
                                    <SelectItem value="MAIN_IMAGE" className="text-white">主图</SelectItem>
                                    <SelectItem value="DETAIL_PAGE" className="text-white">详情页</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Mode */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium">模式</label>
                            <Select value={mode} onValueChange={setMode}>
                                <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm"><SelectValue placeholder="全部" /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="all" className="text-white">全部</SelectItem>
                                    <SelectItem value="CREATIVE" className="text-white">创意</SelectItem>
                                    <SelectItem value="CLONE" className="text-white">克隆</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Date Range */}
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" /> 日期范围
                            </label>
                            <DateRangePicker
                                value={{ startDate, endDate }}
                                onChange={({ startDate, endDate }) => {
                                    setStartDate(startDate)
                                    setEndDate(endDate)
                                }}
                                placeholder="选择日期..."
                                className="w-full"
                            />
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-2">
                            <Button onClick={handleSearch} className="h-9 bg-blue-600 hover:bg-blue-700 text-white text-sm px-3">
                                <Search className="w-3.5 h-3.5 mr-1" /> 搜索
                            </Button>
                            <Button onClick={handleReset} variant="outline" className="h-9 bg-white/5 border-white/10 text-white hover:bg-white/10 px-3">
                                <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* Results Summary */}
                <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-slate-400">
                        共 <span className="text-white font-medium">{total}</span> 条记录
                        {stats && total > 0 && (
                            <span className="ml-3 text-purple-400">
                                消耗 <span className="font-medium">{stats.totalCost.toLocaleString()}</span> 积分
                            </span>
                        )}
                    </div>
                </div>

                {/* Data Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                >
                    {/* Table Header */}
                    <div className="hidden md:grid grid-cols-12 gap-3 p-3 border-b border-white/10 text-xs text-slate-500 font-medium bg-white/[0.02]">
                        <div className="col-span-2">用户</div>
                        <div className="col-span-2">产品</div>
                        <div className="col-span-1">任务/模式</div>
                        <div className="col-span-2">原图/参考</div>
                        <div className="col-span-2">生成结果</div>
                        <div className="col-span-1">费用</div>
                        <div className="col-span-1">状态</div>
                        <div className="col-span-1">时间</div>
                    </div>

                    {/* Table Body */}
                    {loading ? (
                        <div className="space-y-3 p-4">
                            {[1, 2, 3, 4, 5].map((i) => (<Skeleton key={i} className="h-16 w-full bg-white/10 rounded-xl" />))}
                        </div>
                    ) : data.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>暂无数据</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {data.map((item) => (
                                <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 items-center hover:bg-white/[0.02] transition-colors">
                                    {/* User */}
                                    <div className="col-span-2 flex items-center gap-2">
                                        <Avatar className="w-7 h-7 flex-shrink-0">
                                            <AvatarImage src={item.user?.image || ""} />
                                            <AvatarFallback className="bg-blue-500 text-[10px] text-white">
                                                {(item.user?.name || item.user?.email)?.[0]?.toUpperCase() || "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <div className="text-sm text-white truncate">{item.user?.username || item.user?.name || "未知"}</div>
                                            <div className="text-xs text-slate-500 truncate">{item.user?.email?.split("@")[0]}</div>
                                        </div>
                                    </div>

                                    {/* Product */}
                                    <div className="col-span-2">
                                        <div className="text-sm text-white truncate" title={item.productName}>{item.productName}</div>
                                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                            <Badge variant="outline" className="text-[10px] border-white/20 text-slate-400 px-1.5 py-0">
                                                {getProductTypeLabel(item)}
                                            </Badge>
                                            {item.qualityMode === "PRO" && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] text-white font-bold">
                                                    <Crown className="w-2.5 h-2.5" />PRO
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Task/Mode */}
                                    <div className="col-span-1 flex flex-col gap-0.5">
                                        <span className="text-xs text-slate-300">{getTaskTypeLabel(item.taskType)}</span>
                                        <span className="text-xs">{getModeLabel(item.mode)}</span>
                                    </div>

                                    {/* Original Images */}
                                    <div className="col-span-2">
                                        <div className="flex gap-1.5">
                                            <div className="flex -space-x-1.5">
                                                {item.originalImage?.slice(0, 2).map((img, idx) => (
                                                    <div key={idx} className="relative w-9 h-9 rounded-lg border-2 border-[#0a0a0f] overflow-hidden cursor-pointer hover:z-10 hover:scale-110 transition-transform" onClick={() => openPreview(item.originalImage, idx)}>
                                                        <LazyImage src={getThumbnailUrl(img, 100) ?? img} alt="" className="object-cover" />
                                                    </div>
                                                ))}
                                                {(item.originalImage?.length || 0) > 2 && (
                                                    <div className="w-9 h-9 rounded-lg bg-white/10 border-2 border-[#0a0a0f] flex items-center justify-center text-[10px] text-slate-400">+{item.originalImage.length - 2}</div>
                                                )}
                                                {!item.originalImage?.length && <div className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center"><span className="text-slate-500 text-[10px]">无</span></div>}
                                            </div>
                                            {item.refImages?.length > 0 && (
                                                <div className="flex -space-x-1.5">
                                                    {item.refImages.slice(0, 2).map((img, idx) => (
                                                        <div key={idx} className="relative w-9 h-9 rounded-lg border-2 border-cyan-500/30 overflow-hidden cursor-pointer hover:z-10 hover:scale-110 transition-transform" onClick={() => openPreview(item.refImages, idx)}>
                                                            <LazyImage src={getThumbnailUrl(img, 100) ?? img} alt="" className="object-cover" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Generated Image */}
                                    <div className="col-span-2">
                                        {item.generatedImage || item.generatedImages?.length > 0 ? (
                                            <div className="flex items-center gap-2">
                                                <div className="relative w-12 h-12 rounded-lg border border-emerald-500/30 overflow-hidden cursor-pointer hover:scale-105 transition-transform" onClick={() => {
                                                    const imgs = item.qualityMode === "PRO" && item.generatedImages?.length > 0 ? item.generatedImages : [item.generatedImage || item.generatedImages?.[0]!]
                                                    openPreview(imgs, 0)
                                                }}>
                                                    <LazyImage
                                                        src={getThumbnailUrl(item.generatedImage || item.generatedImages?.[0], 150) ?? (item.generatedImage || item.generatedImages?.[0])}
                                                        alt=""
                                                        className={item.qualityMode === "PRO" ? "object-contain bg-black/50" : "object-cover"}
                                                    />
                                                </div>
                                                <span className="text-[10px] text-slate-500">
                                                    {item.qualityMode === "PRO" ? `${item.generatedImages?.length || 0}/${item.imageCount ?? "?"}张` : `${item.generatedImages?.length || 0}张`}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center"><span className="text-slate-500 text-[10px]">无</span></div>
                                        )}
                                    </div>

                                    {/* Cost */}
                                    <div className="col-span-1">
                                        <span className="text-sm text-purple-400 font-medium">{item.totalCost || 0}</span>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-1">{getStatusBadge(item.status)}</div>

                                    {/* Time */}
                                    <div className="col-span-1 text-xs text-slate-400">{format(new Date(item.createdAt), "MM-dd HH:mm")}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t border-white/10">
                            <div className="text-sm text-slate-400">第 {page} / {totalPages} 页</div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </main>

            {/* Image Preview */}
            <AnimatePresence>
                {previewImages.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={closePreview}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                            <img src={previewImage || ""} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg" loading="lazy" />
                            <Button variant="outline" size="icon" className="absolute top-2 right-2 bg-black/50 border-white/20 text-white hover:bg-black/70" onClick={closePreview}>
                                <X className="w-5 h-5" />
                            </Button>
                            {previewImages.length > 1 && (
                                <>
                                    <Button variant="outline" size="icon" disabled={previewImageIndex === 0} onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 border-white/20 text-white hover:bg-black/70 disabled:opacity-30">
                                        <ChevronLeft className="w-5 h-5" />
                                    </Button>
                                    <Button variant="outline" size="icon" disabled={previewImageIndex === previewImages.length - 1} onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 border-white/20 text-white hover:bg-black/70 disabled:opacity-30">
                                        <ChevronRight className="w-5 h-5" />
                                    </Button>
                                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-xs">
                                        {previewImageIndex + 1} / {previewImages.length}
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
