"use client"

import { Sidebar } from "@/components/sidebar"
import { UploadZone } from "@/components/upload-zone"
import { ImageGrid } from "@/components/image-grid"

export default function DashboardPage() {
  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
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
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                <span className="gradient-text">
                  AI 智能绘图
                </span>
              </h1>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                利用最先进的 Gemini 模型创造视觉奇迹，让创意无限延伸
              </p>
            </div>

            {/* Glassmorphism Container */}
            <div className="relative max-w-5xl mx-auto">
              <div className="glass rounded-3xl p-10 glass-hover">
                <UploadZone />
              </div>
            </div>
          </div>

          {/* Image Grid Section */}
          <div className="px-8 pb-8">
            <div className="max-w-5xl mx-auto">
              <ImageGrid />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
