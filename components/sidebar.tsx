"use client"

import { Sparkles, Upload, BarChart3, ShoppingCart, User } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { icon: Upload, label: "上传分发", active: false },
  { icon: Sparkles, label: "AI 生图", active: true },
  { icon: BarChart3, label: "套餐额度", active: false },
  { icon: ShoppingCart, label: "购买套餐", active: false },
]

export function Sidebar() {
  return (
    <aside className="w-[240px] bg-slate-900/50 backdrop-blur-xl border-r border-white/5 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg glow-blue">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Sexyspecies
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
              item.active
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg glow-blue"
                : "text-slate-400 hover:text-white hover:bg-white/5",
            )}
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-white/5">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">演示用户</div>
              <div className="text-xs text-slate-500">普通版</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-slate-400">剩余额度</div>
            <div className="text-2xl font-bold gradient-text-alt">635</div>
          </div>
          <button className="mt-4 w-full text-xs text-slate-400 hover:text-slate-300 transition-colors flex items-center justify-center gap-1 py-2">
            <span>⚙️</span>
            <span>退出登录</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
