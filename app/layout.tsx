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
import "./globals.css"

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
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
