import { auth } from "@/auth"

export type RequireAdminResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string }

/**
 * 服务端 RBAC 校验：必须为已登录管理员
 * - 未登录：401
 * - 非管理员：403
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const session = await auth()

  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "未登录" }
  }

  if (session.user.role !== "ADMIN") {
    return { ok: false, status: 403, error: "无管理员权限" }
  }

  return { ok: true, userId: session.user.id }
}




