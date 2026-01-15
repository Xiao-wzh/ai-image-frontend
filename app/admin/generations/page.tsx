"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, User, Loader2, X, ZoomIn } from "lucide-react"
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
    status: string
    originalImage: string[]
    generatedImage: string | null
    generatedImages: string[]
    outputLanguage: string | null
    createdAt: string
    user: UserOption | null
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
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    // Platforms and product types from database
    const [platforms, setPlatforms] = useState<PlatformOption[]>([])
    const [filteredProductTypes, setFilteredProductTypes] = useState<{ key: string; label: string }[]>([])

    // Data states
    const [data, setData] = useState<Generation[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const limit = 20

    // Image preview lightbox
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    // Fetch platforms from database
    useEffect(() => {
        const fetchPlatforms = async () => {
            try {
                const res = await fetch("/api/config/platforms")
                if (res.ok) {
                    const result = await res.json()
                    // API returns array directly: [{id, label, value, types: [{label, value}]}]
                    const platformList: PlatformOption[] = (Array.isArray(result) ? result : []).map((p: any) => ({
                        key: p.value,  // API uses 'value' for key
                        name: p.label, // API uses 'label' for name
                        prompts: (p.types || []).map((t: any) => ({
                            productType: t.value,
                            productTypeLabel: t.label || t.value,
                        })),
                    }))
                    setPlatforms(platformList)
                    console.log("Loaded platforms:", platformList)

                    // Extract all unique product types
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
            // Show all product types
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
            // Show product types for selected platform
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
        setProductType("all") // Reset product type when platform changes
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
            if (startDate) params.set("startDate", startDate)
            if (endDate) params.set("endDate", endDate)

            const res = await fetch(`/api/admin/generations/list?${params}`)
            if (res.ok) {
                const result = await res.json()
                setData(result.data)
                setTotal(result.total)
                setTotalPages(result.totalPages)
            }
        } catch (err) {
            console.error("获取数据失败:", err)
        } finally {
            setLoading(false)
        }
    }, [page, selectedUser, productSearch, productType, status, startDate, endDate])

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
        setStartDate("")
        setEndDate("")
        setPage(1)
    }

    // Status badge colors
    const getStatusBadge = (s: string) => {
        const statusConfig: Record<string, { color: string; label: string }> = {
            PENDING: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "处理中" },
            PROCESSING: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "生成中" },
            COMPLETED: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "已完成" },
            FAILED: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "失败" },
        }
        const config = statusConfig[s] || { color: "bg-gray-500/20 text-gray-400", label: s }
        return <Badge className={`${config.color} border`}>{config.label}</Badge>
    }

    // Get product type label
    const getProductTypeLabel = (key: string) => {
        const found = filteredProductTypes.find(t => t.key === key)
        if (found) return found.label
        // Search all platforms
        for (const p of platforms) {
            const pr = p.prompts.find(pr => pr.productType === key)
            if (pr) return pr.productTypeLabel
        }
        return key
    }

    return (
        <div className="flex min-h-screen bg-[#0a0a0f]">
            <Sidebar />
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Filter className="w-6 h-6 text-blue-400" />
                        生成记录管理
                    </h1>
                    <p className="text-slate-400 mt-1">查看和管理所有用户的生成记录</p>
                </motion.div>

                {/* Filter Bar - Multi-row layout */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6"
                >
                    {/* Row 1: User, Product, Platform */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        {/* User Combobox */}
                        <div className="space-y-2">
                            <label className="text-sm text-slate-300 font-medium">用户</label>
                            <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className="w-full justify-between h-11 bg-white/5 border-white/10 text-white hover:bg-white/10"
                                    >
                                        {selectedUser ? (
                                            <div className="flex items-center gap-2 truncate">
                                                <Avatar className="w-5 h-5">
                                                    <AvatarImage src={selectedUser.image || ""} />
                                                    <AvatarFallback className="text-xs bg-blue-500">
                                                        {(selectedUser.name || selectedUser.email)?.[0]?.toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="truncate text-white">{selectedUser.username || selectedUser.name || selectedUser.email}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400">选择用户...</span>
                                        )}
                                        {selectedUser ? (
                                            <X
                                                className="w-4 h-4 text-slate-400 hover:text-white"
                                                onClick={(e) => { e.stopPropagation(); setSelectedUser(null) }}
                                            />
                                        ) : (
                                            <User className="w-4 h-4 text-slate-400" />
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0 bg-slate-900 border-white/10">
                                    <Command className="bg-transparent">
                                        <CommandInput
                                            placeholder="搜索用户名/邮箱..."
                                            value={userSearchQuery}
                                            onValueChange={setUserSearchQuery}
                                            className="text-white"
                                        />
                                        <CommandList>
                                            {userLoading ? (
                                                <div className="p-4 text-center">
                                                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                                                </div>
                                            ) : userOptions.length === 0 ? (
                                                <CommandEmpty className="text-slate-400">未找到用户</CommandEmpty>
                                            ) : (
                                                <CommandGroup>
                                                    {userOptions.map((user) => (
                                                        <CommandItem
                                                            key={user.id}
                                                            value={user.email}
                                                            onSelect={() => {
                                                                setSelectedUser(user)
                                                                setUserSearchOpen(false)
                                                            }}
                                                            className="cursor-pointer text-white hover:bg-white/10"
                                                        >
                                                            <Avatar className="w-6 h-6 mr-2">
                                                                <AvatarImage src={user.image || ""} />
                                                                <AvatarFallback className="text-xs bg-blue-500">
                                                                    {(user.name || user.email)?.[0]?.toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-white">{user.username || user.name || "无名称"}</span>
                                                                <span className="text-xs text-slate-400">{user.email}</span>
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
                        <div className="space-y-2">
                            <label className="text-sm text-slate-300 font-medium">产品名称</label>
                            <Input
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder="搜索产品..."
                                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                            />
                        </div>

                        {/* Platform */}
                        <div className="space-y-2">
                            <label className="text-sm text-slate-300 font-medium">平台</label>
                            <Select value={platform} onValueChange={setPlatform}>
                                <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white">
                                    <SelectValue placeholder="全部平台" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="all" className="text-white">全部平台</SelectItem>
                                    {platforms.map((p) => (
                                        <SelectItem key={p.key} value={p.key} className="text-white">{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Product Type / Style */}
                        <div className="space-y-2">
                            <label className="text-sm text-slate-300 font-medium">风格</label>
                            <Select value={productType} onValueChange={setProductType}>
                                <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white">
                                    <SelectValue placeholder="全部风格" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="all" className="text-white">全部风格</SelectItem>
                                    {filteredProductTypes.map((type) => (
                                        <SelectItem key={type.key} value={type.key} className="text-white">{type.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 2: Status, Date Range, Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Status */}
                        <div className="space-y-2">
                            <label className="text-sm text-slate-300 font-medium">状态</label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white">
                                    <SelectValue placeholder="全部状态" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="all" className="text-white">全部状态</SelectItem>
                                    <SelectItem value="PENDING" className="text-white">处理中</SelectItem>
                                    <SelectItem value="PROCESSING" className="text-white">生成中</SelectItem>
                                    <SelectItem value="COMPLETED" className="text-white">已完成</SelectItem>
                                    <SelectItem value="FAILED" className="text-white">失败</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Start Date */}
                        <div className="space-y-2">
                            <label className="text-sm text-slate-300 font-medium">开始日期</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-11 bg-white/5 border-white/10 text-white"
                            />
                        </div>

                        {/* End Date */}
                        <div className="space-y-2">
                            <label className="text-sm text-slate-300 font-medium">结束日期</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="h-11 bg-white/5 border-white/10 text-white"
                            />
                        </div>

                        {/* Buttons */}
                        <div className="space-y-2">
                            <label className="text-sm text-transparent font-medium">操作</label>
                            <div className="flex gap-2">
                                <Button onClick={handleSearch} className="h-11 flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                                    <Search className="w-4 h-4 mr-2" />
                                    搜索
                                </Button>
                                <Button onClick={handleReset} variant="outline" className="h-11 bg-white/5 border-white/10 text-white hover:bg-white/10">
                                    <RefreshCw className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Stats */}
                <div className="mb-4 text-sm text-slate-400">
                    共 <span className="text-white font-medium">{total}</span> 条记录
                </div>

                {/* Data Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                >
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 text-xs text-slate-400 font-medium">
                        <div className="col-span-2">用户</div>
                        <div className="col-span-2">产品</div>
                        <div className="col-span-1">语言</div>
                        <div className="col-span-2">原图</div>
                        <div className="col-span-2">九宫格</div>
                        <div className="col-span-1">状态</div>
                        <div className="col-span-2">时间</div>
                    </div>

                    {/* Table Body */}
                    {loading ? (
                        <div className="space-y-4 p-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-20 w-full bg-white/10 rounded-xl" />
                            ))}
                        </div>
                    ) : data.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>暂无数据</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {data.map((item) => (
                                <div
                                    key={item.id}
                                    className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors"
                                >
                                    {/* User */}
                                    <div className="col-span-2 flex items-center gap-2">
                                        <Avatar className="w-8 h-8 flex-shrink-0">
                                            <AvatarImage src={item.user?.image || ""} />
                                            <AvatarFallback className="bg-blue-500 text-xs text-white">
                                                {(item.user?.name || item.user?.email)?.[0]?.toUpperCase() || "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <div className="text-sm text-white font-medium truncate">
                                                {item.user?.username || item.user?.name || "未知"}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate">
                                                {item.user?.email?.split("@")[0] || "-"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Product */}
                                    <div className="col-span-2">
                                        <div className="text-sm text-white truncate" title={item.productName}>{item.productName}</div>
                                        <Badge variant="outline" className="text-xs mt-1 border-white/20 text-slate-400">
                                            {getProductTypeLabel(item.productType)}
                                        </Badge>
                                    </div>

                                    {/* Language */}
                                    <div className="col-span-1">
                                        <span className="text-xs text-slate-300">{item.outputLanguage || "中文"}</span>
                                    </div>

                                    {/* Original Images */}
                                    <div className="col-span-2">
                                        <div className="flex -space-x-2">
                                            {item.originalImage?.slice(0, 3).map((img, idx) => (
                                                <div
                                                    key={idx}
                                                    className="relative w-12 h-12 rounded-lg border-2 border-[#0a0a0f] overflow-hidden cursor-pointer hover:z-10 hover:scale-110 transition-transform group"
                                                    onClick={() => setPreviewImage(img)}
                                                >
                                                    <img
                                                        src={img}
                                                        alt={`Original ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <ZoomIn className="w-4 h-4 text-white" />
                                                    </div>
                                                </div>
                                            ))}
                                            {(item.originalImage?.length || 0) > 3 && (
                                                <div className="w-12 h-12 rounded-lg bg-white/10 border-2 border-[#0a0a0f] flex items-center justify-center text-xs text-slate-400">
                                                    +{item.originalImage.length - 3}
                                                </div>
                                            )}
                                            {!item.originalImage?.length && (
                                                <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center">
                                                    <span className="text-slate-500 text-xs">无</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Generated Image (九宫格) - Admin Only */}
                                    <div className="col-span-2">
                                        {item.generatedImage ? (
                                            <div
                                                className="relative w-16 h-16 rounded-lg border-2 border-emerald-500/30 overflow-hidden cursor-pointer hover:scale-110 transition-transform group"
                                                onClick={() => setPreviewImage(item.generatedImage!)}
                                            >
                                                <img
                                                    src={item.generatedImage}
                                                    alt="九宫格"
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <ZoomIn className="w-4 h-4 text-white" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 bg-white/5 rounded-lg flex items-center justify-center">
                                                <span className="text-slate-500 text-xs">无</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-1">
                                        {getStatusBadge(item.status)}
                                    </div>

                                    {/* Time */}
                                    <div className="col-span-2 text-sm text-slate-400">
                                        {format(new Date(item.createdAt), "MM-dd HH:mm")}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t border-white/10">
                            <div className="text-sm text-slate-400">
                                第 {page} / {totalPages} 页
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage(page - 1)}
                                    className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(page + 1)}
                                    className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </main>

            {/* Image Preview Lightbox */}
            <AnimatePresence>
                {previewImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                        onClick={() => setPreviewImage(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative max-w-4xl max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={previewImage}
                                alt="Preview"
                                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                className="absolute top-2 right-2 bg-black/50 border-white/20 text-white hover:bg-black/70"
                                onClick={() => setPreviewImage(null)}
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
