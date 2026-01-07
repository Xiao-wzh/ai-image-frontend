"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Search, Filter, RefreshCw, Eye, ChevronLeft, ChevronRight, User, Calendar, Loader2, X } from "lucide-react"
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
import { ProductType, ProductTypeLabel } from "@/lib/constants"

type UserOption = {
    id: string
    name: string | null
    username: string | null
    email: string
    image: string | null
}

type Generation = {
    id: string
    productName: string
    productType: string
    status: string
    originalImage: string[]
    generatedImage: string | null
    generatedImages: string[]
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
    const [productType, setProductType] = useState<string>("all")
    const [status, setStatus] = useState<string>("all")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    // Data states
    const [data, setData] = useState<Generation[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const limit = 20

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
    }, [page]) // Only auto-fetch on page change

    const handleSearch = () => {
        setPage(1)
        fetchData()
    }

    const handleReset = () => {
        setSelectedUser(null)
        setProductSearch("")
        setProductType("all")
        setStatus("all")
        setStartDate("")
        setEndDate("")
        setPage(1)
        // fetchData will be called after state updates
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

                {/* Filter Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        {/* User Combobox */}
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400">用户</label>
                            <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className="w-full justify-between h-10 bg-white/5 border-white/10 text-white hover:bg-white/10"
                                    >
                                        {selectedUser ? (
                                            <div className="flex items-center gap-2 truncate">
                                                <Avatar className="w-5 h-5">
                                                    <AvatarImage src={selectedUser.image || ""} />
                                                    <AvatarFallback className="text-xs bg-blue-500">
                                                        {(selectedUser.name || selectedUser.email)?.[0]?.toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="truncate">{selectedUser.username || selectedUser.name || selectedUser.email}</span>
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
                                                                <span className="font-medium">{user.username || user.name || "无名称"}</span>
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
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400">产品名称</label>
                            <Input
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder="搜索产品..."
                                className="h-10 bg-white/5 border-white/10 text-white"
                            />
                        </div>

                        {/* Product Type */}
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400">产品类型</label>
                            <Select value={productType} onValueChange={setProductType}>
                                <SelectTrigger className="h-10 bg-white/5 border-white/10 text-white">
                                    <SelectValue placeholder="全部类型" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="all">全部类型</SelectItem>
                                    {Object.entries(ProductTypeLabel).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Status */}
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400">状态</label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="h-10 bg-white/5 border-white/10 text-white">
                                    <SelectValue placeholder="全部状态" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10">
                                    <SelectItem value="all">全部状态</SelectItem>
                                    <SelectItem value="PENDING">处理中</SelectItem>
                                    <SelectItem value="PROCESSING">生成中</SelectItem>
                                    <SelectItem value="COMPLETED">已完成</SelectItem>
                                    <SelectItem value="FAILED">失败</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Date Range */}
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400">日期范围</label>
                            <div className="flex gap-2">
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="h-10 bg-white/5 border-white/10 text-white flex-1"
                                />
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="h-10 bg-white/5 border-white/10 text-white flex-1"
                                />
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="space-y-1">
                            <label className="text-xs text-transparent">操作</label>
                            <div className="flex gap-2">
                                <Button onClick={handleSearch} className="h-10 flex-1 bg-blue-600 hover:bg-blue-700">
                                    <Search className="w-4 h-4 mr-1" />
                                    搜索
                                </Button>
                                <Button onClick={handleReset} variant="outline" className="h-10 bg-white/5 border-white/10 text-white hover:bg-white/10">
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
                        <div className="col-span-3">用户</div>
                        <div className="col-span-3">产品</div>
                        <div className="col-span-2">缩略图</div>
                        <div className="col-span-2">状态</div>
                        <div className="col-span-2">时间</div>
                    </div>

                    {/* Table Body */}
                    {loading ? (
                        <div className="space-y-4 p-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-16 w-full bg-white/10 rounded-xl" />
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
                                    <div className="col-span-3 flex items-center gap-3">
                                        <Avatar className="w-8 h-8">
                                            <AvatarImage src={item.user?.image || ""} />
                                            <AvatarFallback className="bg-blue-500 text-xs">
                                                {(item.user?.name || item.user?.email)?.[0]?.toUpperCase() || "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <div className="text-sm text-white font-medium truncate">
                                                {item.user?.username || item.user?.name || "未知用户"}
                                            </div>
                                            <div className="text-xs text-slate-400 truncate">
                                                {item.user?.email || "-"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Product */}
                                    <div className="col-span-3">
                                        <div className="text-sm text-white truncate">{item.productName}</div>
                                        <Badge variant="outline" className="text-xs mt-1 border-white/20 text-slate-400">
                                            {ProductTypeLabel[item.productType as keyof typeof ProductTypeLabel] || item.productType}
                                        </Badge>
                                    </div>

                                    {/* Thumbnail */}
                                    <div className="col-span-2">
                                        {item.generatedImage || item.generatedImages?.[0] ? (
                                            <img
                                                src={item.generatedImage || item.generatedImages?.[0]}
                                                alt="Generated"
                                                className="w-12 h-12 object-cover rounded-lg border border-white/10"
                                            />
                                        ) : item.originalImage?.[0] ? (
                                            <img
                                                src={item.originalImage[0]}
                                                alt="Original"
                                                className="w-12 h-12 object-cover rounded-lg border border-white/10 opacity-50"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center">
                                                <span className="text-slate-500 text-xs">无图</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-2">
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
        </div>
    )
}
