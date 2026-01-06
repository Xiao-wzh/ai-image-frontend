"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { Gift, Check, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { DAILY_CHECKIN_REWARD } from "@/lib/constants"

type CheckInStatus = {
    canCheckIn: boolean
    lastCheckIn: string | null
    nextCheckIn: string | null
}

export function DailyCheckin() {
    const { data: session, update: updateSession } = useSession()
    const [status, setStatus] = useState<CheckInStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [claiming, setClaiming] = useState(false)
    const [showReward, setShowReward] = useState(false)
    const [showConfetti, setShowConfetti] = useState(false)

    // Fetch check-in status
    const fetchStatus = useCallback(async () => {
        // Skip if not logged in
        if (!session?.user) {
            setLoading(false)
            return
        }

        try {
            const res = await fetch("/api/user/daily-checkin")
            if (res.ok) {
                const data = await res.json()
                console.log("Daily checkin status:", data) // Debug log
                setStatus(data)
            } else {
                console.error("Daily checkin API error:", res.status)
            }
        } catch (err) {
            console.error("获取打卡状态失败:", err)
        } finally {
            setLoading(false)
        }
    }, [session?.user])

    useEffect(() => {
        fetchStatus()
    }, [fetchStatus])

    const handleCheckIn = async () => {
        if (!status?.canCheckIn || claiming) return

        setClaiming(true)
        try {
            const res = await fetch("/api/user/daily-checkin", {
                method: "POST",
            })
            const data = await res.json()

            if (res.ok) {
                // Show reward animation
                setShowReward(true)
                setShowConfetti(true)

                // Update status
                setStatus({ ...status, canCheckIn: false })

                // Refresh session to update credits in sidebar
                await updateSession()

                toast.success("打卡成功！", {
                    description: `${DAILY_CHECKIN_REWARD} 积分已到账`,
                })

                // Hide animations after delay
                setTimeout(() => {
                    setShowReward(false)
                    setShowConfetti(false)
                }, 2000)
            } else {
                toast.error(data.error || "打卡失败")
            }
        } catch (err) {
            toast.error("打卡失败，请稍后重试")
        } finally {
            setClaiming(false)
        }
    }

    if (loading) {
        return (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg bg-white/10" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-16 bg-white/10" />
                        <Skeleton className="h-4 w-12 bg-white/10" />
                    </div>
                    <Skeleton className="h-8 w-16 rounded-lg bg-white/10" />
                </div>
            </div>
        )
    }

    const canCheckIn = status?.canCheckIn ?? false

    return (
        <div className="relative">
            {/* Confetti Effect */}
            <AnimatePresence>
                {showConfetti && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl"
                    >
                        {[...Array(12)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{
                                    opacity: 1,
                                    scale: 0,
                                    x: "50%",
                                    y: "50%",
                                }}
                                animate={{
                                    opacity: 0,
                                    scale: 1,
                                    x: `${Math.random() * 100}%`,
                                    y: `${Math.random() * 100}%`,
                                }}
                                transition={{
                                    duration: 0.8,
                                    delay: i * 0.05,
                                    ease: "easeOut",
                                }}
                                className={cn(
                                    "absolute w-2 h-2 rounded-full",
                                    i % 3 === 0 && "bg-yellow-400",
                                    i % 3 === 1 && "bg-orange-400",
                                    i % 3 === 2 && "bg-amber-300"
                                )}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Card */}
            <motion.div
                className={cn(
                    "relative p-3 rounded-xl border transition-all duration-300",
                    canCheckIn
                        ? "bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30"
                        : "bg-white/5 border-white/10"
                )}
                whileHover={canCheckIn ? { scale: 1.02 } : {}}
                whileTap={canCheckIn ? { scale: 0.98 } : {}}
            >
                <div className="flex items-center gap-3">
                    {/* Icon */}
                    <motion.div
                        className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            canCheckIn
                                ? "bg-gradient-to-br from-yellow-400 to-orange-500"
                                : "bg-white/10"
                        )}
                        animate={
                            canCheckIn
                                ? {
                                    rotate: [0, -10, 10, -10, 10, 0],
                                    scale: [1, 1.1, 1],
                                }
                                : {}
                        }
                        transition={{
                            duration: 0.5,
                            repeat: canCheckIn ? Infinity : 0,
                            repeatDelay: 3,
                        }}
                    >
                        {canCheckIn ? (
                            <Gift className="w-5 h-5 text-white" />
                        ) : (
                            <Check className="w-5 h-5 text-slate-400" />
                        )}
                    </motion.div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                        <div
                            className={cn(
                                "text-xs font-medium",
                                canCheckIn ? "text-yellow-300" : "text-slate-500"
                            )}
                        >
                            每日补给
                        </div>
                        <div
                            className={cn(
                                "text-lg font-bold",
                                canCheckIn ? "text-white" : "text-slate-400"
                            )}
                        >
                            {canCheckIn ? `+${DAILY_CHECKIN_REWARD}` : "已领取"}
                        </div>
                    </div>

                    {/* Button */}
                    <Button
                        onClick={handleCheckIn}
                        disabled={!canCheckIn || claiming}
                        size="sm"
                        className={cn(
                            "relative overflow-hidden transition-all",
                            canCheckIn
                                ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white shadow-lg shadow-orange-500/25"
                                : "bg-white/10 text-slate-500 cursor-not-allowed"
                        )}
                    >
                        {claiming ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : canCheckIn ? (
                            <>
                                <Sparkles className="w-3.5 h-3.5 mr-1" />
                                领取
                            </>
                        ) : (
                            "已领"
                        )}
                    </Button>
                </div>

                {/* Floating +400 Animation */}
                <AnimatePresence>
                    {showReward && (
                        <motion.div
                            initial={{ opacity: 1, y: 0, scale: 1 }}
                            animate={{ opacity: 0, y: -40, scale: 1.5 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="absolute left-1/2 top-0 -translate-x-1/2 pointer-events-none"
                        >
                            <span className="text-2xl font-bold text-yellow-400 drop-shadow-lg">
                                +{DAILY_CHECKIN_REWARD}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}
