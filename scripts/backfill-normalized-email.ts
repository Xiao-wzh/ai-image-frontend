// 为现有用户补充 normalizedEmail 字段
// 运行方式: npx tsx scripts/backfill-normalized-email.ts

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { normalizeEmail } from "../lib/normalize-email"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL 未设置")
    process.exit(1)
}

async function main() {
    const pool = new pg.Pool({ connectionString: DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    try {
        console.log("🔍 查找没有 normalizedEmail 的用户...")

        // 获取所有没有 normalizedEmail 的用户
        const users = await prisma.user.findMany({
            where: { normalizedEmail: null },
            select: { id: true, email: true },
        })

        console.log(`📊 找到 ${users.length} 个用户需要处理`)

        if (users.length === 0) {
            console.log("✅ 所有用户都已有 normalizedEmail")
            return
        }

        let successCount = 0
        let failCount = 0
        const duplicates: string[] = []

        for (const user of users) {
            const normalized = normalizeEmail(user.email)

            try {
                // 检查是否已存在相同的 normalizedEmail
                const existing = await prisma.user.findFirst({
                    where: {
                        normalizedEmail: normalized,
                        id: { not: user.id },
                    },
                })

                if (existing) {
                    duplicates.push(`${user.email} -> ${normalized} (冲突: ${existing.email})`)
                    failCount++
                    continue
                }

                await prisma.user.update({
                    where: { id: user.id },
                    data: { normalizedEmail: normalized },
                })
                successCount++
                console.log(`✅ ${user.email} -> ${normalized}`)
            } catch (error) {
                failCount++
                console.error(`❌ ${user.email}: 更新失败`, error)
            }
        }

        console.log(`\n📈 完成: 成功 ${successCount}，失败 ${failCount}`)

        if (duplicates.length > 0) {
            console.log(`\n⚠️ 发现 ${duplicates.length} 个重复邮箱（需要人工处理）:`)
            duplicates.forEach((d) => console.log(`  - ${d}`))
        }
    } finally {
        await prisma.$disconnect()
        await pool.end()
    }
}

main().catch((e) => {
    console.error("❌ 执行失败:", e)
    process.exit(1)
})
