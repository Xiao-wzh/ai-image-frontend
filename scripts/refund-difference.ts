/**
 * 补退差额脚本
 * 编辑费用是 45 积分，之前只退了 10 积分，每条少退 35 积分
 *
 * 运行: npx tsx scripts/refund-difference.ts
 */

import "dotenv/config"
import pg from "pg"

const DATABASE_URL = process.env.DATABASE_URL!
const DIFFERENCE_PER_EDIT = 35 // 每次编辑少退 35 积分

const pool = new pg.Pool({ connectionString: DATABASE_URL })

async function refundDifference(userId: string, amount: number, reason: string) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 更新用户积分
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
  console.log("🔍 查询需要补退的记录...")

  // 查询刚才清理脚本产生的退款记录
  const result = await pool.query(`
    SELECT "userId", COUNT(*) as edit_count
    FROM "CreditRecord"
    WHERE description LIKE '%清理脏数据%'
    GROUP BY "userId"
  `)

  if (result.rows.length === 0) {
    console.log("✅ 没有需要补退的记录")
    await pool.end()
    return
  }

  console.log(`📋 找到 ${result.rows.length} 个用户需要补退`)

  let totalDiff = 0

  for (const row of result.rows) {
    const userId = row.userId
    const editCount = parseInt(row.edit_count, 10)
    const diffAmount = editCount * DIFFERENCE_PER_EDIT

    try {
      await refundDifference(userId, diffAmount, `图片编辑退款差额补发 (每次编辑补 ${DIFFERENCE_PER_EDIT} 积分)`)
      console.log(`✅ ${userId.slice(0, 12)}... 补退 ${diffAmount} 积分 (${editCount} 次编辑)`)
      totalDiff += diffAmount
    } catch (err: any) {
      console.error(`❌ ${userId.slice(0, 12)}... 补退失败: ${err.message}`)
    }
  }

  console.log("\n========== 补退完成 ==========")
  console.log(`💰 总补退: ${totalDiff} 积分`)

  await pool.end()
}

main().catch(console.error)
