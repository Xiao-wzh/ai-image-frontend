"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"
import { Mail, Lock, Key, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export function ResetPasswordDialog({
  isOpen,
  onClose,
  email,
  setEmail,
  code,
  setCode,
  newPassword,
  setNewPassword,
  isSendingCode,
  setIsSendingCode,
  countdown,
  setCountdown,
  isResetting,
  setIsResetting,
  onResetSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  email: string
  setEmail: (v: string) => void
  code: string
  setCode: (v: string) => void
  newPassword: string
  setNewPassword: (v: string) => void
  isSendingCode: boolean
  setIsSendingCode: (v: boolean) => void
  countdown: number
  setCountdown: (v: number) => void
  isResetting: boolean
  setIsResetting: (v: boolean) => void
  onResetSuccess: (email: string) => void
}) {
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown, setCountdown])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md border-white/10 bg-slate-900/95 backdrop-blur-xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-bold text-white">重置密码</DialogTitle>
          <DialogDescription className="text-slate-400">输入邮箱获取验证码，并设置新密码</DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-0">
          <motion.form
            onSubmit={async (e) => {
              e.preventDefault()

              if (!email.trim()) {
                toast.error("请输入邮箱地址")
                return
              }
              if (!code.trim()) {
                toast.error("请输入验证码")
                return
              }
              if (!newPassword.trim()) {
                toast.error("请输入新密码")
                return
              }

              try {
                setIsResetting(true)
                const res = await fetch("/api/auth/reset-password/reset", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    email: email.trim(),
                    code: code.trim(),
                    newPassword,
                  }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) {
                  throw new Error(data?.error || "重置失败")
                }

                toast.success("密码重置成功，请使用新密码登录")
                onResetSuccess(email.trim())
                onClose()
              } catch (err: any) {
                toast.error(err?.message || "重置失败")
              } finally {
                setIsResetting(false)
              }
            }}
            className="space-y-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="邮箱地址"
                className="w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <div className="flex gap-2">
              <div className="relative flex-grow">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6位验证码"
                  maxLength={6}
                  className="w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <Button
                type="button"
                onClick={async () => {
                  if (!email.trim()) {
                    toast.error("请输入邮箱地址")
                    return
                  }
                  try {
                    setIsSendingCode(true)
                    const res = await fetch("/api/auth/reset-password/send-code", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email: email.trim() }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) {
                      throw new Error(data?.error || "发送失败")
                    }
                    toast.success("验证码已发送，请查收邮箱")
                    setCountdown(60)
                  } catch (err: any) {
                    toast.error(err?.message || "发送失败")
                  } finally {
                    setIsSendingCode(false)
                  }
                }}
                disabled={isSendingCode || countdown > 0}
                className="h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all whitespace-nowrap"
              >
                {countdown > 0 ? `${countdown}s` : "发送验证码"}
              </Button>
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="新密码（至少6位）"
                className="w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <Button
              type="submit"
              disabled={isResetting}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white font-semibold shadow-lg shadow-purple-500/50 transition-all group"
            >
              {isResetting ? "重置中..." : "确认重置"}
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

