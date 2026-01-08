"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Megaphone, Calendar } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Button } from "@/components/ui/button"

type Announcement = {
    id: string
    title: string
    content: string
    type: "PINNED" | "NORMAL"
    createdAt: string
}

const STORAGE_KEY = "system_announcement_closed_date"

function getTodayString(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
    ).padStart(2, "0")}`
}

/** Normalize Markdown: avoid extra blank lines from \r\n */
function normalizeMarkdown(md: string): string {
    return String(md ?? "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

type SystemAnnouncementModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function SystemAnnouncementModal({ open, onOpenChange }: SystemAnnouncementModalProps) {
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchAnnouncements = async () => {
            try {
                const res = await fetch("/api/announcements/active")
                if (!res.ok) throw new Error("Failed to fetch")
                const data = await res.json()
                setAnnouncements(data.announcements || [])
            } catch (error) {
                console.error("Failed to fetch announcements:", error)
            } finally {
                setLoading(false)
            }
        }

        if (open) {
            fetchAnnouncements()
        }
    }, [open])

    const handleClose = () => onOpenChange(false)

    const handleCloseForToday = () => {
        localStorage.setItem(STORAGE_KEY, getTodayString())
        onOpenChange(false)
    }

    if (!open || (loading && announcements.length === 0)) return null

    const pinnedAnnouncements = announcements.filter((a) => a.type === "PINNED")
    const normalAnnouncements = announcements.filter((a) => a.type === "NORMAL")

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={handleClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                                    <Megaphone className="w-4 h-4 text-white" />
                                </div>
                                <h2 className="text-white font-semibold text-lg">系统公告</h2>
                            </div>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="text-slate-400 hover:text-white hover:bg-white/10"
                                onClick={handleClose}
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Content */}
                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                            {loading ? (
                                <div className="text-center text-slate-400 py-8">加载中...</div>
                            ) : announcements.length === 0 ? (
                                <div className="text-center text-slate-400 py-8">暂无公告</div>
                            ) : (
                                <>
                                    {/* Pinned announcements */}
                                    {pinnedAnnouncements.length > 0 && (
                                        <div className="space-y-3">
                                            {pinnedAnnouncements.map((item) => {
                                                const md = normalizeMarkdown(item.content)
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="p-4 rounded-r-lg bg-amber-500/10 border-l-4 border-amber-500 mb-4"
                                                    >
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <span className="text-lg">📢</span>
                                                            <h3 className="text-amber-400 font-bold text-base">{item.title}</h3>
                                                        </div>

                                                        <div className="prose prose-invert prose-sm max-w-none prose-p:text-amber-200 prose-p:my-2 prose-headings:text-amber-400 prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2 prose-strong:text-amber-400 prose-ul:my-2 prose-ol:my-2 prose-li:text-amber-200 prose-li:my-1 prose-blockquote:border-l-2 prose-blockquote:border-amber-400 prose-blockquote:pl-4 prose-blockquote:text-amber-300 prose-blockquote:italic prose-code:bg-amber-500/30 prose-code:text-amber-200 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-hr:border-amber-500/40 prose-hr:my-4 prose-a:text-amber-300 prose-a:underline">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
                                                        </div>

                                                        <div className="mt-3 flex items-center gap-1 text-xs text-amber-400/70">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {/* Normal announcements */}
                                    {normalAnnouncements.length > 0 && (
                                        <div className="space-y-3">
                                            {normalAnnouncements.map((item) => {
                                                const md = normalizeMarkdown(item.content)
                                                return (
                                                    <div key={item.id} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                                        <h3 className="text-white font-bold text-base mb-3">{item.title}</h3>

                                                        <div className="prose prose-invert prose-sm max-w-none prose-p:text-slate-300 prose-p:my-2 prose-headings:text-white prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2 prose-strong:text-white prose-ul:my-2 prose-ol:my-2 prose-li:text-slate-300 prose-li:my-1 prose-blockquote:border-l-2 prose-blockquote:border-blue-400 prose-blockquote:pl-4 prose-blockquote:text-slate-400 prose-blockquote:italic prose-code:bg-slate-700 prose-code:text-slate-200 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-hr:border-slate-600 prose-hr:my-4 prose-a:text-blue-400 prose-a:underline">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
                                                        </div>

                                                        <div className="mt-3 flex items-center gap-1 text-xs text-slate-500">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/10 flex items-center justify-end gap-3">
                            <Button
                                variant="outline"
                                className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                                onClick={handleCloseForToday}
                            >
                                今日不再显示
                            </Button>
                            <Button
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                                onClick={handleClose}
                            >
                                关闭
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/** Export helper for checking if should auto-open */
export function shouldAutoOpenAnnouncement(): boolean {
    if (typeof window === "undefined") return false
    const closedDate = localStorage.getItem(STORAGE_KEY)
    const today = getTodayString()
    return closedDate !== today
}
