"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import { Sparkles, User, Plus, Images, Wallet, ListTodo, ShieldCheck, LogOut, Gift, LayoutGrid, Settings, Droplets, Megaphone, Crown, Eraser, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "./ui/button"
import { PricingModal } from "./pricing-modal"
import { DailyCheckin } from "./daily-checkin"
import { useLoginModal } from "@/hooks/use-login-modal"

type NavItem = {
  icon: any
  label: string
  href: string
  badge?: "pending" // Special badge type
}

const navItems: NavItem[] = [
  { icon: Sparkles, label: "AI 生图", href: "/" },
  { icon: Droplets, label: "水印模板", href: "/settings/watermark" },
  { icon: Eraser, label: "智能去水印", href: "/watermark" },
  { icon: Images, label: "我的作品", href: "/history" },
  { icon: ListTodo, label: "任务队列", href: "/tasks", badge: "pending" },
  { icon: Wallet, label: "积分流水", href: "/credits" },
  { icon: ShieldCheck, label: "售后记录", href: "/appeals" },
  { icon: Gift, label: "邀请赚积分", href: "/referral" },

]

// 管理员专属导航
const adminItems: NavItem[] = [
  { icon: BarChart3, label: "收入仪表盘", href: "/admin/dashboard" },
  { icon: LayoutGrid, label: "生成记录管理", href: "/admin/generations" },
  { icon: ShieldCheck, label: "售后审核", href: "/admin/appeals" },
  { icon: Settings, label: "提示词管理", href: "/admin/prompts" },
  { icon: Megaphone, label: "公告管理", href: "/admin/announcements" },
]

export function Sidebar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)
  const loginModal = useLoginModal()
  const [pendingCount, setPendingCount] = useState(0)

  // Fetch pending task count
  useEffect(() => {
    if (!session?.user) return

    let cancelled = false

    const fetchPendingCount = async () => {
      try {
        const res = await fetch("/api/history?limit=50&offset=0")
        if (!res.ok) return
        const data = await res.json()
        const items = data.items || []
        const count = items.filter((x: any) => {
          const s = String(x.status || "").toUpperCase()
          return s === "PENDING" || s === "PROCESSING"
        }).length
        if (!cancelled) setPendingCount(count)
      } catch {
        // ignore
      }
    }

    fetchPendingCount()

    // Poll every 5 seconds if there are pending tasks
    const interval = setInterval(fetchPendingCount, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [session?.user])

  // 获取头像 fallback 文字
  const getFallbackText = () => {
    if (session?.user?.username) {
      return session.user.username.slice(0, 2).toUpperCase()
    }
    if (session?.user?.name) {
      return session.user.name.slice(0, 2).toUpperCase()
    }
    if (session?.user?.email) {
      return session.user.email.slice(0, 2).toUpperCase()
    }
    return "U"
  }

  return (
    <>
      <aside className="w-[240px] bg-slate-900/50 backdrop-blur-xl border-r border-white/5 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg glow-blue">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              AI Species
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href))

            const showBadge = item.badge === "pending" && pendingCount > 0

            return (
              <button
                key={item.label}
                onClick={() => router.push(item.href)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium relative",
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg glow-blue"
                    : "text-slate-400 hover:text-white hover:bg-white/5",
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
                {showBadge && (
                  <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </button>
            )
          })}

          {/* 合伙人中心 - 仅 agentLevel > 0 可见 */}
          {session?.user?.agentLevel && session.user.agentLevel > 0 && (() => {
            const isActive = pathname === "/agent" || pathname?.startsWith("/agent")
            return (
              <button
                onClick={() => router.push("/agent")}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                  isActive
                    ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg"
                    : "text-yellow-400/80 hover:text-yellow-300 hover:bg-white/5",
                )}
              >
                <Crown className="w-4 h-4" />
                <span>合伙人中心</span>
              </button>
            )
          })()}

          {/* 管理员菜单 */}
          {session?.user?.role === "ADMIN" && (
            <>
              <div className="my-3 border-t border-white/10" />
              <div className="text-xs text-slate-500 px-4 py-1 font-medium">管理员</div>
              {adminItems.map((item) => {
                const isActive = pathname?.startsWith(item.href)
                return (
                  <button
                    key={item.label}
                    onClick={() => router.push(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                      isActive
                        ? "bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg"
                        : "text-orange-400/70 hover:text-orange-300 hover:bg-white/5",
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </>
          )}
        </nav>

        {/* 每日签到按钮组件 */}
        {/* Daily Check-in */}
        {/* <div className="px-4 mt-auto">
          <div className="border-t border-white/5 pt-4">
            <DailyCheckin />
          </div>
        </div> */}

        {/* User Info */}
        <div className="p-4 border-t border-white/5">
          <div className="glass rounded-xl p-4">
            {status === "loading" ? (
              /* Loading State */
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-20 bg-white/10" />
                    <Skeleton className="h-3 w-16 bg-white/10" />
                  </div>
                </div>
                <Skeleton className="h-8 w-full bg-white/10" />
              </div>
            ) : session?.user ? (
              /* Logged In State */
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="w-10 h-10 ring-2 ring-white/10">
                    <AvatarImage src={session.user.image || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-semibold">
                      {getFallbackText()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {session.user.username || session.user.name || "用户"}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{session.user.email}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-400">剩余积分</div>
                    <Button
                      onClick={() => setIsPricingModalOpen(true)}
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded-lg hover:bg-white/10 text-slate-400 hover:text-purple-400 transition-colors"
                      title="充值"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div
                    className="text-2xl font-bold gradient-text-alt"
                    title={`付费积分：${session.user.credits || 0}\n赠送积分：${session.user.bonusCredits || 0}`}
                  >
                    {(session.user.credits || 0) + (session.user.bonusCredits || 0)}
                  </div>
                </div>
                <Button
                  onClick={() => {
                    import("next-auth/react").then(({ signOut }) => signOut())
                  }}
                  variant="ghost"
                  size="sm"
                  className="w-full mt-3 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  退出登录
                </Button>
              </>
            ) : (
              /* Not Logged In State */
              <div className="text-center py-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-sm text-slate-400 mb-3">未登录</div>
                <Button
                  onClick={() => loginModal.open()}
                  className="w-full text-xs bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                  size="sm"
                >
                  登录/注册
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Pricing Modal */}
      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
    </>
  )
}
