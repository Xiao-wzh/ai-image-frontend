import { NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 隐私保护：遮蔽邮箱/用户名
function maskIdentifier(email: string | null, username: string | null): string {
    if (username) {
        if (username.length <= 2) return username[0] + "***"
        return username[0] + "***" + username.slice(-1)
    }
    if (email) {
        const [local, domain] = email.split("@")
        if (local.length <= 2) return local[0] + "***@" + domain
        return local[0] + "***" + local.slice(-1) + "@" + domain
    }
    return "用户***"
}

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "未登录" }, { status: 401 })
        }

        const userId = session.user.id

        // 获取用户推广码
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { referralCode: true },
        })

        if (!user) {
            return NextResponse.json({ error: "用户不存在" }, { status: 404 })
        }

        // 统计数据
        const [totalInvited, totalEarnedResult, recentRecords] = await Promise.all([
            // 邀请人数
            prisma.user.count({
                where: { invitedById: userId },
            }),
            // 总佣金
            prisma.referralRecord.aggregate({
                where: { inviterId: userId },
                _sum: { amount: true },
            }),
            // 最近10条返佣记录
            prisma.referralRecord.findMany({
                where: { inviterId: userId },
                orderBy: { createdAt: "desc" },
                take: 10,
                include: {
                    invitee: {
                        select: { username: true, email: true },
                    },
                },
            }),
        ])

        // 格式化历史记录（隐私保护）
        const history = recentRecords.map((record) => ({
            id: record.id,
            amount: record.amount,
            sourceType: record.sourceType,
            invitee: maskIdentifier(record.invitee.email, record.invitee.username),
            createdAt: record.createdAt,
        }))

        return NextResponse.json({
            code: user.referralCode,
            totalInvited,
            totalEarned: totalEarnedResult._sum.amount || 0,
            history,
        })
    } catch (error) {
        console.error("获取推广统计失败:", error)
        return NextResponse.json({ error: "获取失败" }, { status: 500 })
    }
}
