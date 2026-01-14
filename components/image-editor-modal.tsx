"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { X, Pencil, Download, Loader2, Sparkles, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { downloadImage } from "@/lib/utils"
import { useCosts } from "@/hooks/use-costs"

type EditorMode = "VIEW" | "EDIT"

interface ImageEditorModalProps {
    imageUrl: string
    productName?: string
    onClose: () => void
    onEdit: (prompt: string) => void // Delegate generation to parent
}

export function ImageEditorModal({
    imageUrl,
    productName = "edited-image",
    onClose,
    onEdit,
}: ImageEditorModalProps) {
    const { costs } = useCosts()
    const [mode, setMode] = useState<EditorMode>("VIEW")
    const [prompt, setPrompt] = useState("")


    // Handle save/download current image
    const handleSaveImage = () => {
        downloadImage(imageUrl, productName)
    }

    // Handle generate - delegate to parent
    const handleGenerate = () => {
        if (!prompt.trim()) {
            toast.error("请输入修改提示词")
            return
        }
        // Close modal and delegate to parent
        onEdit(prompt.trim())
    }

    if (typeof document === "undefined") return null

    return createPortal(
        <div
            className="fixed inset-0 z-[60] flex flex-col bg-black/95"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose()
                }
            }}
        >
            {/* Close button - floating top right */}
            <button
                onClick={onClose}
                className="absolute top-3 right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-colors"
            >
                <X className="w-5 h-5" />
            </button>

            {/* Main content area - image fills most space */}
            <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
                <AnimatePresence mode="wait">
                    {/* VIEW Mode */}
                    {mode === "VIEW" && (
                        <motion.div
                            key="view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full flex items-center justify-center"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={imageUrl}
                                alt="Preview"
                                className="max-w-full max-h-full object-contain"
                            />
                        </motion.div>
                    )}

                    {/* EDIT Mode */}
                    {mode === "EDIT" && (
                        <motion.div
                            key="edit"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full flex flex-col items-center justify-center gap-4 px-4"
                        >
                            {/* Image preview - smaller in edit mode */}
                            <div className="flex-1 flex items-center justify-center min-h-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={imageUrl}
                                    alt="Edit base"
                                    className="max-w-full max-h-full object-contain rounded-lg"
                                />
                            </div>

                            {/* Prompt input */}
                            <div className="w-full max-w-lg space-y-3 pb-2">
                                <Textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="输入修改提示词，例如：换成蓝色背景..."
                                    rows={2}
                                    className="w-full bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-purple-500/50 resize-none text-sm"
                                />
                                <Button
                                    onClick={handleGenerate}
                                    disabled={!prompt.trim()}
                                    className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg shadow-purple-500/30 disabled:opacity-50"
                                >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    立即修改（附带画质超清处理）
                                    <span className="ml-2 text-xs opacity-80">消耗 {costs.IMAGE_EDIT_COST} 积分</span>
                                </Button>

                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom toolbar - compact icon buttons */}
            <AnimatePresence mode="wait">
                {/* VIEW Mode Toolbar */}
                {mode === "VIEW" && (
                    <motion.div
                        key="view-toolbar"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="flex items-center justify-center gap-1 py-3 px-4 bg-black/60 backdrop-blur-sm"
                    >
                        <ToolbarButton icon={<Pencil className="w-4 h-4" />} label="编辑图片" onClick={() => setMode("EDIT")} />
                        <ToolbarButton icon={<Download className="w-4 h-4" />} label="保存" onClick={handleSaveImage} />
                        <ToolbarButton icon={<X className="w-4 h-4" />} label="关闭" onClick={onClose} />
                    </motion.div>
                )}

                {/* EDIT Mode Toolbar */}
                {mode === "EDIT" && (
                    <motion.div
                        key="edit-toolbar"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="flex items-center justify-center gap-1 py-3 px-4 bg-black/60 backdrop-blur-sm"
                    >
                        <ToolbarButton icon={<ArrowLeft className="w-4 h-4" />} label="返回" onClick={() => setMode("VIEW")} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>,
        document.body
    )
}

// Compact toolbar button component
function ToolbarButton({
    icon,
    label,
    onClick,
}: {
    icon: React.ReactNode
    label: string
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white min-w-[60px]"
        >
            {icon}
            <span className="text-[10px]">{label}</span>
        </button>
    )
}
