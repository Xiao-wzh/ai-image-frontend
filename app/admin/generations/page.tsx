"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Search, RefreshCw, ChevronLeft, ChevronRight, User, Loader2, X, ZoomIn, Crown,
    Image, Sparkles, TrendingUp, CheckCircle, Zap, Filter, LayoutGrid, Layers, Palette, Calendar,
    ChevronDown, ChevronUp, RotateCcw, DollarSign, AlertCircle, Video, Play, Clock
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

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

type Appeal = {
    id: string
    status: string
    appealedImages: string[]
    reason: string | null
    refundAmount: number
    createdAt: string
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
    model: string | null
    imageCount: number | null
    costPerImage: number | null
    totalCost: number | null
    refundAmount: number | null
    aspectRatio: string | null
    features: string | null
    proFeatures: string | null
    proStyle: string | null
    originalImage: string[]
    refImages: string[]
    generatedImage: string | null
    generatedImages: string[]
    outputLanguage: string | null
    createdAt: string
    user: UserOption | null
    appeal: Appeal | null
}

type Stats = {
    todayCount: number
    totalCost: number
    totalRefund: number
    proCount: number
    completedCount: number
    successRate: number
    proRate: number
    refundRate: number
}

type VideoGenerationItem = {
    id: string
    taskId: string
    model: string
    prompt: string
    seconds: number
    size: string
    status: string
    progress: number
    videoUrl: string | null
    cost: number
    costPerSecond: number
    hasRefunded: boolean
    errorMsg: string | null
    referenceImage: string | null
    createdAt: string
    completedAt: string | null
    user: UserOption | null
}

