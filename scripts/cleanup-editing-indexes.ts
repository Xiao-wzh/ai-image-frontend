/**
 * 清理脏数据脚本
 * 清除 editingImageIndexes 并退款
 *
 * 运行: npx tsx scripts/cleanup-editing-indexes.ts
 */

import "dotenv/config"
import prisma from "../lib/prisma"
import { refundCredits } from "../lib/credit-service"
import { getSystemCost } from "../lib/system-config"

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

  const EDIT_COST = await getSystemCost("IMAGE_EDIT_COST")
  console.log(`💰 编辑费用: ${EDIT_COST} 积分/次`)

  let successCount = 0
  let failCount = 0
  let totalRefund = 0

  for (const record of dirtyRecords) {
    const indexes = record.editingImageIndexes as number[]
    const refundAmount = indexes.length * EDIT_COST

    try {
      await prisma.$transaction(async (tx: any) => {
        // 清除 editingImageIndexes
        await tx.$executeRaw`UPDATE "Generation" SET "editingImageIndexes" = '{}' WHERE id = ${record.id}::uuid`

        // 退款
        if (record.userId && refundAmount > 0) {
          await refundCredits(tx, record.userId, refundAmount, `图片编辑失败自动退款 (清理脏数据)`)
        }
      })

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
