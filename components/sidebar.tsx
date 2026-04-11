"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import { usePathname, useRouter } from "next/navigation"
import { Sparkles, User, Plus, Images, Wallet, ListTodo, ShieldCheck, LogOut, Gift, LayoutGrid, Settings, Droplets, Megaphone, Crown, Eraser, BarChart3, FileText, Users, Receipt, Video, Zap, BookOpen, ExternalLink, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
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
  badge?: "pending" | "limited_free" | "new" // Special badge type
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "AI 创作",
    items: [
      { icon: Sparkles, label: "AI 生图", href: "/" },
      { icon: Copy, label: "AI 克隆图片", href: "/clone" },
      { icon: Video, label: "AI 视频", href: "/video/sora2", badge: "new" },
      { icon: FileText, label: "智能商品描述", href: "/copywriting" },
    ],
  },
  {
    label: "图片工具",
    items: [
      { icon: Droplets, label: "水印模板", href: "/settings/watermark" },
      { icon: Eraser, label: "智能去水印", href: "/watermark", badge: "limited_free" },
    ],
  },
  {
    label: "我的",
    items: [
      { icon: Images, label: "我的作品", href: "/history" },
      { icon: ListTodo, label: "任务队列", href: "/tasks", badge: "pending" },
    ],
  },
  {
    label: "账户",
    items: [
      { icon: Wallet, label: "积分流水", href: "/credits" },
      { icon: Receipt, label: "充值记录", href: "/orders" },
      { icon: ShieldCheck, label: "售后记录", href: "/appeals" },
      { icon: Gift, label: "邀请赚积分", href: "/referral" },
    ],
  },
]


// 管理员专属导航
const adminItems: NavItem[] = [
  { icon: BarChart3, label: "收入仪表盘", href: "/admin/dashboard" },
  { icon: Receipt, label: "订单管理", href: "/admin/orders" },
  { icon: Users, label: "用户管理", href: "/admin/users" },
  { icon: LayoutGrid, label: "生成记录管理", href: "/admin/generations" },
  { icon: ShieldCheck, label: "售后审核", href: "/admin/appeals" },
  { icon: Settings, label: "提示词管理", href: "/admin/prompts" },
  { icon: Megaphone, label: "公告管理", href: "/admin/announcements" },
  { icon: Crown, label: "价格设置", href: "/admin/settings" },
  { icon: Zap, label: "拉新活动", href: "/admin/activity" },
]

// 财务员专属导航（仅订单管理）
const financeItems: NavItem[] = [
  { icon: Receipt, label: "订单管理", href: "/admin/orders" },
]

// 审核员专属导航（售后审核 + 生成记录管理 + 用户管理）
const reviewerItems: NavItem[] = [
  { icon: LayoutGrid, label: "生成记录管理", href: "/admin/generations" },
  { icon: Users, label: "用户管理", href: "/admin/users" },
  { icon: ShieldCheck, label: "售后审核", href: "/admin/appeals" },
]


