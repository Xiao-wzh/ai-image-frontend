"use client"

import { useState } from "react"
import { X, ChevronLeft, ChevronRight, ZoomIn, Loader2, Sparkles, RefreshCw, Bot, AlertTriangle } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type Appeal = {
    id: string
    reason: string
    status: "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" | "PENDING_MANUAL_REVIEW"
    appealedImages: string[]
    // AI 审核相关字段
    aiConfidence: number | null
    aiAnalysis: string | null
    userMessage: string | null  // AI 给用户的简短提示
    generation: {
        productName: string
        productType: string
        mode: string  // CREATIVE / CLONE
        qualityMode?: string | null
        generatedImages: string[]
        originalImage: string[]
    }
}

export function AppealComparisonModal({
    open,
    onOpenChange,
    appeal,
    onTriggerAi,
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    appeal: Appeal | null
    onTriggerAi?: (appealId: string) => Promise<void>
}) {
    const [selectedImageIndex, setSelectedImageIndex] = useState(0)
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [triggeringAi, setTriggeringAi] = useState(false)

    if (!appeal) return null

    const generatedImages = appeal.generation.generatedImages || []
    const originalImages = appeal.generation.originalImage || []
    const appealedImages = appeal.appealedImages || []

    const currentGenImage = generatedImages[selectedImageIndex]
    const isAppealedImage = currentGenImage && appealedImages.includes(currentGenImage)

    // 判断是否为处理中状态
    const isProcessing = appeal.status === "PROCESSING"
    // 判断是否可以重新提交 AI 审核
    const canRetriggerAi = appeal.status === "PENDING" || appeal.status === "PENDING_MANUAL_REVIEW"

    // 触发 AI 重新审核
    const handleTriggerAi = async () => {
        if (!onTriggerAi || triggeringAi) return

        setTriggeringAi(true)
        try {
            await onTriggerAi(appeal.id)
            toast.success("已重新提交 AI 审核")
            onOpenChange(false)
        } catch (error: any) {
            toast.error(error.message || "提交失败")
        } finally {
            setTriggeringAi(false)
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0 bg-slate-950/95 border-white/10 overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 shrink-0 flex items-center justify-between">
                        <div>
                            <h2 className="text-white text-lg font-semibold">
                                申诉对比审核 - {appeal.generation.productName}
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">
                                {appeal.generation.qualityMode === "PRO" ? "PRO模式" : "标准模式"} • {appeal.generation.productType}
                                <span className="mx-2">•</span>
                                <span className={appeal.generation.mode === "CLONE" ? "text-blue-400" : "text-purple-400"}>
                                    {appeal.generation.mode === "CLONE" ? "克隆模式" : "创意模式"}
                                </span>
                            </p>
                        </div>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="text-slate-400 hover:text-white transition-colors p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {/* Image Comparison Grid */}
                        <div className="flex-1 flex gap-4 p-6 overflow-hidden">
                            {/* Left: Original Images */}
                            <div className="flex-1 flex flex-col gap-3 min-w-0">
                                <div className="text-sm font-medium text-slate-300">用户上传原图</div>
                                <div className="flex-1 bg-slate-900/40 rounded-xl border border-white/10 overflow-auto flex items-center justify-center p-4">
                                    {originalImages.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
                                            {originalImages.map((url, idx) => (
                                                <div
                                                    key={idx}
                                                    className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/40 hover:border-white/30 transition-colors cursor-pointer group relative"
                                                    onClick={() => setPreviewImage(url)}
                                                >
                                                    <img
                                                        src={url}
                                                        alt={`Original ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                        <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-slate-500 text-sm">无原图</div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Generated Images */}
                            <div className="flex-1 flex flex-col gap-3 min-w-0">
                                <div className="text-sm font-medium text-slate-300">
                                    生成结果
                                    {isAppealedImage && (
                                        <span className="ml-2 px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30">
                                            申诉中
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 bg-slate-900/40 rounded-xl border border-white/10 overflow-auto flex items-center justify-center p-4">
                                    {generatedImages.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
                                            {generatedImages.map((url, idx) => {
                                                const isAppealed = appealedImages.includes(url)
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`aspect-square rounded-lg overflow-hidden transition-all cursor-pointer group relative ${
                                                            isAppealed
                                                                ? "border-2 border-orange-500 ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/20"
                                                                : "border border-white/10 hover:border-white/30"
                                                        }`}
                                                        onClick={() => setPreviewImage(url)}
                                                    >
                                                        <img
                                                            src={url}
                                                            alt={`Generated ${idx + 1}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        {isAppealed && (
                                                            <div className="absolute inset-0 bg-orange-500/10 flex items-center justify-center">
                                                                <div className="text-xs font-bold text-orange-300 bg-black/60 px-2 py-1 rounded">
                                                                    申诉
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                            <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-slate-500 text-sm">无生成结果</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Navigation */}
                        {generatedImages.length > 0 && (
                            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-4 bg-slate-900/20">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedImageIndex(Math.max(0, selectedImageIndex - 1))}
                                    disabled={selectedImageIndex === 0}
                                    className="border-white/10 bg-white/5 hover:bg-white/10"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <div className="text-sm text-slate-400">
                                    {selectedImageIndex + 1} / {generatedImages.length}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedImageIndex(Math.min(generatedImages.length - 1, selectedImageIndex + 1))}
                                    disabled={selectedImageIndex === generatedImages.length - 1}
                                    className="border-white/10 bg-white/5 hover:bg-white/10"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        )}

                        {/* Appeal Reason */}
                        {appeal.reason && (
                            <div className="px-6 py-4 border-t border-white/10 bg-white/5">
                                <div className="text-xs font-medium text-slate-400 mb-2">申诉原因</div>
                                <div className="text-sm text-slate-300 leading-relaxed">{appeal.reason}</div>
                            </div>
                        )}

                        {/* AI 诊断报告 */}
                        {appeal.aiAnalysis && (
                            <div className="px-6 py-4 border-t border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                                <div className="flex items-center gap-2 mb-3">
                                    <Bot className="w-4 h-4 text-blue-400" />
                                    <span className="text-xs font-medium text-blue-400">AI 诊断报告</span>
                                    {appeal.aiConfidence !== null && (
                                        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                                            appeal.aiConfidence > 0.85
                                                ? "bg-green-500/20 text-green-400"
                                                : appeal.aiConfidence > 0.6
                                                    ? "bg-yellow-500/20 text-yellow-400"
                                                    : "bg-red-500/20 text-red-400"
                                        }`}>
                                            置信度 {Math.round(appeal.aiConfidence * 100)}%
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-300 leading-relaxed bg-black/20 rounded-lg p-3">
                                    {appeal.aiAnalysis}
                                </div>
                                {/* 给用户的提示 */}
                                {appeal.userMessage && (
                                    <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2 border border-emerald-500/20">
                                        <span className="font-medium">用户提示：</span>
                                        <span>{appeal.userMessage}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Processing Status Banner */}
                        {isProcessing && (
                            <div className="px-6 py-4 border-t border-white/10 bg-blue-500/10 flex items-center justify-center gap-3">
                                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                                <span className="text-sm text-blue-400">AI 正在审核中，请稍候...</span>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="px-6 py-4 border-t border-white/10 bg-slate-900/30 flex items-center justify-end gap-3">
                            {/* 重新提交 AI 审核 */}
                            {canRetriggerAi && onTriggerAi && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleTriggerAi}
                                    disabled={triggeringAi}
                                    className="border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"
                                >
                                    {triggeringAi ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                    )}
                                    重新提交 AI 审核
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Image Preview Modal */}
            <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
                <DialogContent className="max-w-4xl w-[90vw] bg-slate-950/95 border-white/10 p-0 overflow-hidden">
                    <div className="relative w-full h-[70vh] flex items-center justify-center bg-black">
                        {previewImage && (
                            <img
                                src={previewImage}
                                alt="Preview"
                                className="max-w-full max-h-full object-contain"
                            />
                        )}
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-4 right-4 text-white hover:text-slate-300 transition-colors p-1 bg-black/50 rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
