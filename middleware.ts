import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// NextAuth v5 在 middleware 中的认证检查需要特殊处理
// 由于 Edge Runtime 限制，我们采用简化方案

export function middleware(request: NextRequest) {
  // 公开路由列表
  const publicPaths = [
    "/",
    "/login",
    "/verify-request",
    "/api/auth",
  ]

  const { pathname } = request.nextUrl

  // 检查是否是公开路径
  const isPublicPath = publicPaths.some((path) => 
    pathname === path || pathname.startsWith(path + "/")
  )

  // 公开路径直接放行
  if (isPublicPath) {
    return NextResponse.next()
  }

  // 其他路径也暂时放行（NextAuth 会在服务端组件中处理认证）
  return NextResponse.next()
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
