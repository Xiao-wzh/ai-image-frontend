import { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username?: string
      credits?: number
      bonusCredits?: number
    } & DefaultSession["user"]
  }

  interface User {
    username?: string
    credits?: number
    bonusCredits?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username?: string
    credits?: number
    bonusCredits?: number
  }
}
