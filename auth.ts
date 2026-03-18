import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Nodemailer from "next-auth/providers/nodemailer"
import { CustomPrismaAdapter } from "@/lib/auth-adapter"
import { createTransport } from "nodemailer"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: CustomPrismaAdapter(),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "邮箱/用户名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.identifier || !credentials?.password) {
            return null
          }

          const identifier = credentials.identifier as string

          // 安全修复：优先精确匹配邮箱，避免用户名冒充邮箱
          // 1. 先尝试用邮箱精确匹配
          let user = await prisma.user.findUnique({
            where: { email: identifier },
            select: {
              id: true,
              email: true,
              name: true,
              username: true,
              image: true,
              password: true,
              credits: true,
              bonusCredits: true,
              role: true,
            },
          })

          // 2. 如果邮箱没匹配到，再尝试用户名匹配
          if (!user) {
            user = await prisma.user.findUnique({
              where: { username: identifier },
              select: {
                id: true,
                email: true,
                name: true,
                username: true,
                image: true,
                password: true,
                credits: true,
                bonusCredits: true,
                role: true,
              },
            })
          }

          if (!user) {
            return null
          }

          if (!user.password) {
            return null
          }

          // 验证密码
          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          )

          if (!isPasswordValid) {
            return null
          }

          console.log(`✅ 用户登录成功: ${user.email} (${user.username || '无用户名'})`)

          // 返回用户对象
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            username: user.username ?? undefined,
            image: user.image ?? undefined,
            credits: user.credits,
            bonusCredits: user.bonusCredits,
            role: user.role,
          }
        } catch (error) {
          console.error("❌ 登录验证错误:", error)
          return null
        }
      },
    }),
    Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        secure: Number(process.env.EMAIL_SERVER_PORT) === 465, // QQ 邮箱 465 端口需要 secure: true
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,

      // 自定义邮件发送函数（中文邮件）
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const { host } = new URL(url)
        const transport = createTransport(provider.server)

        try {
          await transport.sendMail({
            to: email,
            from: provider.from,
            subject: `登录您的 AI 绘图账号`,
            text: `登录 ${host}\n\n点击以下链接登录：\n${url}\n\n链接 5 分钟内有效。\n\n如果您没有请求此邮件，请忽略。`,
            html: `
              <!DOCTYPE html>
              <html lang="zh-CN">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    body {
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      padding: 40px 20px;
                      margin: 0;
                    }
                    .container {
                      max-width: 600px;
                      margin: 0 auto;
                      background: white;
                      border-radius: 16px;
                      overflow: hidden;
                      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    }
                    .header {
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      padding: 40px 30px;
                      text-align: center;
                    }
                    .header h1 {
                      color: white;
                      margin: 0;
                      font-size: 28px;
                      font-weight: 700;
                    }
                    .content {
                      padding: 40px 30px;
                    }
                    .content p {
                      color: #333;
                      line-height: 1.8;
                      margin: 0 0 20px 0;
                      font-size: 16px;
                    }
                    .button {
                      display: inline-block;
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white !important;
                      text-decoration: none;
                      padding: 16px 40px;
                      border-radius: 12px;
                      font-weight: 600;
                      font-size: 16px;
                      margin: 20px 0;
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                      transition: all 0.3s ease;
                    }
                    .button:hover {
                      transform: translateY(-2px);
                      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
                    }
                    .footer {
                      background: #f7f7f7;
                      padding: 30px;
                      text-align: center;
                      color: #666;
                      font-size: 14px;
                      line-height: 1.6;
                    }
                    .footer a {
                      color: #667eea;
                      text-decoration: none;
                    }
                    .warning {
                      background: #fff3cd;
                      border-left: 4px solid #ffc107;
                      padding: 15px;
                      margin: 20px 0;
                      border-radius: 8px;
                    }
                    .warning p {
                      color: #856404;
                      margin: 0;
                      font-size: 14px;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>✨ AI 智能绘图</h1>
                    </div>
                    <div class="content">
                      <p>您好，</p>
                      <p>您正在登录 <strong>${host}</strong>。请点击下方按钮完成登录：</p>
                      
                      <div style="text-align: center;">
                        <a href="${url}" class="button">
                          🔐 点击登录
                        </a>
                      </div>

                      <div class="warning">
                        <p><strong>⏰ 重要提示：</strong>此链接将在 <strong>5 分钟</strong>后过期，请尽快点击登录。</p>
                      </div>

                      <p style="color: #999; font-size: 14px; margin-top: 30px;">
                        如果您没有请求此邮件，请忽略。这可能是他人误输入了您的邮箱地址。
                      </p>

                      <p style="color: #999; font-size: 12px; margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
                        <strong>按钮无法点击？</strong><br>
                        请复制以下链接到浏览器地址栏：<br>
                        <a href="${url}" style="color: #667eea; word-break: break-all;">${url}</a>
                      </p>
                    </div>
                    <div class="footer">
                      <p>此邮件由 <strong>AI 智能绘图系统</strong> 自动发送，请勿回复。</p>
                      <p style="margin-top: 10px;">© 2025 AI-Species. All rights reserved.</p>
                    </div>
                  </div>
                </body>
              </html>
            `,
          })

          console.log("✅ 验证邮件已发送至:", email)
          console.log("📧 邮件服务器:", process.env.EMAIL_SERVER_HOST)
        } catch (error) {
          console.error("❌ 邮件发送失败:", error)
          throw error
        }
      },
    }),
  ],
  pages: {
    verifyRequest: "/verify-request",
  },
  session: {
    strategy: "jwt", // 使用 JWT 以兼容 Credentials provider
    maxAge: 30 * 24 * 60 * 60, // 30 天
  },
  callbacks: {
    async jwt({ token, user }) {
      // 首次登录时，将用户信息添加到 token
      if (user) {
        token.id = user.id!
        token.username = (user as any).username
        token.credits = (user as any).credits
        token.bonusCredits = (user as any).bonusCredits
        token.role = (user as any).role
        token.agentLevel = (user as any).agentLevel ?? 0
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.username = token.username as string
        session.user.bonusCredits = token.bonusCredits as number
        session.user.role = token.role as string

        // 关键：从数据库重新获取最新的积分，确保数据同步
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { credits: true, bonusCredits: true, role: true, agentLevel: true },
        })

        session.user.credits = dbUser?.credits ?? 0
        session.user.bonusCredits = dbUser?.bonusCredits ?? 0
        session.user.role = dbUser?.role ?? (session.user.role || "USER")
        session.user.agentLevel = dbUser?.agentLevel ?? 0
      }
      return session
    },
  },
  debug: process.env.NODE_ENV === "development",
})
