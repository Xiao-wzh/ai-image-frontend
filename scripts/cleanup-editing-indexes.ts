/**
 * 清理脏数据脚本
 * 清除 editingImageIndexes 并退款
 *
 * 运行: npx tsx scripts/cleanup-editing-indexes.ts
 */

import "dotenv/config"
import pg from "pg"

const DATABASE_URL = process.env.DATABASE_URL!
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL 未配置")
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })

// 直接查询系统配置
async function getEditCost(): Promise<number> {
  const result = await pool.query(`SELECT value FROM "SystemConfig" WHERE key = 'IMAGE_EDIT_COST'`)
  if (result.rows.length > 0) {
    return parseInt(result.rows[0].value, 45)
  }
  return 45 // 默认 45 积分
}

// 直接退款
async function refundCreditsDirect(userId: string, amount: number, reason: string) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 更新用户积分（优先退还到 bonusCredits）
    await client.query(`
      UPDATE "User"
      SET "bonusCredits" = COALESCE("bonusCredits", 0) + $1
      WHERE id = $2
    `, [amount, userId])

    // 创建积分记录
    await client.query(`
      INSERT INTO "CreditRecord" (id, "userId", amount, type, description, "createdAt")
      VALUES (gen_random_uuid(), $1, $2, 'REFUND', $3, NOW())
    `, [userId, amount, reason])

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function main() {
  console.log("🔍 正在查找脏数据...")

  // 查找所有 editingImageIndexes 不为空的记录
  const result = await pool.query(`
    SELECT id, "userId", "editingImageIndexes"
    FROM "Generation"
    WHERE cardinality("editingImageIndexes") > 0
  `)

  const dirtyRecords = result.rows

  if (dirtyRecords.length === 0) {
    console.log("✅ 没有脏数据需要清理")
    await pool.end()
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
      await pool.query(`UPDATE "Generation" SET "editingImageIndexes" = '{}' WHERE id = $1`, [record.id])

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

  await pool.end()
}

main().catch(console.error)
