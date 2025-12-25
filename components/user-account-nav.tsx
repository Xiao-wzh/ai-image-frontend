"use client"

import { signOut } from "next-auth/react"
import { motion } from "framer-motion"
import { User, History, Settings, LogOut } from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface UserAccountNavProps {
  user: {
    name?: string | null
    email?: string | null
    username?: string | null
    image?: string | null
  }
}

export function UserAccountNav({ user }: UserAccountNavProps) {
  // 获取头像 fallback 文字（用户名首字母或邮箱前两位）
  const getFallbackText = () => {
    if (user.username) {
      return user.username.slice(0, 2).toUpperCase()
    }
    if (user.name) {
      return user.name.slice(0, 2).toUpperCase()
    }
    if (user.email) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return "U"
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative h-10 w-10 rounded-full ring-2 ring-white/10 hover:ring-purple-500/50 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
              {getFallbackText()}
            </AvatarFallback>
          </Avatar>
        </motion.button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* User Info */}
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold text-white">
              {user.username || user.name || "用户"}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Menu Items */}
        <Link href="/history">
          <DropdownMenuItem>
            <History className="mr-2 h-4 w-4" />
            <span>我的作品</span>
          </DropdownMenuItem>
        </Link>

        <Link href="/settings">
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>账号设置</span>
          </DropdownMenuItem>
        </Link>

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem
          className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
          onClick={() => signOut({ redirect: false })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

