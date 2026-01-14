"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useDropzone } from "react-dropzone"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import {
    Upload,
    X,
    Loader2,
    Download,
    AlertCircle,
    Clock,
    CheckCircle2,
    ImageIcon,
    Trash2
} from "lucide-react"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/sidebar"
import { useCosts } from "@/hooks/use-costs"

// Types
interface WatermarkTask {
    id: string
    originalUrl: string
    resultUrl: string | null
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
    errorMsg: string | null
    createdAt: string
    updatedAt: string
}

interface SelectedImage {
    file: File
    previewUrl: string // blob URL for preview
}

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json())

// Check if result is expired (> 1 hour from creation)
function isExpired(createdAt: string): boolean {
    const created = new Date(createdAt).getTime()
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    return (now - created) > oneHour
}

// Format time remaining
function getExpiryText(createdAt: string): string {
    const created = new Date(createdAt).getTime()
    const expiresAt = created + (60 * 60 * 1000) // 1 hour after creation
    const now = Date.now()
    const remaining = expiresAt - now

    if (remaining <= 0) return "已过期"

    const minutes = Math.floor(remaining / (60 * 1000))
    if (minutes < 60) return `${minutes}分钟后过期`
    return "约1小时后过期"
}

// Upload a single file to TOS
async function uploadToTOS(file: File): Promise<string> {
    // 1. Get presigned URL
    const signRes = await fetch("/api/watermark/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            filename: file.name,
            contentType: file.type
        })
    })

    if (!signRes.ok) {
        const err = await signRes.json()
        throw new Error(err.error || "获取上传链接失败")
    }

    const { uploadUrl, publicUrl } = await signRes.json()

    // 2. Upload file to TOS
    const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
    })

    if (!uploadRes.ok) {
        throw new Error("上传文件失败")
    }

    return publicUrl
}

