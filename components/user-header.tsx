"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Coins } from "lucide-react"

export function UserHeader() {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="px-6 lg:px-8 h-16 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">生成图像</h1>
          <p className="text-sm text-muted-foreground">创建令人惊叹的 AI 生成艺术作品</p>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="gap-2 px-3 py-1.5 bg-accent/10 text-accent border-accent/20">
            <Coins className="w-4 h-4" />
            <span className="font-semibold">250 积分</span>
          </Badge>

          <Avatar className="w-10 h-10 border-2 border-accent/30">
            <AvatarImage src="/abstract-geometric-shapes.png" alt="User" />
            <AvatarFallback className="bg-accent text-accent-foreground">AK</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
