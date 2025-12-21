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
    <aside className="w-[184px] bg-[#1a1d2e] flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-base text-white">Sexyspecies</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm",
              item.active
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-200",
            )}
          >
            <item.icon className="w-4 h-4" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-white">演示用户</div>
            <div className="text-xs text-gray-500">普通版</div>
          </div>
        </div>
        <div className="text-xs text-gray-400 mb-2">剩余额度</div>
        <div className="text-lg font-semibold text-blue-500">635 点</div>
        <button className="mt-3 w-full text-xs text-gray-400 hover:text-gray-300 transition-colors flex items-center gap-1">
          <span>⚙️</span>
          <span>退出登录</span>
        </button>
      </div>
    </aside>
  )
}
