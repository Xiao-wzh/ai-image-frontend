/**
 * 修复生成记录中的 mode 字段
 * 确保所有生成记录都有正确的 mode 值
 * 
 * 运行方式：
 *   node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/fix-generation-modes.ts dotenv_config_path=.env.local
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
  console.log("🚀 开始修复生成记录的 mode 字段...")

  // 1. 查找所有没有 mode 的记录
  const allGenerations = await prisma.generation.findMany({
    select: {
      id: true,
      productType: true,
      mode: true,
      features: true,
      refImages: true,
    },
  })

  console.log(`📊 找到 ${allGenerations.length} 条生成记录`)

  let updatedCount = 0

  for (const gen of allGenerations) {
    let needsUpdate = false
    let newMode = gen.mode

    // 如果 mode 为空，根据 productType 推断
    if (!gen.mode) {
      if (gen.productType === "CLONE_GENERAL") {
        newMode = "CLONE"
      } else {
        newMode = "CREATIVE"
      }
      needsUpdate = true
    }
    // 如果 mode 是 CREATIVE 但 productType 是 CLONE_GENERAL，修正为 CLONE
    else if (gen.mode === "CREATIVE" && gen.productType === "CLONE_GENERAL") {
      newMode = "CLONE"
      needsUpdate = true
    }
    // 如果 mode 是 CLONE 但有 refImages，确保 features 不为空
    else if (gen.mode === "CLONE" && gen.refImages && gen.refImages.length > 0 && !gen.features) {
      // 这种情况只需要记录，不需要修改 mode
      console.log(`⚠️  记录 ${gen.id} 是克隆模式但缺少 features 字段`)
    }

    if (needsUpdate && newMode !== gen.mode) {
      await prisma.generation.update({
        where: { id: gen.id },
        data: { mode: newMode },
      })
      console.log(`✅ 更新记录 ${gen.id}: ${gen.mode || "null"} → ${newMode}`)
      updatedCount++
    }
  }

  console.log(`\n✨ 修复完成！共更新 ${updatedCount} 条记录`)

  // 2. 显示统计信息
  const creativeCount = await prisma.generation.count({
    where: { mode: "CREATIVE" },
  })
  const cloneCount = await prisma.generation.count({
    where: { mode: "CLONE" },
  })
  const nullCount = await prisma.generation.count({
    where: { 
      mode: {
        in: [null as any, ""]
      }
    },
  })

  console.log(`\n📈 当前统计：`)
  console.log(`   - 创意模式生成: ${creativeCount} 条`)
  console.log(`   - 克隆模式生成: ${cloneCount} 条`)
  console.log(`   - mode 为空: ${nullCount} 条`)

  if (nullCount > 0) {
    console.log(`\n⚠️  警告：还有 ${nullCount} 条记录的 mode 为空，可能需要手动检查`)
  }
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