export default function WatermarkPage() {
    const { update: updateSession } = useSession()
    const { costs } = useCosts()
    const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<string>("")
    const [, setCurrentTime] = useState(Date.now())

    // Track previous task statuses to detect changes
    const prevTaskStatusesRef = useRef<Map<string, string>>(new Map())

    // Fetch history with SWR
    const { data, mutate } = useSWR<{ success: boolean; tasks: WatermarkTask[] }>(
        "/api/watermark/history",
        fetcher,
        {
            // 只有当有待处理任务时才轮询，否则不轮询
            refreshInterval: (data) => {
                const hasPending = data?.tasks?.some(t =>
                    t.status === "PENDING" || t.status === "PROCESSING"
                )
                return hasPending ? 3000 : 0
            }
        }
    )

    const tasks = data?.tasks || []
    const hasPendingTasks = tasks.some(t => t.status === "PENDING" || t.status === "PROCESSING")

    // 获取队列状态（只在有待处理任务时轮询）
    const { data: queueData } = useSWR<{ pendingCount: number; queuePosition: number }>(
        hasPendingTasks ? "/api/watermark/queue-status" : null,
        fetcher,
        { refreshInterval: 5000 }
    )

    // Detect task status changes and refresh session (for refunds on failure)
    useEffect(() => {
        const prevStatuses = prevTaskStatusesRef.current
        let shouldRefreshSession = false

        for (const task of tasks) {
            const prevStatus = prevStatuses.get(task.id)
            // If task was PENDING/PROCESSING and now FAILED or COMPLETED, refresh session
            if (prevStatus && (prevStatus === "PENDING" || prevStatus === "PROCESSING")) {
                if (task.status === "FAILED" || task.status === "COMPLETED") {
                    shouldRefreshSession = true
                }
            }
            prevStatuses.set(task.id, task.status)
        }

        if (shouldRefreshSession) {
            updateSession()
        }
    }, [tasks, updateSession])

    // Update current time every 30 seconds for expiry check
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(Date.now()), 30000)
        return () => clearInterval(interval)
    }, [])

    // Handle file drop
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const newImages: SelectedImage[] = []

        for (const file of acceptedFiles) {
            // 只允许 JPG, PNG, BMP 格式 (API 支持: jpg, jpeg, bmp, png)
            const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/bmp"]
            if (!ALLOWED_TYPES.includes(file.type)) {
                toast.error(`${file.name} 格式不支持，只支持 JPG、PNG、BMP`)
                continue
            }

            // Create preview URL
            const previewUrl = URL.createObjectURL(file)
            newImages.push({ file, previewUrl })
        }

        setSelectedImages(prev => [...prev, ...newImages])
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/jpeg": [".jpg", ".jpeg"],
            "image/png": [".png"],
            "image/bmp": [".bmp"]
        },
        multiple: true
    })

    // Remove image from selection
    const removeImage = (index: number) => {
        setSelectedImages(prev => {
            const newImages = [...prev]
            // Revoke object URL to free memory
            URL.revokeObjectURL(newImages[index].previewUrl)
            newImages.splice(index, 1)
            return newImages
        })
    }

    // Clear all selected images
    const clearImages = () => {
        selectedImages.forEach(img => URL.revokeObjectURL(img.previewUrl))
        setSelectedImages([])
    }

    // Submit images for processing
    const handleSubmit = async () => {
        if (selectedImages.length === 0) {
            toast.error("请先选择图片")
            return
        }

        setIsSubmitting(true)

        try {
            // ✅ 先检查积分是否足够
            setUploadProgress("检查积分...")
            const requiredCredits = selectedImages.length * costs.WATERMARK_REMOVE_COST

            const sessionRes = await fetch("/api/auth/session")
            const sessionData = await sessionRes.json()
            const totalCredits = (sessionData?.user?.credits || 0) + (sessionData?.user?.bonusCredits || 0)

            if (totalCredits < requiredCredits) {
                toast.error(`积分不足 (需要 ${requiredCredits}，当前 ${totalCredits})`)
                setIsSubmitting(false)
                setUploadProgress("")
                return
            }

            // 积分足够，开始上传
            const tosUrls: string[] = []

            for (let i = 0; i < selectedImages.length; i++) {
                setUploadProgress(`上传中 (${i + 1}/${selectedImages.length})...`)
                const url = await uploadToTOS(selectedImages[i].file)
                tosUrls.push(url)
            }

            setUploadProgress("提交任务...")

            // Submit TOS URLs for processing
            const res = await fetch("/api/watermark/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: tosUrls })
            })

            const result = await res.json()

            if (!res.ok) {
                throw new Error(result.error || "提交失败")
            }

            toast.success(result.message || "任务已提交")
            clearImages()
            mutate() // Refresh history
            updateSession() // Refresh sidebar credits

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "提交失败"
            toast.error(message)
        } finally {
            setIsSubmitting(false)
            setUploadProgress("")
        }
    }

    // Status badge component
    const StatusBadge = ({ task }: { task: WatermarkTask }) => {
        switch (task.status) {
            case "PENDING":
                const queuePos = queueData?.queuePosition || 0
                return (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                        <Clock className="w-3 h-3 mr-1" />
                        {queuePos > 0 ? `排队中 (前方${queuePos}个)` : "等待中"}
                    </Badge>
                )
            case "PROCESSING":
                return (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        处理中
                    </Badge>
                )
            case "COMPLETED":
                return (
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        已完成
                    </Badge>
                )
            case "FAILED":
                return (
                    <Badge
                        variant="outline"
                        className="bg-red-500/10 text-red-400 border-red-500/30 cursor-help"
                        title={task.errorMsg || "未知错误"}
                    >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        失败
                    </Badge>
                )
            default:
                return null
        }
    }

    // Result action component
    const ResultAction = ({ task }: { task: WatermarkTask }) => {
        if (task.status !== "COMPLETED" || !task.resultUrl) {
            return <span className="text-slate-500">-</span>
        }

        const expired = isExpired(task.createdAt)

        if (expired) {
            return (
                <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/30">
                    已过期
                </Badge>
            )
        }

        return (
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    variant="ghost"
                    className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                    onClick={() => window.open(task.resultUrl!, "_blank")}
                >
                    <Download className="w-4 h-4 mr-1" />
                    下载
                </Button>
                <span className="text-xs text-slate-500">
                    {getExpiryText(task.createdAt)}
                </span>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-slate-950">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <main className="flex-1 overflow-y-auto min-w-0">
                    <div className="relative pt-10 pb-8 px-8 min-w-0">
                        {/* Aurora gradient background */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute -top-10 left-1/4 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl" />
                            <div className="absolute top-10 right-1/4 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl" />
                            <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
                        </div>

                        <div className="relative max-w-5xl mx-auto space-y-8">
                            {/* Header */}
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                                        智能去水印
                                    </h1>
                                    <p className="text-slate-400 mt-2">
                                        使用 AI 智能去除图片上的水印、文字、logo
                                    </p>
                                </div>
                                <Badge variant="outline" className="w-fit bg-amber-500/10 text-amber-400 border-amber-500/30 px-3 py-1.5">
                                    <span className="text-lg font-bold">{costs.WATERMARK_REMOVE_COST}</span>
                                    <span className="ml-1">积分/张</span>
                                </Badge>
                            </div>

                            {/* Upload Zone */}
                            <div className="glass rounded-2xl p-6">
                                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Upload className="w-5 h-5 text-blue-400" />
                                    上传图片
                                </h2>

                                {/* Dropzone */}
                                <div
                                    {...getRootProps()}
                                    className={`
                            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                            transition-all duration-200
                            ${isDragActive
                                            ? "border-blue-400 bg-blue-500/10"
                                            : "border-white/10 hover:border-white/30 hover:bg-white/5"}
                        `}
                                >
                                    <input {...getInputProps()} />
                                    <ImageIcon className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                                    {isDragActive ? (
                                        <p className="text-blue-400">放开以添加图片...</p>
                                    ) : (
                                        <div>
                                            <p className="text-slate-300">拖拽图片到这里，或点击选择</p>
                                            <p className="text-slate-500 text-sm mt-1">支持 PNG、JPG、JPEG、WebP</p>
                                        </div>
                                    )}
                                </div>

                                {/* Selected Images Preview */}
                                {selectedImages.length > 0 && (
                                    <div className="mt-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm text-slate-400">
                                                已选择 {selectedImages.length} 张图片
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                onClick={clearImages}
                                            >
                                                <Trash2 className="w-4 h-4 mr-1" />
                                                清空
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                            {selectedImages.map((img, index) => (
                                                <div key={index} className="relative group">
                                                    <img
                                                        src={img.previewUrl}
                                                        alt={`Preview ${index + 1}`}
                                                        className="w-full aspect-square object-cover rounded-lg border border-white/10"
                                                    />
                                                    <button
                                                        onClick={() => removeImage(index)}
                                                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <div className="mt-6 flex justify-center">
                                    <Button
                                        size="lg"
                                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8"
                                        onClick={handleSubmit}
                                        disabled={selectedImages.length === 0 || isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                {uploadProgress || "处理中..."}
                                            </>
                                        ) : selectedImages.length > 0 ? (
                                            <>
                                                <Upload className="w-5 h-5 mr-2" />
                                                开始去水印 ({selectedImages.length * costs.WATERMARK_REMOVE_COST} 积分)
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-5 h-5 mr-2" />
                                                开始去水印
                                            </>
                                        )}
                                    </Button>

                                </div>
                            </div>

                            {/* History Section */}
                            <div className="glass rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-purple-400" />
                                        历史记录
                                    </h2>
                                    <span className="text-sm text-amber-400/80 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        结果仅保留1小时
                                    </span>
                                </div>

                                {tasks.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>暂无记录</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="text-left text-sm text-slate-400 border-b border-white/5">
                                                    <th className="pb-3 font-medium">原图</th>
                                                    <th className="pb-3 font-medium">时间</th>
                                                    <th className="pb-3 font-medium">状态</th>
                                                    <th className="pb-3 font-medium">结果</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {tasks.map((task) => (
                                                    <tr key={task.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="py-4">
                                                            <img
                                                                src={task.originalUrl}
                                                                alt="Original"
                                                                className="w-16 h-16 object-cover rounded-lg border border-white/10"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect fill='%23374151' width='64' height='64'/%3E%3Ctext fill='%239CA3AF' x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='10'%3E加载失败%3C/text%3E%3C/svg%3E"
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="py-4 text-sm text-slate-400">
                                                            {formatDistanceToNow(new Date(task.createdAt), {
                                                                addSuffix: true,
                                                                locale: zhCN
                                                            })}
                                                        </td>
                                                        <td className="py-4">
                                                            <StatusBadge task={task} />
                                                        </td>
                                                        <td className="py-4">
                                                            <ResultAction task={task} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
