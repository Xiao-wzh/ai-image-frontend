import { Suspense } from "react"
import { DashboardContent } from "@/components/dashboard-content"
import { getCurrentAgentProfile } from "@/lib/agent-helper"

// 强制动态渲染，确保每次请求都获取最新代理配置
export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ ref?: string; inviteCode?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  // 服务端获取代理配置
  const params = await searchParams
  const agentContext = await getCurrentAgentProfile(params)

  return (
    <Suspense fallback={<div className="flex h-screen bg-slate-950" />}>
      <DashboardContent
        siteName={agentContext.profile.siteName}
        welcomeMsg={agentContext.profile.welcomeMsg}
      />
    </Suspense>
  )
}
