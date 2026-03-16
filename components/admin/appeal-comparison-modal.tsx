"use client"

import { useState } from "react"
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type Appeal = {
    id: string
    reason: string
    appealedImages: string[]
    generation: {
        productName: string
        productType: string
        qualityMode?: string | null
        generatedImages: string[]
        originalImage: string[]
    }
}

export function AppealComparisonModal({
    open,
    onOpenChange,
    appeal,
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    appeal: Appeal | null
}) {
    const [selectedImageIndex, setSelectedImageIndex] = useState(0)
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    if (!appeal) return null

    const generatedImages = appeal.generation.generatedImages || []
    const originalImages = appeal.generation.originalImage || []
    const appealedImages = appeal.appealedImages || []

    const currentGenImage = generatedImages[selectedImageIndex]
    const isAppealedImage = currentGenImage && appealedImages.includes(currentGenImage)

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
