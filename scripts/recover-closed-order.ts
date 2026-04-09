/**
 * 关闭订单补救脚本
 *
 * 场景：用户创建了订单但延迟支付，定时任务已将订单关闭（CLOSED），
 *       但用户实际上已经在微信支付成功。
 *
 * 功能：
 * 1. 根据商户订单号查询本地订单状态
 * 2. 如果订单是 CLOSED 状态，向微信查询实际支付状态
 * 3. 如果微信确认已支付，重新打开订单并执行完整结算流程
 *    （发放积分、分润佣金、记录活动等）
 *
 * 使用方法：
 *   npx tsx scripts/recover-closed-order.ts <商户订单号>
 *
 * 示例：
 *   npx tsx scripts/recover-closed-order.ts WX_1712345678900_ABCD1234
 *   npx tsx scripts/recover-closed-order.ts ORD-1712345678900-ABCD
 */

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import WxPay from "wechatpay-node-v3"
import { distributeCommissionTx } from "../lib/agent-service"

// ============= 初始化数据库连接 =============
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL 环境变量未设置")
    process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ============= 初始化微信支付客户端 =============
function createWxClient(): { client: WxPay; mchid: string } {
    // 从环境变量或配置文件读取商户信息
    const mchid = process.env.WECHAT_MCHID
    const appid = process.env.WECHAT_APPID
    const apiV3Key = process.env.WECHAT_API_V3_KEY
    const privateKeyPath = process.env.WECHAT_PRIVATE_KEY_PATH
    const certPath = process.env.WECHAT_CERT_PATH

    if (!mchid || !appid || !apiV3Key || !privateKeyPath || !certPath) {
        // 尝试从项目的商户配置文件加载
        return loadFromMerchantsJson()
    }

    const fs = require("fs")
    const client = new WxPay({
        appid,
        mchid,
        publicKey: Buffer.from(fs.readFileSync(certPath, "utf8")),
        privateKey: Buffer.from(fs.readFileSync(privateKeyPath, "utf8")),
    })

    return { client, mchid }
}

function loadFromMerchantsJson(): { client: WxPay; mchid: string } {
    const fs = require("fs")
    const path = require("path")

    const configFilePath = path.resolve(process.cwd(), "secrets/wechat-merchants.json")
    if (!fs.existsSync(configFilePath)) {
        console.error("❌ 未找到微信商户配置，请检查 secrets/wechat-merchants.json 或环境变量")
        process.exit(1)
    }

    const configs = JSON.parse(fs.readFileSync(configFilePath, "utf8"))
    const defaultKey = process.env.WECHAT_DEFAULT_MERCHANT_KEY
    if (!defaultKey) {
        console.error("❌ WECHAT_DEFAULT_MERCHANT_KEY 未配置")
        process.exit(1)
    }

    const config = configs[defaultKey]
    if (!config) {
        console.error(`❌ 商户配置 "${defaultKey}" 不存在`)
        process.exit(1)
    }

    const client = new WxPay({
        appid: config.appid,
        mchid: config.mchid,
        publicKey: Buffer.from(fs.readFileSync(path.resolve(process.cwd(), config.merchantCertPath), "utf8")),
        privateKey: Buffer.from(fs.readFileSync(path.resolve(process.cwd(), config.merchantPrivateKeyPath), "utf8")),
    })

    return { client, mchid: config.mchid }
}

