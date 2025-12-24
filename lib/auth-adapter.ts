import type { Adapter } from "@auth/core/adapters"
import prisma from "@/lib/prisma"

// 自定义 NextAuth Adapter，兼容 Prisma 7 Driver Adapter
export function CustomPrismaAdapter(): Adapter {
  return {
    async createUser(user) {
      const newUser = await prisma.user.create({
        data: {
          email: user.email,
          emailVerified: user.emailVerified,
          name: user.name,
          image: user.image,
        },
      })
      return newUser
    },

    async getUser(id) {
      const user = await prisma.user.findUnique({ where: { id } })
      return user
    },

    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({ where: { email } })
      return user
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const account = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
        include: { user: true },
      })
      return account?.user ?? null
    },

    async updateUser({ id, ...data }) {
      const user = await prisma.user.update({
        where: { id },
        data,
      })
      return user
    },

    async deleteUser(userId) {
      await prisma.user.delete({ where: { id: userId } })
    },

    async linkAccount(account) {
      await prisma.account.create({
        data: {
          userId: account.userId,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          refresh_token: account.refresh_token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          id_token: account.id_token,
          session_state: account.session_state,
        },
      })
    },

    async unlinkAccount({ providerAccountId, provider }) {
      await prisma.account.delete({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
      })
    },

    async createSession({ sessionToken, userId, expires }) {
      const session = await prisma.session.create({
        data: {
          sessionToken,
          userId,
          expires,
        },
      })
      return session
    },

    async getSessionAndUser(sessionToken) {
      const userAndSession = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      })
      if (!userAndSession) return null
      const { user, ...session } = userAndSession
      return { user, session }
    },

    async updateSession({ sessionToken, ...data }) {
      const session = await prisma.session.update({
        where: { sessionToken },
        data,
      })
      return session
    },

    async deleteSession(sessionToken) {
      await prisma.session.delete({ where: { sessionToken } })
    },

    async createVerificationToken({ identifier, expires, token }) {
      const verificationToken = await prisma.verificationToken.create({
        data: {
          identifier,
          token,
          expires,
        },
      })
      return verificationToken
    },

    async useVerificationToken({ identifier, token }) {
      try {
        const verificationToken = await prisma.verificationToken.delete({
          where: {
            identifier_token: {
              identifier,
              token,
            },
          },
        })
        return verificationToken
      } catch (error) {
        return null
      }
    },
  }
}

