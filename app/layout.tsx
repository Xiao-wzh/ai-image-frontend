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
import "./globals.css"

// 强制动态渲染，确保每次请求都从数据库获取最新配置
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "AI 图像生成器 - 仪表盘",
  description: "使用我们现代化的图像生成器创建令人惊叹的 AI 生成艺术作品",
  generator: "v0.app",
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

// 获取客服二维码配置
async function getCustomerServiceConfig() {
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
  const qrConfig = await getCustomerServiceConfig()

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
                  customerServiceQr={qrConfig.customerServiceQr}
                  afterSaleGroupQr={qrConfig.afterSaleGroupQr}
                />
                <Toaster richColors closeButton position="top-center" />
                <Analytics />
              </ThemeProvider>
            </AnnouncementModalProvider>
          </LoginModalProviderClient>
        </SessionProvider>
      </body>
    </html>
  )
}



