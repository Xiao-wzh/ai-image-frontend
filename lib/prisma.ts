import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

// 确保 DATABASE_URL 存在
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  // 在 Next.js 生产构建中不要在导入时抛出错误，但要在运行时提供清晰的错误信息
  console.warn("[prisma] DATABASE_URL 未设置。请在您的环境变量或 .env 文件中配置。")
}

// 在开发环境中创建跨热重载的共享 PrismaClient 实例
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export default prisma

