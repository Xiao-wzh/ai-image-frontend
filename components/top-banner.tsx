"use client"

import { useAnnouncementModal } from "@/hooks/use-announcement-modal"
import { Megaphone } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export function TopBanner() {
    const { pinnedBanner } = useAnnouncementModal()

    if (!pinnedBanner) return null

    // Clean text
    const displayText = pinnedBanner.content
        .replace(/[#*`]/g, '')
        .replace(/\n/g, ' ')

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full flex justify-center px-4 pt-4 mb-2 shrink-0 z-40"
            >
                {/* The Capsule Container */}
                <div className="
                    relative flex items-center gap-3 
                    max-w-3xl w-full h-10 px-4 py-1
                    rounded-full 
                    bg-slate-900/60 backdrop-blur-md 
                    border border-white/10 
                    shadow-[0_0_15px_-3px_rgba(79,70,229,0.2)]
                    overflow-hidden group
                ">
                    {/* Background Gradient Mesh */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5 pointer-events-none" />

                    {/* Icon Area */}
                    <div className="flex items-center gap-2 shrink-0 z-10 border-r border-white/10 pr-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500 blur-[8px] opacity-40 animate-pulse" />
                            <Megaphone className="w-4 h-4 text-blue-400 relative" />
                        </div>
                        <span className="text-xs font-bold text-blue-100/80 tracking-wide uppercase hidden sm:block">
                            公告
                        </span>
                    </div>

                    {/* Scrolling Content */}
                    <div className="flex-1 overflow-hidden relative h-full flex items-center mask-image-gradient-wide">
                        <div className="animate-marquee whitespace-nowrap text-sm text-slate-200 font-medium flex items-center">
                            <span className="font-bold mr-2 text-purple-300">[{pinnedBanner.title}]</span>
                            <span className="opacity-90">{displayText}</span>

                            {/* Duplicate for seamless loop */}
                            <span className="mx-12 opacity-20">///</span>

                            <span className="font-bold mr-2 text-purple-300">[{pinnedBanner.title}]</span>
                            <span className="opacity-90">{displayText}</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
