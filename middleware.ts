import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// NextAuth v5 在 middleware 中的认证检查需要特殊处理
// 由于 Edge Runtime 限制，我们采用简化方案

// Cookie 配置
const REFERRAL_COOKIE_NAME = "referral_code"
const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 天

export function middleware(request: NextRequest) {
  // 公开路由列表
  const publicPaths = [
    "/",
    "/login",
    "/verify-request",
    "/api/auth",
  ]

  const { pathname, searchParams } = request.nextUrl

  // 创建响应
  let response = NextResponse.next()

  // 检查 URL 是否包含 ref 参数，如果有则持久化到 Cookie
  const refCode = searchParams.get("ref") || searchParams.get("inviteCode")
  if (refCode) {
    // 设置 referral_code Cookie
    response.cookies.set(REFERRAL_COOKIE_NAME, refCode, {
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      path: "/",
      httpOnly: false, // 允许客户端 JS 读取（可选）
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    })
  }

  // 检查是否是公开路径
  const isPublicPath = publicPaths.some((path) =>
    pathname === path || pathname.startsWith(path + "/")
  )

  // 公开路径直接放行
  if (isPublicPath) {
    return response
  }

  // 其他路径也暂时放行（NextAuth 会在服务端组件中处理认证）
  return response
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     * - public 文件夹中的文件
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
