import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 定时任务密钥
const CRON_SECRET = process.env.CRON_SECRET || ""

// 超时时间（毫秒）- 默认 5 分钟
const STALLED_TIMEOUT_MS = parseInt(process.env.APPEAL_STALLED_TIMEOUT || "300000", 10)

/**
 * GET /api/cron/check-stalled-appeals
 * 定时检查卡在 PROCESSING 状态超过指定时间的申诉，自动转人工
 *
 * Query params:
 * - secret: 定时任务密钥
 */
export async function GET(req: NextRequest) {
    // 1. 安全校验
    const { searchParams } = req.url ? new URL(req.url) : new URL(req.url || "/", "http://localhost")
    const secret = searchParams.get("secret")

    if (!CRON_SECRET || secret !== CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const cutoffTime = new Date(Date.now() - STALLED_TIMEOUT_MS)

        // 2. 查找超时的申诉记录
        const stalledAppeals = await prisma.appeal.findMany({
            where: {
                status: "PROCESSING",
                updatedAt: { lt: cutoffTime },
            },
        })

        if (stalledAppeals.length === 0) {
            return NextResponse.json({
                success: true,
                message: "没有超时的申诉记录",
                checkedCount: 0,
                fixedCount: 0,
            })
        }

        // 3. 批量更新为待人工审核
        const updateResult = await prisma.appeal.updateMany({
            where: {
                id: { in: stalledAppeals.map(a => a.id) },
            },
            data: {
                status: "PENDING_MANUAL_REVIEW",
                aiAnalysis: `AI 审核超时（超过 ${Math.round(STALLED_TIMEOUT_MS / 60000)} 分钟未响应），已自动转人工审核`,
                aiConfidence: 0,
            },
        })

        console.log(`[超时检查] 发现 ${stalledAppeals.length} 条超时申诉，已转人工审核`)

        return NextResponse.json({
            success: true,
            message: `已处理 ${updateResult.count} 条超时申诉`,
            checkedCount: stalledAppeals.length,
            fixedCount: updateResult.count,
            stalledAppealIds: stalledAppeals.map(a => a.id),
        })
    } catch (err: any) {
        console.error("[超时检查] 失败:", err?.message || err)
        return NextResponse.json({ error: "检查失败", message: err?.message }, { status: 500 })
    }
}
