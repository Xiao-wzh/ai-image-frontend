/**
 * 清理脏数据脚本
 * 清除 editingImageIndexes 并退款
 *
 * 运行: npx tsx scripts/cleanup-editing-indexes.ts
 */

import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// 直接查询系统配置（绕过 Next.js 缓存）
async function getEditCost(): Promise<number> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: "IMAGE_EDIT_COST" },
  })
  return config ? parseInt(config.value, 10) : 10 // 默认 10 积分
}

// 直接退款（不依赖 refundCredits 服务）
async function refundCreditsDirect(userId: string, amount: number, reason: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, bonusCredits: true },
  })

  if (!user) return

  // 优先退还到 bonusCredits
  const refundBonus = Math.min(amount, amount) // 全部退到 bonusCredits
  const refundPaid = 0

  await prisma.user.update({
    where: { id: userId },
    data: {
      bonusCredits: { increment: refundBonus },
      credits: { increment: refundPaid },
    },
  })

  await prisma.creditRecord.create({
    data: {
      userId,
      amount: amount,
      type: "REFUND",
      description: reason,
    },
  })
}

async function main() {
  console.log("🔍 正在查找脏数据...")

  // 查找所有 editingImageIndexes 不为空的记录
  const dirtyRecords = await prisma.$queryRaw<any[]>`
    SELECT id, "userId", "editingImageIndexes", "productName"
    FROM "Generation"
    WHERE cardinality("editingImageIndexes") > 0
  `

  if (dirtyRecords.length === 0) {
    console.log("✅ 没有脏数据需要清理")
    return
  }

  console.log(`📋 找到 ${dirtyRecords.length} 条脏数据`)

  const EDIT_COST = await getEditCost()
  console.log(`💰 编辑费用: ${EDIT_COST} 积分/次`)

  let successCount = 0
  let failCount = 0
  let totalRefund = 0

  for (const record of dirtyRecords) {
    const indexes = record.editingImageIndexes as number[]
    const refundAmount = indexes.length * EDIT_COST

    try {
      // 清除 editingImageIndexes
      await prisma.$executeRaw`UPDATE "Generation" SET "editingImageIndexes" = '{}' WHERE id = ${record.id}::uuid`

      // 退款
      if (record.userId && refundAmount > 0) {
        await refundCreditsDirect(record.userId, refundAmount, `图片编辑失败自动退款 (清理脏数据)`)
      }

      console.log(`✅ ${record.id.slice(0, 8)}... 退款 ${refundAmount} 积分 (${indexes.length} 次编辑)`)
      successCount++
      totalRefund += refundAmount
    } catch (err: any) {
      console.error(`❌ ${record.id.slice(0, 8)}... 处理失败: ${err.message}`)
      failCount++
    }
  }

  console.log("\n========== 清理完成 ==========")
  console.log(`✅ 成功: ${successCount} 条`)
  console.log(`❌ 失败: ${failCount} 条`)
  console.log(`💰 总退款: ${totalRefund} 积分`)

  await prisma.$disconnect()
}

main().catch(console.error)