export function Sidebar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)
  const loginModal = useLoginModal()

  // 视频任务 sync 节流：避免并发调用
  const syncingRef = useRef(false)
  const notifiedIdsRef = useRef<Set<string>>(new Set())

  // 用 SWR 轮询轻量级 pending-count 接口（纯计数）
  const { data: pendingData } = useSWR(
    session?.user ? "/api/tasks/pending-count" : null,
    (url: string) => fetch(url).then((r) => r.json()),
    {
      // 有任务 10 秒，没任务 30 秒
      refreshInterval: (data) => {
        const count = data?.count ?? 0
        return count > 0 ? 10000 : 30000
      },
      revalidateOnFocus: true,
      dedupingInterval: 8000,
      // 每次 SWR 拿到新数据后，如果有进行中视频任务 → 调 sync
      onSuccess: async (data) => {
        if ((data?.pendingVideoCount ?? 0) <= 0) return
        if (syncingRef.current) return
        syncingRef.current = true
        try {
          const res = await fetch("/api/video/sora2/sync", { method: "POST" })
          if (!res.ok) return
          const syncData = await res.json()

          // sync 返回刚完成的任务 → 弹 toast
          for (const item of (syncData.completed ?? []) as { id: string; prompt: string }[]) {
            if (notifiedIdsRef.current.has(item.id)) continue
            notifiedIdsRef.current.add(item.id)
            const shortPrompt = item.prompt.length > 30
              ? item.prompt.slice(0, 30) + "..."
              : item.prompt
            toast.success("视频生成完成", {
              description: shortPrompt,
              action: {
                label: "查看",
                onClick: () => router.push("/video/sora2"),
              },
              duration: 8000,
            })
          }
        } catch {
          // 静默失败
        } finally {
          syncingRef.current = false
        }
      },
    }
  )
  const pendingCount = pendingData?.count ?? 0
  const pendingVideoCount = pendingData?.pendingVideoCount ?? 0

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
      <aside className="w-[240px] h-full bg-slate-900/50 backdrop-blur-xl border-r border-white/5 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg glow-blue">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              AI Species
            </span>
          </div>
        </div>

        {/* Navigation - scrollable */}
        <nav className="flex-1 px-4 py-2 overflow-y-auto">
          {navGroups.map((group, gi) => (
            <div key={group.label}>
              {/* 分组标题 */}
              <div className="text-[11px] text-slate-500 px-4 py-2 font-medium tracking-wider">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  // 对于 "/" 和 "/clone" 需要精确匹配，其他路径使用 startsWith
                  const isActive =
                    item.href === "/" || item.href === "/clone"
                      ? pathname === item.href
                      : pathname?.startsWith(item.href)

                  const showPendingBadge = item.badge === "pending" && pendingCount > 0
                  // "AI 视频" 入口有进行中任务时显示专属角标
                  const showVideoBadge = item.href === "/video/sora2" && pendingVideoCount > 0

                  return (
                    <button
                      key={item.label}
                      onClick={() => router.push(item.href)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium relative",
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg glow-blue"
                          : showVideoBadge
                            ? "text-violet-300 hover:text-white hover:bg-violet-500/10"
                            : "text-slate-400 hover:text-white hover:bg-white/5",
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="truncate">{item.label}</span>
                      {showVideoBadge && (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-violet-500/20 text-violet-300 px-2 py-0.5 text-[10px] font-semibold shrink-0 animate-pulse border border-violet-500/30">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          生成中
                        </span>
                      )}
                      {showPendingBadge && (
                        <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse shrink-0">
                          {pendingCount > 9 ? "9+" : pendingCount}
                        </span>
                      )}
                      {item.badge === "new" && (
                        <span className="ml-auto inline-flex items-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-2 py-0.5 text-[10px] font-semibold text-white shrink-0 animate-pulse">
                          NEW
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {/* 分组之间的分隔线（最后一组不加） */}
              {gi < navGroups.length - 1 && (
                <div className="my-2 mx-4 border-t border-white/5" />
              )}
            </div>
          ))}

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

          {/* 财务员菜单 */}
          {session?.user?.role === "FINANCE" && (
            <>
              <div className="my-3 border-t border-white/10" />
              <div className="text-xs text-slate-500 px-4 py-1 font-medium">财务</div>
              {financeItems.map((item) => {
                const isActive = pathname?.startsWith(item.href)
                return (
                  <button
                    key={item.label}
                    onClick={() => router.push(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg"
                        : "text-blue-400/70 hover:text-blue-300 hover:bg-white/5",
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </>
          )}

          {/* 审核员菜单 */}
          {session?.user?.role === "REVIEWER" && (
            <>
              <div className="my-3 border-t border-white/10" />
              <div className="text-xs text-slate-500 px-4 py-1 font-medium">审核</div>
              {reviewerItems.map((item) => {
                const isActive = pathname?.startsWith(item.href)
                return (
                  <button
                    key={item.label}
                    onClick={() => router.push(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                      isActive
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg"
                        : "text-emerald-400/70 hover:text-emerald-300 hover:bg-white/5",
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

        {/* 使用教程入口 */}
        <div className="px-4 py-2 border-t border-white/5">
          <a
            href="/guide"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium
              bg-gradient-to-r from-blue-600/20 to-cyan-600/20 text-blue-300 hover:from-blue-600/30 hover:to-cyan-600/30
              border border-blue-500/20 hover:border-blue-500/40 group cursor-pointer"
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">使用教程</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
          </a>
        </div>

        {/* User Info - fixed at bottom */}
        <div className="p-4 border-t border-white/5 flex-shrink-0">
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
