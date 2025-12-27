/**
 * Prisma Seed Script
 * 初始化 Platform + ProductTypePrompt（数据库驱动平台层级）
 */
import prisma from "../lib/prisma"
import { ProductType } from "../lib/constants"

async function main() {
  // 1) 创建平台（若存在则更新）
  const platforms = [
    { key: "SHOPEE", label: "虾皮 (Shopee)", isActive: true, sortOrder: 10 },
    { key: "AMAZON", label: "亚马逊 (Amazon)", isActive: true, sortOrder: 20 },
    { key: "TIKTOK", label: "TikTok", isActive: true, sortOrder: 30 },
    { key: "GENERAL", label: "通用 (General)", isActive: true, sortOrder: 1000 },
  ]

  for (const p of platforms) {
    await prisma.platform.upsert({
      where: { key: p.key },
      create: p,
      update: {
        label: p.label,
        isActive: p.isActive,
        sortOrder: p.sortOrder,
      },
    })
  }

  const platformMap = await prisma.platform.findMany({
    select: { id: true, key: true },
  })
  const byKey = new Map(platformMap.map((p) => [p.key, p.id]))

  const shopeeId = byKey.get("SHOPEE")!
  const amazonId = byKey.get("AMAZON")!
  const tiktokId = byKey.get("TIKTOK")!
  const generalId = byKey.get("GENERAL")!

  // 2) 清空系统 prompts（保留用户私有：userId != null）
  await prisma.productTypePrompt.deleteMany({ where: { userId: null } })

  // 3) 创建 prompts（系统默认：userId = null）
  await prisma.productTypePrompt.createMany({
    data: [
      // Shopee
      {
        userId: null,
        platformId: shopeeId,
        legacyPlatform: "SHOPEE",
        productType: ProductType.MENSWEAR,
        description: "男装",
        promptTemplate: `（Shopee 男装）为 \${productName} 生成高转化九宫格电商主图，文字清晰、排版干净，符合虾皮风格。`,
      },
      {
        userId: null,
        platformId: shopeeId,
        legacyPlatform: "SHOPEE",
        productType: ProductType.BEDDING,
        description: "寝具",
        promptTemplate: `（Shopee 寝具）为 \${productName} 生成九宫格主图，强调材质与卖点，风格符合虾皮。`,
      },

      // Amazon
      {
        userId: null,
        platformId: amazonId,
        legacyPlatform: "AMAZON",
        productType: ProductType.MENSWEAR,
        description: "男装",
        promptTemplate: `（Amazon 男装）为 \${productName} 生成更偏品牌化与规范化的电商主图布局，减少花哨元素，突出参数与卖点。`,
      },

      // TikTok：留空用于测试空状态（如要加一个，把下面注释去掉）
      // {
      //   userId: null,
      //   platformId: tiktokId,
      //   legacyPlatform: "TIKTOK",
      //   productType: ProductType.MENSWEAR,
      //   description: "男装",
      //   promptTemplate: `（TikTok 男装）为 \${productName} 生成适合短视频带货的高对比九宫格主图，标题更抓眼。`,
      // },

      // GENERAL（兜底）
      {
        userId: null,
        platformId: generalId,
        legacyPlatform: "GENERAL",
        productType: ProductType.MENSWEAR,
        description: "男装",
        promptTemplate: `（通用兜底）为 \${productName} 生成通用电商九宫格主图，文字清晰、排版干净、卖点真实。`,
      },
    ],
    skipDuplicates: true,
  })

  console.log("✅ Platform + ProductTypePrompt 种子数据已初始化")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
