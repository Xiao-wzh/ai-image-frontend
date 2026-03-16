import { auth } from "@/auth"

export type RequireAdminResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string }

/**
 * 角色层级：
 * USER     - 普通用户
 * FINANCE  - 财务员：可查看订单管理
 * REVIEWER - 审核员：可查看售后审核
 * ADMIN    - 管理员：全部权限
 */

/** 必须为管理员 */
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

/** 必须为管理员或财务员（可查看订单） */
export async function requireFinanceOrAdmin(): Promise<RequireAdminResult> {
  const session = await auth()

  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "未登录" }
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "FINANCE") {
    return { ok: false, status: 403, error: "无权限访问" }
  }

  return { ok: true, userId: session.user.id }
}

/** 必须为管理员或审核员（可查看售后审核） */
export async function requireReviewerOrAdmin(): Promise<RequireAdminResult> {
  const session = await auth()

  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "未登录" }
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "REVIEWER") {
    return { ok: false, status: 403, error: "无权限访问" }
  }

  return { ok: true, userId: session.user.id }
}
