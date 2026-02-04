/**
 * 初始化商品套餐数据
 * 
 * 运行方式: npx ts-node prisma/seed-plans.ts
 * 或在 package.json 中配置 prisma.seed
 */

import { PrismaClient, PlanType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const initialPlans = [
    {
        name: '试用包',
        description: '新手体验，小额尝试',
        type: PlanType.CREDIT,
        price: 3000,
        credits: 3000,
        giftCredits: 0,
        isActive: true,
        isRecommend: false,
        sortOrder: 1,
    },
    {
        name: '基础包',
        description: '适合个人创作者',
        type: PlanType.CREDIT,
        price: 10000,
        credits: 10000,
        giftCredits: 300,
        isActive: true,
        isRecommend: false,
        sortOrder: 2,
    },
    {
        name: '专业包',
        description: '性价比之选，适合日常使用',
        type: PlanType.CREDIT,
        price: 30000,
        credits: 30000,
        giftCredits: 1000,
        isActive: true,
        isRecommend: true,
        sortOrder: 3,
    },
    {
        name: '企业包',
        description: '大容量套餐，专业用户首选',
        type: PlanType.CREDIT,
        price: 100000,
        credits: 100000,
        giftCredits: 5000,
        isActive: true,
        isRecommend: false,
        sortOrder: 4,
    },
];

async function main() {
    console.log('🌱 开始初始化商品套餐...');

    for (const plan of initialPlans) {
        // 幂等检查：按名称查找是否已存在
        const existing = await prisma.plan.findFirst({
            where: { name: plan.name },
        });

        if (existing) {
            console.log(`  ⏭️  套餐已存在，跳过: ${plan.name}`);
            continue;
        }

        // 创建新套餐
        const created = await prisma.plan.create({
            data: plan,
        });

        console.log(`  ✅ 创建套餐成功: ${created.name} (${created.price / 100}元)`);
    }

    console.log('🎉 商品套餐初始化完成！');
}

main()
    .catch((e) => {
        console.error('❌ 初始化失败:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
