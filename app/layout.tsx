import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import { ThemeProvider } from "next-themes"
import { SessionProvider } from "@/components/session-provider"
import { LoginModalProviderClient } from "@/components/login-modal-provider"
import { LoginModalRoot } from "@/components/login-modal-root"
import { AnnouncementModalProvider } from "@/hooks/use-announcement-modal"
import { AnnouncementModalRoot } from "@/components/announcement-modal-root"
import { FloatingCustomerService } from "@/components/floating-customer-service"
import prisma from "@/lib/prisma"
import { getCurrentAgentProfile } from "@/lib/agent-helper"
import "./globals.css"

// 强制动态渲染，确保每次请求都从数据库获取最新配置
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "ai-species-淯隆",
  description: "使用我们现代化的图像生成器创建令人惊叹的 AI 生成艺术作品",
  generator: "ai-species-淯隆",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

// 获取系统客服二维码配置
async function getSystemCustomerServiceConfig() {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { in: ['CUSTOMER_SERVICE_QR', 'AFTER_SALE_GROUP_QR'] } },
    })
    const result: Record<string, string> = {}
    for (const config of configs) {
      result[config.key] = config.value
    }
    return {
      customerServiceQr: result['CUSTOMER_SERVICE_QR'] || '',
      afterSaleGroupQr: result['AFTER_SALE_GROUP_QR'] || '',
    }
  } catch {
    return { customerServiceQr: '', afterSaleGroupQr: '' }
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // 并行获取系统配置和代理配置
  const [systemQrConfig, agentContext] = await Promise.all([
    getSystemCustomerServiceConfig(),
    getCurrentAgentProfile(),
  ])

  // 代理客服二维码优先于系统配置
  const customerServiceQr = systemQrConfig.customerServiceQr
  const afterSaleGroupQr = agentContext.profile.contactQr || systemQrConfig.afterSaleGroupQr

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <SessionProvider>
          <LoginModalProviderClient>
            <AnnouncementModalProvider>
              <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
                {children}
                <LoginModalRoot />
                <AnnouncementModalRoot />
                <FloatingCustomerService
                  customerServiceQr={customerServiceQr}
                  afterSaleGroupQr={afterSaleGroupQr}
                />
                <Toaster richColors closeButton position="top-center" />
                <Analytics />
                {/* ICP 备案号 */}
                <footer className="fixed bottom-0 left-0 right-0 z-50 py-2 text-center pointer-events-none">
                  <a
                    href="https://beian.miit.gov.cn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-500/60 hover:text-slate-400 transition-colors pointer-events-auto"
                  >
                    @ 2026 深圳市淯隆电子商务有限公司
                    <br />
                    粤ICP备2026011207号
                  </a>
                </footer>
              </ThemeProvider>
            </AnnouncementModalProvider>
          </LoginModalProviderClient>
        </SessionProvider>
      </body>
    </html>
  )
}
