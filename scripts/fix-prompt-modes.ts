/**
 * 修复数据库中已有提示词的 mode 字段
 * 确保所有创意模式提示词都有 mode='CREATIVE'，克隆模式提示词都有 mode='CLONE'
 * 
 * 运行方式：
 *   node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/fix-prompt-modes.ts dotenv_config_path=.env.local
 */

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL 未设置（请在 .env.local 中配置）")
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🚀 开始修复提示词 mode 字段...")

  // 1. 查找所有没有明确设置 mode 的提示词（或 mode 为空的）
  const allPrompts = await prisma.productTypePrompt.findMany({
    select: {
      id: true,
      productType: true,
      taskType: true,
      mode: true,
      description: true,
    },
  })

  console.log(`📊 找到 ${allPrompts.length} 条提示词记录`)

  let updatedCount = 0

  for (const prompt of allPrompts) {
    // 克隆模式：productType 包含 "CLONE" 或已经是 "CLONE" mode
    if (prompt.productType === "CLONE_GENERAL" || prompt.mode === "CLONE") {
      if (prompt.mode !== "CLONE") {
        await prisma.productTypePrompt.update({
          where: { id: prompt.id },
          data: { mode: "CLONE" },
        })
        console.log(`✅ 更新为克隆模式: ${prompt.description} (${prompt.taskType})`)
        updatedCount++
      }
    }
    // 创意模式：其他所有提示词
    else {
      if (prompt.mode !== "CREATIVE") {
        await prisma.productTypePrompt.update({
          where: { id: prompt.id },
          data: { mode: "CREATIVE" },
        })
        console.log(`✅ 更新为创意模式: ${prompt.description} (${prompt.taskType})`)
        updatedCount++
      }
    }
  }

  console.log(`\n✨ 修复完成！共更新 ${updatedCount} 条记录`)

  // 2. 显示统计信息
  const creativeCount = await prisma.productTypePrompt.count({
    where: { mode: "CREATIVE" },
  })
  const cloneCount = await prisma.productTypePrompt.count({
    where: { mode: "CLONE" },
  })

  console.log(`\n📈 当前统计：`)
  console.log(`   - 创意模式提示词: ${creativeCount} 条`)
  console.log(`   - 克隆模式提示词: ${cloneCount} 条`)
}

main()
  .catch((e) => {
    console.error("❌ 执行失败:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
