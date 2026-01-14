"use client"

import { useState, useEffect, useCallback } from "react"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import {
    Loader2,
    Sparkles,
    ChevronDown,
    Copy,
    Check,
    Clock,
    FileText,
} from "lucide-react"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/sidebar"
import { useCosts } from "@/hooks/use-costs"
import ReactMarkdown from "react-markdown"

// Types
interface CopywritingItem {
    id: string
    platform: string
    productName: string
    content: string
    cost: number
    createdAt: string
}

interface Platform {
    id: string
    value: string   // API返回 value 不是 key
    label: string
}

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function CopywritingPage() {
    const { data: session, update: updateSession } = useSession()
    const { costs } = useCosts()

    // Form state
    const [platform, setPlatform] = useState("")
    const [productName, setProductName] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Result state
    const [generatedContent, setGeneratedContent] = useState("")
    const [copied, setCopied] = useState(false)

    // Platform selector
    const [isPlatformOpen, setIsPlatformOpen] = useState(false)

    // Fetch platforms - API返回数组格式，不是 { platforms: [...] }
    const { data: platformsData } = useSWR<Platform[]>(
        "/api/config/platforms",
        fetcher
    )
    const platforms = platformsData || []

    // Fetch history
    const { data: historyData, mutate: mutateHistory } = useSWR<{ items: CopywritingItem[] }>(
        session?.user ? "/api/copywriting/history?limit=20" : null,
        fetcher,
        { refreshInterval: 0 }
    )
    const history = historyData?.items || []

    // Handle generate
    const handleGenerate = useCallback(async () => {
        if (!platform) {
            toast.error("请选择平台")
            return
        }
        if (!productName.trim()) {
            toast.error("请输入商品名称")
            return
        }

        setIsSubmitting(true)
        setGeneratedContent("")

        try {
            const res = await fetch("/api/copywriting/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ platform, productName: productName.trim() }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || "生成失败")
            }

            setGeneratedContent(data.content)
            toast.success("文案生成成功！")

            // Refresh history and session
            mutateHistory()
            updateSession()
        } catch (err: any) {
            toast.error(err.message || "生成失败")
        } finally {
            setIsSubmitting(false)
        }
    }, [platform, productName, mutateHistory, updateSession])

    // Handle copy
    const handleCopy = useCallback(async () => {
        if (!generatedContent) return

        try {
            await navigator.clipboard.writeText(generatedContent)
            setCopied(true)
            toast.success("已复制到剪贴板")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("复制失败")
        }
    }, [generatedContent])

    // Load history item into preview
    const loadHistoryItem = useCallback((item: CopywritingItem) => {
        setPlatform(item.platform)
        setProductName(item.productName)
        setGeneratedContent(item.content)
    }, [])

    const selectedPlatformLabel = platforms.find(p => p.value === platform)?.label || "选择平台"

    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
            <Sidebar />

            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">智能商品描述</h1>
                            <p className="text-sm text-slate-400">AI 自动生成商品描述文案</p>
                        </div>
                        <Badge variant="outline" className="ml-auto bg-emerald-500/10 text-emerald-400 border-emerald-500/30 px-3 py-1">
                            <span className="font-bold">{costs.COPYWRITING_COST}</span>
                            <span className="ml-1">积分/次</span>
                        </Badge>
                    </div>
                </div>

                {/* Main Content - Split Layout */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel - Input */}
                    <div className="w-[400px] border-r border-white/5 flex flex-col p-6 space-y-6">
                        {/* Platform Selector */}
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400 font-medium">选择平台（暂只支持虾皮）</label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsPlatformOpen(!isPlatformOpen)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-left text-white hover:bg-white/10 transition-colors"
                                >
                                    <span className={platform ? "text-white" : "text-slate-400"}>
                                        {selectedPlatformLabel}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isPlatformOpen ? "rotate-180" : ""}`} />
                                </button>

                                <AnimatePresence>
                                    {isPlatformOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute z-10 mt-2 w-full bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-xl"
                                        >
                                            {platforms.map(p => (
                                                <button
                                                    key={p.value}
                                                    onClick={() => {
                                                        setPlatform(p.value)
                                                        setIsPlatformOpen(false)
                                                    }}
                                                    className={`w-full px-4 py-3 text-left hover:bg-white/10 transition-colors ${platform === p.value ? "bg-emerald-500/20 text-emerald-400" : "text-white"
                                                        }`}
                                                >
                                                    {p.label}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Product Name */}
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400 font-medium">商品名称</label>
                            <input
                                type="text"
                                value={productName}
                                onChange={(e) => setProductName(e.target.value)}
                                placeholder="输入商品名称，如：不锈钢保温杯..."
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                            />
                        </div>

                        {/* Generate Button */}
                        <Button
                            onClick={handleGenerate}
                            disabled={isSubmitting || !platform || !productName.trim()}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-6 text-base font-medium rounded-xl"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    生成中...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5 mr-2" />
                                    生成文案 ({costs.COPYWRITING_COST} 积分)
                                </>
                            )}
                        </Button>

                        {/* History */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-medium text-slate-400">历史记录</h3>
                                <span className="text-xs text-slate-500">{history.length} 条</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                                {history.length === 0 ? (
                                    <div className="text-center text-slate-500 text-sm py-8">
                                        暂无历史记录
                                    </div>
                                ) : (
                                    history.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => loadHistoryItem(item)}
                                            className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
                                        >
                                            <div className="text-sm text-white font-medium truncate">
                                                {item.productName}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                    {platforms.find(p => p.value === item.platform)?.label || item.platform}
                                                </Badge>
                                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: zhCN })}
                                                </span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Preview */}
                    <div className="flex-1 flex flex-col p-6 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">文案预览</h2>
                            {generatedContent && (
                                <Button
                                    onClick={handleCopy}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs border-white/10 hover:bg-white/10"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 mr-1.5 text-green-400" />
                                            已复制
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                                            复制全部
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>

                        <div className="flex-1 bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                            {generatedContent ? (
                                <div className="h-full overflow-y-auto p-6 prose prose-invert prose-sm max-w-none scrollbar-thin">
                                    <ReactMarkdown>{generatedContent}</ReactMarkdown>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                    <FileText className="w-12 h-12 mb-3 opacity-30" />
                                    <p className="text-sm">生成的文案将在这里显示</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
