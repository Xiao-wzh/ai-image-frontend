import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      username?: string | null
      credits: number
      bonusCredits: number
      role: string
      agentLevel: number // 代理等级: 0=User, 1=L3, 2=L2, 3=L1
    }
  }

  // 不要在这里扩展 next-auth 的 User（它会影响 AdapterUser 的结构，导致 Adapter 类型不匹配）
  // 如需扩展，请使用 Session.user / JWT 即可
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    username?: string | null
    credits?: number
    bonusCredits?: number
    role?: string
    agentLevel?: number // 代理等级
  }
}
