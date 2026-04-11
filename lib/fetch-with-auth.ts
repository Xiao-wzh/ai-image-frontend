"use client"

/**
 * 带 401 自动拦截的 fetch 封装
 *
 * 当 API 返回 401 时自动跳转到登录页，
 * 避免用户在 session 过期后继续操作却看不到反馈。
 */
export function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init).then((res) => {
    if (res.status === 401) {
      // 排除登录相关接口自身返回的 401（避免循环跳转）
      const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : "url" in input ? input.url : ""
      if (!url.includes("/api/auth/") && !url.includes("/api/user/credits")) {
        window.location.href = "/login"
      }
    }
    return res
  })
}
