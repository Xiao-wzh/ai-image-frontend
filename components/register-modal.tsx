"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import { Mail, User, Lock, Key, ArrowRight, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface RegisterModalProps {
  isOpen: boolean
  onClose: () => void
  initialInviteCode?: string
  inviteType?: "user" | "agent"
  inviteSig?: string
}

export function RegisterModal({ isOpen, onClose, initialInviteCode = "", inviteType = "user", inviteSig = "" }: RegisterModalProps) {
  // 有邀请码时默认打开注册页，否则打开登录页
  const defaultTab = initialInviteCode ? "register" : "login"
  // Register Form State
  const [regEmail, setRegEmail] = useState("")
  const [regUsername, setRegUsername] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regCode, setRegCode] = useState("")
  const [regInviteCode, setRegInviteCode] = useState(initialInviteCode)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [isRegistering, setIsRegistering] = useState(false)

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Countdown Timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 获取或生成设备ID（用于限流）
  const getDeviceId = (): string => {
    if (typeof window === "undefined") return ""
    let deviceId = localStorage.getItem("device_id")
    if (!deviceId) {
      // 兼容性生成UUID（不依赖 crypto.randomUUID）
      deviceId = "dev_" + "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === "x" ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
      localStorage.setItem("device_id", deviceId)
    }
    return deviceId
  }

  // Send Verification Code
  const handleSendCode = async () => {
    if (!regEmail.trim()) {
      toast.error("请输入邮箱地址")
      return
    }

    try {
      setIsSendingCode(true)
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "发送失败")
      }

      toast.success("验证码已发送，请查收邮箱")
      setCountdown(60)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSendingCode(false)
    }
  }

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    // 前端验证
    if (!regEmail.trim()) {
      toast.error("请输入邮箱地址")
      return
    }
    if (!regCode.trim()) {
      toast.error("请输入验证码")
      return
    }
    if (!regUsername.trim()) {
      toast.error("请输入用户名")
      return
    }
    if (!regPassword.trim()) {
      toast.error("请输入密码")
      return
    }

    try {
      setIsRegistering(true)
      const deviceId = getDeviceId()
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail.trim(),
          username: regUsername.trim(),
          password: regPassword,
          code: regCode.trim(),
          inviteCode: regInviteCode.trim() || undefined,
          inviteType: inviteType,
          inviteSig: inviteSig, // 传递签名用于服务端验证
          deviceId,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "注册失败")
      }

      toast.success("注册成功！正在为您自动登录...")

      // Auto sign-in after successful registration
      const signInRes = await signIn("credentials", {
        identifier: regEmail.trim(),
        password: regPassword,
        redirect: false,
      })

      if (signInRes?.error) {
        toast.error("自动登录失败，请手动登录")
      } else {
        toast.success("登录成功")
        onClose()
        // 重置表单
        setRegEmail("")
        setRegUsername("")
        setRegPassword("")
        setRegCode("")
        setRegInviteCode("")
      }
    } catch (error: any) {
      console.error("注册错误:", error)
      toast.error(error.message || "注册失败，请重试")
    } finally {
      setIsRegistering(false)
    }
  }

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!loginIdentifier.trim()) {
      toast.error("请输入邮箱或用户名")
      return
    }

    if (!loginPassword.trim()) {
      toast.error("请输入密码")
      return
    }

    try {
      setIsLoggingIn(true)
      const res = await signIn("credentials", {
        identifier: loginIdentifier.trim(),
        password: loginPassword,
        redirect: false,
      })

      if (res?.error) {
        // 处理不同的错误信息
        if (res.error === "CredentialsSignin") {
          toast.error("邮箱/用户名或密码错误")
        } else if (res.error.includes("用户不存在")) {
          toast.error("用户不存在")
        } else if (res.error.includes("密码错误")) {
          toast.error("密码错误")
        } else {
          toast.error(res.error)
        }
      } else {
        toast.success("登录成功")
        onClose()
        // 重置表单
        setLoginIdentifier("")
        setLoginPassword("")
      }
    } catch (error: any) {
      console.error("登录错误:", error)
      toast.error("登录失败，请重试")
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-white/10 bg-slate-900/95 backdrop-blur-xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-2xl font-bold gradient-text">
            欢迎来到 Sexyspecies
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            登录或注册以开始您的 AI 创作之旅
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-0">
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <motion.form
                onSubmit={handleLogin}
                className="space-y-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Email or Username */}
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="邮箱或用户名"
                    className="w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                {/* Password */}
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="密码"
                    className="w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white font-semibold shadow-lg shadow-purple-500/50 transition-all group"
                >
                  {isLoggingIn ? "登录中..." : "登录"}
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <motion.form
                onSubmit={handleRegister}
                className="space-y-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Email */}
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="邮箱地址"
                    className="w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                {/* Verification Code */}
                <div className="flex gap-2">
                  <div className="relative flex-grow">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
                    <input
                      type="text"
                      value={regCode}
                      onChange={(e) => setRegCode(e.target.value)}
                      placeholder="6位验证码"
                      maxLength={6}
                      className="w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleSendCode}
                    disabled={isSendingCode || countdown > 0}
                    className="h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all whitespace-nowrap"
                  >
                    {countdown > 0 ? `${countdown}s` : "发送验证码"}
                  </Button>
                </div>
                {/* Username */}
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="用户名 (6-12个字符，只能包含字母、数字)"
                    className="w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                {/* Password */}
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="密码 (至少6位)"
                    className="w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                {/* Invite Code (Optional) */}
                <div className="relative">
                  <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
                  <input
                    type="text"
                    value={regInviteCode}
                    onChange={(e) => setRegInviteCode(e.target.value.toUpperCase())}
                    placeholder="邀请码 (可选)"
                    maxLength={8}
                    readOnly={!!initialInviteCode}
                    className={`w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-yellow-500 focus:bg-white/10 focus:ring-2 focus:ring-yellow-500/20 transition-all uppercase ${initialInviteCode ? 'cursor-not-allowed opacity-70' : ''}`}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white font-semibold shadow-lg shadow-purple-500/50 transition-all group"
                >
                  {isRegistering ? "注册中..." : "注册并登录"}
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}

