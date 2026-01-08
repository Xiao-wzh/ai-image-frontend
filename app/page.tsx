"use client"

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { motion } from "framer-motion"
import { Sidebar } from "@/components/sidebar"
import { UploadZone } from "@/components/upload-zone"
import { RegisterModal } from "@/components/register-modal"
import { UserAccountNav } from "@/components/user-account-nav"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LogIn, Megaphone } from "lucide-react"
import { useAnnouncementModal } from "@/hooks/use-announcement-modal"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const announcementModal = useAnnouncementModal()

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Auth */}
        <header className="absolute top-0 right-0 p-6 z-10 flex items-center gap-3">
          {/* Announcement Button */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Button
              onClick={() => announcementModal.open()}
              className="glass rounded-xl px-4 py-2 hover:bg-white/10 text-white backdrop-blur-sm border border-white/10 transition-all group"
              variant="ghost"
            >
              <Megaphone className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              公告
            </Button>
          </motion.div>

          {/* Auth Section */}
          {status === "loading" ? (
            <Skeleton className="w-10 h-10 rounded-full bg-white/10" />
          ) : session?.user ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <UserAccountNav user={session.user} />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Button
                onClick={() => setIsAuthModalOpen(true)}
                className="glass rounded-xl px-6 py-2 hover:bg-white/10 text-white backdrop-blur-sm border border-white/10 transition-all group"
              >
                <LogIn className="w-4 h-4 mr-2 group-hover:translate-x-0.5 transition-transform" />
                登录/注册
              </Button>
            </motion.div>
          )}
        </header>


        <main className="flex-1 overflow-y-auto">
          {/* Hero Section */}
          <div className="relative pt-16 pb-8 px-8">
            {/* Gradient orbs background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
              <div className="absolute top-20 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
            </div>

            {/* Hero Content */}
            <div className="relative max-w-5xl mx-auto text-center mb-12">
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
              >
                <span className="gradient-text">AI Species</span>
              </motion.h1>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-3xl text-slate-400 max-w-2xl mx-auto"
              >
                虾皮老郑
              </motion.h1>
            </div>

            {/* Glassmorphism Container */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative max-w-5xl mx-auto"
            >
              <div className="glass rounded-3xl p-10 glass-hover">
                <UploadZone isAuthenticated={!!session?.user} />
              </div>
            </motion.div>
          </div>

          {/* History moved to /history */}
        </main>
      </div>

      {/* Register/Login Modal */}
      <RegisterModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  )
}
