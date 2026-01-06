// 为现有用户补充生成推广码的脚本
// 运行方式: npx tsx scripts/generate-referral-codes.ts

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL 未设置")
    process.exit(1)
}

// 生成6位随机推广码（大写字母+数字）
function generateReferralCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let result = ""
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

async function main() {
    const pool = new pg.Pool({ connectionString: DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    try {
        console.log("🔍 查找没有推广码的用户...")

        // 获取所有没有推广码的用户
        const usersWithoutCode = await prisma.user.findMany({
            where: { referralCode: null },
            select: { id: true, email: true, username: true },
        })

        console.log(`📊 找到 ${usersWithoutCode.length} 个用户需要生成推广码`)

        if (usersWithoutCode.length === 0) {
            console.log("✅ 所有用户都已有推广码")
            return
        }

        // 获取所有现有的推广码
        const existingCodes = await prisma.user.findMany({
            where: { referralCode: { not: null } },
            select: { referralCode: true },
        })
        const usedCodes = new Set(existingCodes.map((u) => u.referralCode))

        let successCount = 0
        let failCount = 0

        for (const user of usersWithoutCode) {
            // 生成唯一推广码
            let code = generateReferralCode()
            let attempts = 0
            while (usedCodes.has(code) && attempts < 100) {
                code = generateReferralCode()
                attempts++
            }

            // 如果尝试多次仍冲突，添加时间戳
            if (usedCodes.has(code)) {
                code = code + Date.now().toString(36).slice(-2).toUpperCase()
            }

            try {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { referralCode: code },
                })
                usedCodes.add(code)
                successCount++
                console.log(`✅ ${user.email || user.username}: ${code}`)
            } catch (error) {
                failCount++
                console.error(`❌ ${user.email || user.username}: 生成失败`, error)
            }
        }

        console.log(`\n📈 完成: 成功 ${successCount}，失败 ${failCount}`)
    } finally {
        await prisma.$disconnect()
        await pool.end()
    }
}

main().catch((e) => {
    console.error("❌ 执行失败:", e)
    process.exit(1)
})

