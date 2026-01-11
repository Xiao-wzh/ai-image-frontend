/**
 * 用户等级升级迁移脚本
 * 
 * 功能：
 * 1. 将指定用户升级为 L1 (合伙人)
 * 2. 将该用户邀请的所有下级升级为 L3 (推广大使)
 * 
 * 使用方法：
 *   npx tsx scripts/promote-to-l1.ts <用户邮箱或ID>
 * 
 * 示例：
 *   npx tsx scripts/promote-to-l1.ts admin@example.com
 *   npx tsx scripts/promote-to-l1.ts cmjo6b1a40001o4ubemy0rr82
 */

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

// 创建 Prisma 客户端 (使用项目相同的 adapter 配置)
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL 环境变量未设置")
    process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// 代理等级常量
const AGENT_LEVEL = {
    USER: 0,      // 普通用户
    L1: 1,        // 合伙人
    L2: 2,        // 运营中心
    L3: 3,        // 推广大使
}

// L1 初始授权名额
const L1_INITIAL_QUOTA = 5

async function main() {
    const userIdentifier = process.argv[2]

    if (!userIdentifier) {
        console.error("❌ 请提供用户邮箱或ID")
        console.error("用法: npx tsx scripts/promote-to-l1.ts <用户邮箱或ID>")
        process.exit(1)
    }

    console.log(`🔍 查找用户: ${userIdentifier}`)

    // 查找用户（支持邮箱或ID）
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { id: userIdentifier },
                { email: userIdentifier }
            ]
        }
    })

    if (!user) {
        console.error(`❌ 未找到用户: ${userIdentifier}`)
        process.exit(1)
    }

    console.log(`✅ 找到用户:`)
    console.log(`   ID: ${user.id}`)
    console.log(`   邮箱: ${user.email}`)
    console.log(`   用户名: ${user.username || "(未设置)"}`)
    console.log(`   当前等级: L${user.agentLevel === 0 ? "0 (普通用户)" : user.agentLevel}`)

    // 检查是否已经是 L1
    if (user.agentLevel === AGENT_LEVEL.L1) {
        console.log(`⚠️  用户已经是 L1 合伙人`)
    }

    // 查找该用户邀请的所有下级
    const invitedUsers = await prisma.user.findMany({
        where: { invitedById: user.id }
    })

    console.log(`\n📊 该用户邀请的下级: ${invitedUsers.length} 人`)

    if (invitedUsers.length > 0) {
        console.log("   下级列表:")
        invitedUsers.forEach((u, i) => {
            console.log(`   ${i + 1}. ${u.email} (L${u.agentLevel})`)
        })
    }

    // 确认操作
    console.log(`\n📝 即将执行的操作:`)
    console.log(`   1. 将 ${user.email} 升级为 L1 (合伙人)`)
    console.log(`   2. 设置初始授权名额: ${L1_INITIAL_QUOTA}`)
    console.log(`   3. 将 ${invitedUsers.length} 个下级升级为 L3 (推广大使)`)

    // 开始事务
    console.log(`\n🚀 开始执行...`)

    await prisma.$transaction(async (tx) => {
        // 1. 升级用户为 L1
        await tx.user.update({
            where: { id: user.id },
            data: {
                agentLevel: AGENT_LEVEL.L1,
                agentQuota: L1_INITIAL_QUOTA
            }
        })
        console.log(`   ✅ ${user.email} 已升级为 L1`)

        // 2. 升级所有下级为 L3
        if (invitedUsers.length > 0) {
            const result = await tx.user.updateMany({
                where: {
                    invitedById: user.id,
                    agentLevel: { lt: AGENT_LEVEL.L3 } // 只升级等级低于 L3 的
                },
                data: {
                    agentLevel: AGENT_LEVEL.L3
                }
            })
            console.log(`   ✅ ${result.count} 个下级已升级为 L3`)
        }
    })

    console.log(`\n🎉 迁移完成！`)

    // 验证结果
    const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
            invites: {
                select: { id: true, email: true, agentLevel: true }
            }
        }
    })

    console.log(`\n📋 最终结果:`)
    console.log(`   用户: ${updatedUser?.email}`)
    console.log(`   等级: L${updatedUser?.agentLevel} (合伙人)`)
    console.log(`   授权名额: ${updatedUser?.agentQuota}`)
    console.log(`   下级数量: ${updatedUser?.invites.length}`)

    if (updatedUser?.invites && updatedUser.invites.length > 0) {
        console.log(`   下级等级:`)
        updatedUser.invites.forEach((u, i) => {
            const levelName = u.agentLevel === 3 ? "推广大使" :
                u.agentLevel === 2 ? "运营中心" :
                    u.agentLevel === 1 ? "合伙人" : "普通用户"
            console.log(`      ${i + 1}. ${u.email} → L${u.agentLevel} (${levelName})`)
        })
    }
}

main()
    .catch((e) => {
        console.error("❌ 迁移失败:", e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