// ============= 核心补救逻辑 =============
async function recoverOrder(outTradeNo: string) {
    console.log(`\n${"=".repeat(60)}`)
    console.log(`📋 订单补救工具`)
    console.log(`   商户订单号: ${outTradeNo}`)
    console.log(`${"=".repeat(60)}\n`)

    // 1. 查询本地订单
    console.log("🔍 步骤 1: 查询本地订单...")
    const order = await prisma.order.findUnique({
        where: { outTradeNo },
        include: { plan: true },
    })

    if (!order) {
        console.error(`❌ 订单不存在: ${outTradeNo}`)
        process.exit(1)
    }

    console.log(`   订单ID: ${order.id}`)
    console.log(`   状态: ${order.status}`)
    console.log(`   金额: ${(order.amount / 100).toFixed(2)} 元`)
    console.log(`   套餐: ${order.plan?.name || "未知"}`)
    console.log(`   创建时间: ${order.createdAt.toISOString()}`)
    if (order.userId) {
        const user = await prisma.user.findUnique({
            where: { id: order.userId },
            select: { email: true, username: true },
        })
        console.log(`   用户: ${user?.email || user?.username || order.userId}`)
    }

    // 2. 检查订单状态
    if (order.status === "PAID") {
        console.log(`\n✅ 订单已支付，无需补救`)
        if (order.paidAt) {
            console.log(`   支付时间: ${order.paidAt.toISOString()}`)
        }
        return
    }

    if (order.status !== "CLOSED") {
        console.log(`\n⚠️  订单状态为 ${order.status}，不是关闭状态，跳过补救`)
        console.log(`   提示：只有 CLOSED 状态的订单才需要补救`)
        return
    }

    console.log(`\n🚫 订单已关闭，继续检查微信侧支付状态...`)

    // 3. 向微信查询实际支付状态
    console.log("\n🔍 步骤 2: 向微信查询支付状态...")
    const { client: wxClient, mchid } = createWxClient()

    let wxResult: any
    try {
        wxResult = await wxClient.query({
            out_trade_no: outTradeNo,
        })
    } catch (err: any) {
        console.error(`❌ 微信查询失败: ${err.message}`)
        process.exit(1)
    }

    const tradeState = wxResult.data?.trade_state
    const tradeStateDesc = wxResult.data?.trade_state_desc
    console.log(`   微信返回状态: ${tradeState} (${tradeStateDesc})`)

    if (wxResult.status !== 200 || tradeState !== "SUCCESS") {
        console.log(`\n❌ 微信侧未支付，无法补救`)
        console.log(`   trade_state: ${tradeState}`)
        if (tradeState === "NOTPAY") {
            console.log(`   提示：用户尚未完成支付`)
        } else if (tradeState === "CLOSED") {
            console.log(`   提示：微信侧订单也已关闭`)
        } else if (tradeState === "REFUND") {
            console.log(`   提示：订单已退款`)
        }
        return
    }

    // 4. 微信确认已支付，执行补救
    const transactionId = wxResult.data.transaction_id
    const paidAmount = wxResult.data.amount?.total
    const successTime = wxResult.data.success_time

    console.log(`\n💰 微信确认支付成功！`)
    console.log(`   微信交易号: ${transactionId}`)
    console.log(`   支付金额: ${((paidAmount || 0) / 100).toFixed(2)} 元`)
    console.log(`   支付时间: ${successTime || "未知"}`)

    // 校验金额
    if (paidAmount !== order.amount) {
        console.error(`\n❌ 金额不匹配！订单金额=${order.amount}分，微信支付金额=${paidAmount}分`)
        console.error(`   这可能是异常情况，请人工核实后再处理`)
        process.exit(1)
    }

    console.log(`\n🔧 步骤 3: 执行补救结算...`)

    // 5. 重新打开订单并结算（事务内原子操作）
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 5a. 重新打开订单：CLOSED → PAYING
            const reopenResult = await tx.order.updateMany({
                where: {
                    id: order.id,
                    status: "CLOSED", // 只对 CLOSED 状态操作
                },
                data: {
                    status: "PAYING",
                },
            })

            if (reopenResult.count === 0) {
                throw new Error("订单状态已变更，无法重新打开（可能已被其他请求处理）")
            }

            console.log(`   ✅ 订单已重新打开 (CLOSED → PAYING)`)

            // 5b. CAS 原子结算：PAYING → PAID
            const settleResult = await tx.order.updateMany({
                where: {
                    id: order.id,
                    status: { in: ["PENDING", "PAYING", "CREATED"] },
                },
                data: {
                    status: "PAID",
                    payPlatformTradeNo: transactionId,
                    paidAt: successTime ? new Date(successTime) : new Date(),
                    notifyProcessedAt: new Date(),
                },
            })

            if (settleResult.count === 0) {
                throw new Error("结算失败：订单状态不满足 CAS 条件")
            }

            console.log(`   ✅ 订单已结算 (PAYING → PAID)`)

            // 5c. 获取最新的订单数据（含 plan）
            const freshOrder = await tx.order.findUnique({
                where: { id: order.id },
                include: { plan: true },
            })

            if (!freshOrder) {
                throw new Error("订单查询失败")
            }

            // 5d. 发放积分
            let totalCredits = 0
            if (freshOrder.userId && freshOrder.plan) {
                const plan = freshOrder.plan
                if (plan.type === "CREDIT") {
                    totalCredits = plan.credits + plan.giftCredits

                    await tx.user.update({
                        where: { id: freshOrder.userId },
                        data: {
                            credits: { increment: totalCredits },
                        },
                    })

                    await tx.creditRecord.create({
                        data: {
                            userId: freshOrder.userId,
                            amount: totalCredits,
                            type: "RECHARGE",
                            description: `购买${plan.name}：积分+${plan.credits}${plan.giftCredits > 0 ? `(赠送${plan.giftCredits})` : ""} [补救结算]`,
                        },
                    })

                    console.log(`   ✅ 已发放 ${totalCredits} 积分给用户`)
                }
            }

            // 5e. 分润（代理佣金）
            if (freshOrder.userId) {
                const commissionResult = await distributeCommissionTx(
                    tx,
                    freshOrder.userId,
                    freshOrder.amount,
                    "WECHAT",
                    freshOrder.id
                )

                if (commissionResult.skipped) {
                    console.log(`   ⚠️  佣金已存在，跳过分润（幂等）`)
                } else if (commissionResult.distributed.length > 0) {
                    console.log(`   ✅ 佣金分润完成:`)
                    for (const d of commissionResult.distributed) {
                        const levelName = d.level === 1 ? "直推" : d.level === 2 ? "管理" : "顶级"
                        console.log(`      ${levelName}: ${d.earnerId.slice(0, 12)}... 获得 ${(d.amount / 100).toFixed(2)} 元 (${d.rate}%)`)
                    }
                } else {
                    console.log(`   ℹ️  无佣金分润（用户无代理上级）`)
                }
            }

            // 5f. 活动拉新记录
            if (freshOrder.userId) {
                const buyer = await tx.user.findUnique({
                    where: { id: freshOrder.userId },
                    select: { invitedById: true },
                })

                if (buyer?.invitedById) {
                    const now = new Date()
                    const activeActivity = await tx.activity.findFirst({
                        where: {
                            isActive: true,
                            startTime: { lte: now },
                            endTime: { gte: now },
                        },
                        select: { id: true },
                        orderBy: { createdAt: "desc" },
                    })

                    if (activeActivity) {
                        await tx.activityReferral.upsert({
                            where: {
                                activityId_orderId: {
                                    activityId: activeActivity.id,
                                    orderId: freshOrder.id,
                                },
                            },
                            create: {
                                activityId: activeActivity.id,
                                inviterId: buyer.invitedById,
                                inviteeId: freshOrder.userId,
                                rechargeAmount: freshOrder.amount,
                                orderId: freshOrder.id,
                            },
                            update: {},
                        })
                        console.log(`   ✅ 活动拉新记录已写入`)
                    }
                }
            }

            return {
                orderId: freshOrder.id,
                userId: freshOrder.userId,
                credits: totalCredits,
                transactionId,
            }
        }, {
            isolationLevel: "Serializable",
            timeout: 15000,
        })

        // 6. 输出最终结果
        console.log(`\n${"=".repeat(60)}`)
        console.log(`🎉 补救成功！`)
        console.log(`${"=".repeat(60)}`)
        console.log(`   订单号: ${outTradeNo}`)
        console.log(`   订单ID: ${result.orderId}`)
        console.log(`   微信交易号: ${result.transactionId}`)
        if (result.credits > 0) {
            console.log(`   发放积分: ${result.credits}`)
        }
        console.log(`   补救时间: ${new Date().toISOString()}`)
        console.log(`${"=".repeat(60)}\n`)

    } catch (err: any) {
        console.error(`\n❌ 补救失败: ${err.message}`)
        throw err
    }
}

// ============= 主入口 =============
async function main() {
    const outTradeNo = process.argv[2]

    if (!outTradeNo) {
        console.error("❌ 请提供商户订单号")
        console.error("用法: npx tsx scripts/recover-closed-order.ts <商户订单号>")
        console.error("示例: npx tsx scripts/recover-closed-order.ts WX_1712345678900_ABCD1234")
        process.exit(1)
    }

    await recoverOrder(outTradeNo.trim())
}

main()
    .catch((e) => {
        console.error("❌ 脚本执行失败:", e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
