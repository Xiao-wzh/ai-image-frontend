/**
 * 批量生成卡密并写入数据库
 * 用法示例：
 *   npx tsx scripts/generate-codes.ts 100 50
 * 说明：
 *   - 第一个参数：付费积分 credits
 *   - 第二个参数：生成数量 count
 *   - bonus（赠送积分）可选第三个参数：npx tsx scripts/generate-codes.ts 100 50 20
 */

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import crypto from "crypto"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL 未设置")
  process.exit(1)
}

function makeCode() {
  // 生成 16 字节随机数 -> base32 风格字符串（去掉容易混淆的字符）
  const raw = crypto.randomBytes(10).toString("hex").toUpperCase() // 20 chars
  // CDK-xxxx-xxxx-xxxx 形式
  return `CDK-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`
}

async function main() {
  const creditsArg = Number(process.argv[2])
  const countArg = Number(process.argv[3])
  const bonusArg = process.argv[4] ? Number(process.argv[4]) : 0

  if (!Number.isFinite(creditsArg) || creditsArg <= 0) {
    console.error("❌ credits 参数无效，用法：npx tsx scripts/generate-codes.ts <credits> <count> [bonus]")
    process.exit(1)
  }
  if (!Number.isFinite(countArg) || countArg <= 0) {
    console.error("❌ count 参数无效，用法：npx tsx scripts/generate-codes.ts <credits> <count> [bonus]")
    process.exit(1)
  }
  if (!Number.isFinite(bonusArg) || bonusArg < 0) {
    console.error("❌ bonus 参数无效（可选），必须是 >= 0 的数字")
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString: DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    const codes: string[] = []
    const rows: Array<{ code: string; credits: number; bonus: number; status: string }> = []

    // 为避免 unique 冲突，做简单重试
    for (let i = 0; i < countArg; i++) {
      let c = makeCode()
      // 极低概率冲突：最多重试 5 次
      for (let r = 0; r < 5; r++) {
        const exists = await prisma.redemptionCode.findUnique({ where: { code: c } })
        if (!exists) break
        c = makeCode()
      }

      codes.push(c)
      rows.push({ code: c, credits: creditsArg, bonus: bonusArg, status: "UNUSED" })
    }

    await prisma.redemptionCode.createMany({ data: rows })

    console.log("✅ 已生成卡密：")
    codes.forEach((c) => console.log(c))

    console.log("\n📦 生成参数：")
    console.log(`- credits: ${creditsArg}`)
    console.log(`- bonus:   ${bonusArg}`)
    console.log(`- count:   ${countArg}`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error("❌ 执行失败:", e)
  process.exit(1)
})