type VideoStats = {
    todayCount: number
    totalCost: number
    totalRefund: number
    completedCount: number
    successRate: number
    refundRate: number
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
    const [hasRefund, setHasRefund] = useState<string>("all")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    // 展开行状态
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

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

    // 视频 Tab 状态
    const [activeTab, setActiveTab] = useState("image")
    const [videoData, setVideoData] = useState<VideoGenerationItem[]>([])
    const [videoStats, setVideoStats] = useState<VideoStats | null>(null)
    const [videoLoading, setVideoLoading] = useState(false)
    const [videoPage, setVideoPage] = useState(1)
    const [videoTotal, setVideoTotal] = useState(0)
    const [videoTotalPages, setVideoTotalPages] = useState(0)
    const [videoStatus, setVideoStatus] = useState<string>("all")
    const [videoModel] = useState<string>("all")
    const [videoHasRefund, setVideoHasRefund] = useState<string>("all")
    const [videoStartDate, setVideoStartDate] = useState("")
    const [videoEndDate, setVideoEndDate] = useState("")
    const [previewVideo, setPreviewVideo] = useState<string | null>(null)
    const [videoExpandedRows, setVideoExpandedRows] = useState<Set<string>>(new Set())

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

    // User search（带防抖）
    const searchUsers = useCallback(async (query: string) => {
        if (!query.trim()) {
            setUserOptions([])
            return
        }
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
            if (hasRefund && hasRefund !== "all") params.set("hasRefund", hasRefund)
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
    }, [page, selectedUser, productSearch, productType, status, qualityMode, taskType, mode, hasRefund, startDate, endDate])

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
        setHasRefund("all")
        setStartDate("")
        setEndDate("")
        setPage(1)
        setExpandedRows(new Set())
    }

    // 视频 Tab：获取视频列表
    const fetchVideoData = useCallback(async () => {
        setVideoLoading(true)
        try {
            const params = new URLSearchParams()
            params.set("page", String(videoPage))
            params.set("limit", String(limit))
            if (selectedUser) params.set("userId", selectedUser.id)
            if (videoStatus && videoStatus !== "all") params.set("status", videoStatus)
            if (videoModel && videoModel !== "all") params.set("model", videoModel)
            if (videoHasRefund && videoHasRefund !== "all") params.set("hasRefund", videoHasRefund)
            if (videoStartDate) params.set("startDate", videoStartDate)
            if (videoEndDate) params.set("endDate", videoEndDate)

            const res = await fetch(`/api/admin/generations/video-list?${params}`)
            if (res.ok) {
                const result = await res.json()
                setVideoData(result.data)
                setVideoTotal(result.total)
                setVideoTotalPages(result.totalPages)
                setVideoStats(result.stats)
            }
        } catch (err) {
            console.error("获取视频数据失败:", err)
        } finally {
            setVideoLoading(false)
        }
    }, [videoPage, selectedUser, videoStatus, videoModel, videoHasRefund, videoStartDate, videoEndDate])

    useEffect(() => {
        if (activeTab === "video") {
            fetchVideoData()
        }
    }, [activeTab, videoPage])

    const handleVideoSearch = () => {
        setVideoPage(1)
        fetchVideoData()
    }

    const handleVideoReset = () => {
        setVideoStatus("all")
        setVideoHasRefund("all")
        setVideoStartDate("")
        setVideoEndDate("")
        setVideoPage(1)
        setVideoExpandedRows(new Set())
    }

    const toggleVideoRow = (id: string) => {
        setVideoExpandedRows(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    // 切换展开行
    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
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

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="mb-6">
                        <TabsTrigger value="image" className="gap-2">
                            <Image className="w-4 h-4" /> 图片生成
                        </TabsTrigger>
                        <TabsTrigger value="video" className="gap-2">
                            <Video className="w-4 h-4" /> 视频生成
                        </TabsTrigger>
                    </TabsList>

                    {/* 图片生成 Tab */}
                    <TabsContent value="image">

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

                        {/* 退款统计 */}
                        {stats.totalRefund > 0 && (
                            <div className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border border-rose-500/20 rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-rose-500/20 rounded-lg">
                                        <RotateCcw className="w-5 h-5 text-rose-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400">已退款</p>
                                        <p className="text-xl font-bold text-white">{stats.totalRefund?.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        )}
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
                                    <Command className="bg-transparent" shouldFilter={false}>
                                        <CommandInput placeholder="搜索用户名/邮箱..." value={userSearchQuery} onValueChange={setUserSearchQuery} className="text-white" />
                                        <CommandList>
                                            {userLoading ? (
                                                <div className="p-4 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" /></div>
                                            ) : userSearchQuery && userOptions.length === 0 ? (
                                                <CommandEmpty className="text-slate-400 py-4">未找到用户</CommandEmpty>
                                            ) : (
                                                <CommandGroup>
                                                    {userOptions.slice(0, 10).map((user) => (
                                                        <CommandItem key={user.id} value={`${user.email} ${user.username || ""} ${user.name || ""}`} onSelect={() => { setSelectedUser(user); setUserSearchOpen(false) }} className="cursor-pointer text-white hover:bg-white/10">
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

                        {/* Has Refund */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                                <RotateCcw className="w-3 h-3" /> 退款
                            </label>
                            <Select value={hasRefund} onValueChange={setHasRefund}>
                                <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm"><SelectValue placeholder="全部" /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="all" className="text-white">全部</SelectItem>
                                    <SelectItem value="true" className="text-white">已退款</SelectItem>
                                    <SelectItem value="false" className="text-white">未退款</SelectItem>
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
                            <>
                                <span className="ml-3 text-purple-400">
                                    消耗 <span className="font-medium">{stats.totalCost.toLocaleString()}</span> 积分
                                </span>
                                {stats.totalRefund > 0 && (
                                    <span className="ml-3 text-rose-400">
                                        退款 <span className="font-medium">{stats.totalRefund?.toLocaleString()}</span> 积分
                                    </span>
                                )}
                            </>
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
                        <div className="col-span-1"></div>
                        <div className="col-span-2">用户</div>
                        <div className="col-span-2">产品</div>
                        <div className="col-span-1">任务/模式</div>
                        <div className="col-span-2">生成结果</div>
                        <div className="col-span-1">费用/退款</div>
                        <div className="col-span-1">状态</div>
                        <div className="col-span-2">时间</div>
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
                            {data.map((item) => {
                                const isExpanded = expandedRows.has(item.id)
                                const hasRefund = (item.refundAmount || 0) > 0
                                const refundPercent = hasRefund && item.totalCost ? Math.round(((item.refundAmount || 0) / item.totalCost) * 100) : 0
                                return (
                                    <div key={item.id} className="border-b border-white/5 last:border-b-0">
                                        <div
                                            className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 items-center hover:bg-white/[0.02] transition-colors cursor-pointer"
                                            onClick={() => toggleRow(item.id)}
                                        >
                                            {/* Expand Button */}
                                            <div className="col-span-1 flex justify-center">
                                                <button className="p-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-4 h-4 text-white" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                                    )}
                                                </button>
                                            </div>

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
                                                {item.model && item.model !== "nano-banana-pro" && (
                                                    <span className="text-[10px] text-purple-400/70 truncate">{item.model}</span>
                                                )}
                                            </div>

                                            {/* Generated Image */}
                                            <div className="col-span-2">
                                                {item.generatedImage || item.generatedImages?.length > 0 ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative w-12 h-12 rounded-lg border border-emerald-500/30 overflow-hidden cursor-pointer hover:scale-105 transition-transform" onClick={(e) => {
                                                            e.stopPropagation()
                                                            const imgs = item.qualityMode === "PRO" && item.generatedImages?.length > 0 ? item.generatedImages : [item.generatedImage || item.generatedImages?.[0]!]
                                                            openPreview(imgs, 0)
                                                        }}>
                                                            <LazyImage
                                                                src={getThumbnailUrl(item.generatedImage || item.generatedImages?.[0], 200) ?? (item.generatedImage || item.generatedImages?.[0])}
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

                                            {/* Cost/Refund */}
                                            <div className="col-span-1">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className={`text-sm font-medium ${hasRefund ? "text-slate-500 line-through" : "text-purple-400"}`}>
                                                        {item.totalCost || 0}
                                                    </span>
                                                    {hasRefund && (
                                                        <div className="flex items-center gap-1 text-rose-400">
                                                            <RotateCcw className="w-3 h-3" />
                                                            <span className="text-xs">-{item.refundAmount}</span>
                                                            <span className="text-[10px] text-slate-500">({refundPercent}%)</span>
                                                        </div>
                                                    )}
                                                    {/* 申诉信息 */}
                                                    {item.appeal && (
                                                        <div className="flex items-center gap-1 text-amber-400 mt-0.5">
                                                            <AlertCircle className="w-3 h-3" />
                                                            <span className="text-[10px]">申诉{item.appeal.appealedImages?.length || 0}张</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Status */}
                                            <div className="col-span-1">{getStatusBadge(item.status)}</div>

                                            {/* Time */}
                                            <div className="col-span-2 text-xs text-slate-400">{format(new Date(item.createdAt), "MM-dd HH:mm")}</div>
                                        </div>

                                        {/* Expanded Details Panel */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="p-4 bg-white/[0.02] border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                                        {/* 输出语言 */}
                                                        <div className="space-y-1">
                                                            <div className="text-slate-500">输出语言</div>
                                                            <div className="text-white">{item.outputLanguage || "中文"}</div>
                                                        </div>

                                                        {/* 图片比例 */}
                                                        <div className="space-y-1">
                                                            <div className="text-slate-500">图片比例</div>
                                                            <div className="text-white">{item.aspectRatio || "1:1"}</div>
                                                        </div>

                                                        {/* 生成张数 */}
                                                        <div className="space-y-1">
                                                            <div className="text-slate-500">生成张数</div>
                                                            <div className="text-white">{item.imageCount || 1} 张</div>
                                                        </div>

                                                        {/* 单张成本 */}
                                                        <div className="space-y-1">
                                                            <div className="text-slate-500">单张成本</div>
                                                            <div className="text-white">{item.costPerImage || 0} 积分</div>
                                                        </div>

                                                        {/* PRO功能描述 */}
                                                        {item.proFeatures && (
                                                            <div className="col-span-2 space-y-1">
                                                                <div className="text-slate-500">产品功能</div>
                                                                <div className="text-white text-sm">{item.proFeatures}</div>
                                                            </div>
                                                        )}

                                                        {/* PRO风格描述 */}
                                                        {item.proStyle && (
                                                            <div className="col-span-2 space-y-1">
                                                                <div className="text-slate-500">画面风格</div>
                                                                <div className="text-white text-sm">{item.proStyle}</div>
                                                            </div>
                                                        )}

                                                        {/* 克隆卖点 */}
                                                        {item.features && (
                                                            <div className="col-span-2 space-y-1">
                                                                <div className="text-slate-500">卖点描述</div>
                                                                <div className="text-white text-sm">{item.features}</div>
                                                            </div>
                                                        )}

                                                        {/* 原图 */}
                                                        <div className="col-span-2 space-y-1">
                                                            <div className="text-slate-500">原图 ({item.originalImage?.length || 0}张)</div>
                                                            <div className="flex gap-1.5 flex-wrap">
                                                                {item.originalImage?.map((img, idx) => (
                                                                    <div key={idx} className="relative w-10 h-10 rounded-lg border border-white/10 overflow-hidden cursor-pointer hover:scale-105 transition-transform" onClick={() => openPreview(item.originalImage, idx)}>
                                                                        <LazyImage src={getThumbnailUrl(img, 200) ?? img} alt="" className="object-cover" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* 参考图 */}
                                                        {item.refImages?.length > 0 && (
                                                            <div className="col-span-2 space-y-1">
                                                                <div className="text-slate-500">参考图 ({item.refImages.length}张)</div>
                                                                <div className="flex gap-1.5 flex-wrap">
                                                                    {item.refImages.map((img, idx) => (
                                                                        <div key={idx} className="relative w-10 h-10 rounded-lg border border-cyan-500/30 overflow-hidden cursor-pointer hover:scale-105 transition-transform" onClick={() => openPreview(item.refImages, idx)}>
                                                                            <LazyImage src={getThumbnailUrl(img, 200) ?? img} alt="" className="object-cover" />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )
                            })}
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

                    </TabsContent>

                    {/* 视频生成 Tab */}
                    <TabsContent value="video">
                        {/* 视频统计卡片 */}
                        {videoStats && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.05 }}
                                className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
                            >
                                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-blue-500/20 rounded-lg">
                                            <Video className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400">今日视频</p>
                                            <p className="text-xl font-bold text-white">{videoStats.todayCount}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-purple-500/20 rounded-lg">
                                            <Sparkles className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400">视频消耗</p>
                                            <p className="text-xl font-bold text-white">{videoStats.totalCost.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-emerald-500/20 rounded-lg">
                                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400">成功率</p>
                                            <p className="text-xl font-bold text-white">{videoStats.successRate}%</p>
                                        </div>
                                    </div>
                                </div>
                                {videoStats.totalRefund > 0 && (
                                    <div className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border border-rose-500/20 rounded-xl p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-rose-500/20 rounded-lg">
                                                <RotateCcw className="w-5 h-5 text-rose-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400">已退款</p>
                                                <p className="text-xl font-bold text-white">{videoStats.totalRefund.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* 视频筛选栏 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6"
                        >
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {/* 用户（复用） */}
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

                                {/* 状态 */}
                                <div className="space-y-1.5">
                                    <label className="text-xs text-slate-400 font-medium">状态</label>
                                    <Select value={videoStatus} onValueChange={setVideoStatus}>
                                        <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm"><SelectValue placeholder="全部" /></SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10">
                                            <SelectItem value="all" className="text-white">全部</SelectItem>
                                            <SelectItem value="PENDING" className="text-white">处理中</SelectItem>
                                            <SelectItem value="PROCESSING" className="text-white">生成中</SelectItem>
                                            <SelectItem value="COMPLETED" className="text-white">已完成</SelectItem>
                                            <SelectItem value="FAILED" className="text-white">失败</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* 模型 */}
                                <div className="space-y-1.5">
                                    <label className="text-xs text-slate-400 font-medium">模型</label>
                                    <Select value={videoModel} disabled>
                                        <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm"><SelectValue placeholder="Sora-2" /></SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10">
                                            <SelectItem value="all" className="text-white">全部</SelectItem>
                                            <SelectItem value="sora-2" className="text-white">Sora-2</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* 退款 */}
                                <div className="space-y-1.5">
                                    <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                                        <RotateCcw className="w-3 h-3" /> 退款
                                    </label>
                                    <Select value={videoHasRefund} onValueChange={setVideoHasRefund}>
                                        <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm"><SelectValue placeholder="全部" /></SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-white/10">
                                            <SelectItem value="all" className="text-white">全部</SelectItem>
                                            <SelectItem value="true" className="text-white">已退款</SelectItem>
                                            <SelectItem value="false" className="text-white">未退款</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* 日期范围 */}
                                <div className="space-y-1.5">
                                    <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3" /> 日期范围
                                    </label>
                                    <DateRangePicker
                                        value={{ startDate: videoStartDate, endDate: videoEndDate }}
                                        onChange={({ startDate, endDate }) => {
                                            setVideoStartDate(startDate)
                                            setVideoEndDate(endDate)
                                        }}
                                        placeholder="选择日期..."
                                        className="w-full"
                                    />
                                </div>

                                {/* 按钮 */}
                                <div className="flex gap-2 items-end">
                                    <Button onClick={handleVideoSearch} className="h-9 bg-blue-600 hover:bg-blue-700 text-white text-sm px-3">
                                        <Search className="w-3.5 h-3.5 mr-1" /> 搜索
                                    </Button>
                                    <Button onClick={handleVideoReset} variant="outline" className="h-9 bg-white/5 border-white/10 text-white hover:bg-white/10 px-3">
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </motion.div>

                        {/* 视频记录摘要 */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-sm text-slate-400">
                                共 <span className="text-white font-medium">{videoTotal}</span> 条记录
                                {videoStats && videoTotal > 0 && (
                                    <>
                                        <span className="ml-3 text-purple-400">
                                            消耗 <span className="font-medium">{videoStats.totalCost.toLocaleString()}</span> 积分
                                        </span>
                                        {videoStats.totalRefund > 0 && (
                                            <span className="ml-3 text-rose-400">
                                                退款 <span className="font-medium">{videoStats.totalRefund.toLocaleString()}</span> 积分
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 视频表格 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                        >
                            {/* 表头 */}
                            <div className="hidden md:grid grid-cols-12 gap-3 p-3 border-b border-white/10 text-xs text-slate-500 font-medium bg-white/[0.02]">
                                <div className="col-span-2">用户</div>
                                <div className="col-span-3">提示词</div>
                                <div className="col-span-1">模型/分辨率</div>
                                <div className="col-span-1">时长</div>
                                <div className="col-span-2">预览</div>
                                <div className="col-span-1">费用</div>
                                <div className="col-span-1">状态</div>
                                <div className="col-span-1">时间</div>
                            </div>

                            {/* 表体 */}
                            {videoLoading ? (
                                <div className="space-y-3 p-4">
                                    {[1, 2, 3, 4, 5].map((i) => (<Skeleton key={i} className="h-16 w-full bg-white/10 rounded-xl" />))}
                                </div>
                            ) : videoData.length === 0 ? (
                                <div className="text-center py-16 text-slate-400">
                                    <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>暂无视频数据</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {videoData.map((item) => {
                                        const isExpanded = videoExpandedRows.has(item.id)
                                        return (
                                            <div key={item.id} className="border-b border-white/5 last:border-b-0">
                                                <div
                                                    className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 items-center hover:bg-white/[0.02] transition-colors cursor-pointer"
                                                    onClick={() => toggleVideoRow(item.id)}
                                                >
                                                    {/* 用户 */}
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

                                                    {/* 提示词 */}
                                                    <div className="col-span-3">
                                                        <div className="text-sm text-white truncate" title={item.prompt}>{item.prompt}</div>
                                                    </div>

                                                    {/* 模型/分辨率 */}
                                                    <div className="col-span-1">
                                                        <div className="text-xs text-slate-300">{item.model}</div>
                                                        <div className="text-xs text-slate-500">{item.size}</div>
                                                    </div>

                                                    {/* 时长 */}
                                                    <div className="col-span-1">
                                                        <div className="text-sm text-white flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-slate-400" />
                                                            {item.seconds}秒
                                                        </div>
                                                    </div>

                                                    {/* 预览 */}
                                                    <div className="col-span-2">
                                                        {item.status === "COMPLETED" && item.videoUrl ? (
                                                            <div
                                                                className="relative w-20 h-12 rounded-lg border border-emerald-500/30 overflow-hidden cursor-pointer hover:scale-105 transition-transform bg-black/50"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setPreviewVideo(item.videoUrl)
                                                                }}
                                                            >
                                                                <video
                                                                    src={item.videoUrl}
                                                                    preload="metadata"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                                    <Play className="w-4 h-4 text-white" />
                                                                </div>
                                                            </div>
                                                        ) : item.status === "PROCESSING" ? (
                                                            <div className="w-20 h-12 bg-white/5 rounded-lg flex items-center justify-center">
                                                                <div className="w-full px-2">
                                                                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">{item.progress}%</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-20 h-12 bg-white/5 rounded-lg flex items-center justify-center">
                                                                <span className="text-slate-500 text-[10px]">无</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 费用 */}
                                                    <div className="col-span-1">
                                                        <span className={`text-sm font-medium ${item.hasRefunded ? "text-slate-500 line-through" : "text-purple-400"}`}>
                                                            {item.cost}
                                                        </span>
                                                        {item.hasRefunded && (
                                                            <div className="flex items-center gap-1 text-rose-400">
                                                                <RotateCcw className="w-3 h-3" />
                                                                <span className="text-xs">已退</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 状态 */}
                                                    <div className="col-span-1">
                                                        {(() => {
                                                            const config: Record<string, { color: string; label: string }> = {
                                                                PENDING: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "处理中" },
                                                                PROCESSING: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "生成中" },
                                                                COMPLETED: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "已完成" },
                                                                FAILED: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "失败" },
                                                            }
                                                            const c = config[item.status] || { color: "bg-gray-500/20 text-gray-400", label: item.status }
                                                            return <Badge className={`${c.color} border text-xs`}>{c.label}</Badge>
                                                        })()}
                                                    </div>

                                                    {/* 时间 */}
                                                    <div className="col-span-1 text-xs text-slate-400">{format(new Date(item.createdAt), "MM-dd HH:mm")}</div>
                                                </div>

                                                {/* 展开详情 */}
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="p-4 bg-white/[0.02] border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                                                <div className="col-span-4 space-y-1">
                                                                    <div className="text-slate-500">完整提示词</div>
                                                                    <div className="text-white text-sm whitespace-pre-wrap">{item.prompt}</div>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <div className="text-slate-500">Task ID</div>
                                                                    <div className="text-white break-all">{item.taskId}</div>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <div className="text-slate-500">单价</div>
                                                                    <div className="text-white">{item.costPerSecond} 积分/秒</div>
                                                                </div>
                                                                {item.completedAt && (
                                                                    <div className="space-y-1">
                                                                        <div className="text-slate-500">完成时间</div>
                                                                        <div className="text-white">{format(new Date(item.completedAt), "yyyy-MM-dd HH:mm:ss")}</div>
                                                                    </div>
                                                                )}
                                                                {item.errorMsg && (
                                                                    <div className="space-y-1">
                                                                        <div className="text-slate-500">错误信息</div>
                                                                        <div className="text-rose-400">{item.errorMsg}</div>
                                                                    </div>
                                                                )}
                                                                {item.referenceImage && (
                                                                    <div className="col-span-2 space-y-1">
                                                                        <div className="text-slate-500">参考图</div>
                                                                        <div className="flex gap-1.5 flex-wrap">
                                                                            <div className="relative w-10 h-10 rounded-lg border border-cyan-500/30 overflow-hidden cursor-pointer hover:scale-105 transition-transform" onClick={() => openPreview([item.referenceImage!], 0)}>
                                                                                <LazyImage src={getThumbnailUrl(item.referenceImage, 200) ?? item.referenceImage} alt="" className="object-cover" />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* 分页 */}
                            {videoTotalPages > 1 && (
                                <div className="flex items-center justify-between p-4 border-t border-white/10">
                                    <div className="text-sm text-slate-400">第 {videoPage} / {videoTotalPages} 页</div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" disabled={videoPage <= 1} onClick={() => setVideoPage(videoPage - 1)} className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button variant="outline" size="sm" disabled={videoPage >= videoTotalPages} onClick={() => setVideoPage(videoPage + 1)} className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </TabsContent>
                </Tabs>

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

            {/* 视频预览 */}
            <AnimatePresence>
                {previewVideo && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewVideo(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
                            <video
                                src={previewVideo}
                                controls
                                autoPlay
                                className="w-full max-h-[90vh] rounded-lg"
                            />
                            <Button variant="outline" size="icon" className="absolute top-2 right-2 bg-black/50 border-white/20 text-white hover:bg-black/70" onClick={() => setPreviewVideo(null)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
