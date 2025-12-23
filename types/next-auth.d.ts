import { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username?: string
      credits?: number
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    username?: string
    credits?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username?: string
    credits?: number
  }
}
