import { NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { DAILY_CHECKIN_REWARD } from "@/lib/constants"
/**
 * 检查用户是否可以打卡
 * 比较用户的 lastCheckIn 日期与当前服务器日期
 */
function isSameDay(date1: Date, date2: Date): boolean {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    )
}

/**
 * 获取下一次可打卡时间（次日0点）
 */
function getNextCheckInTime(lastCheckIn: Date): Date {
    const next = new Date(lastCheckIn)
    next.setDate(next.getDate() + 1)
    next.setHours(0, 0, 0, 0)
    return next
}

// GET: 检查打卡状态
export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "未登录" }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { lastCheckIn: true },
        })

        if (!user) {
            return NextResponse.json({ error: "用户不存在" }, { status: 404 })
        }

        const now = new Date()
        let canCheckIn = true
        let nextCheckIn: Date | null = null

        if (user.lastCheckIn) {
            canCheckIn = !isSameDay(user.lastCheckIn, now)
            if (!canCheckIn) {
                nextCheckIn = getNextCheckInTime(user.lastCheckIn)
            }
        }

        return NextResponse.json({
            canCheckIn,
            lastCheckIn: user.lastCheckIn,
            nextCheckIn,
        })
    } catch (error) {
        console.error("获取打卡状态失败:", error)
        return NextResponse.json({ error: "获取失败" }, { status: 500 })
    }
}

// POST: 执行打卡
export async function POST() {
    return NextResponse.json({ error: "活动未开始" }, { status: 500 })
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "未登录" }, { status: 401 })
        }

        const userId = session.user.id
        const now = new Date()



        // 使用事务确保原子操作
        const result = await prisma.$transaction(async (tx) => {
            // 获取用户当前状态
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { lastCheckIn: true, bonusCredits: true },
            })

            if (!user) {
                throw new Error("用户不存在")
            }

            // 再次检查是否可以打卡（防止重复打卡）
            if (user.lastCheckIn && isSameDay(user.lastCheckIn, now)) {
                throw new Error("今日已打卡")
            }



            // 更新用户积分和打卡时间
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {
                    bonusCredits: { increment: DAILY_CHECKIN_REWARD },
                    lastCheckIn: now,
                },
                select: { credits: true, bonusCredits: true },
            })

            // 创建积分记录
            await tx.creditRecord.create({
                data: {
                    userId,
                    amount: DAILY_CHECKIN_REWARD,
                    type: "DAILY_REWARD",
                    description: "每日打卡奖励",
                },
            })

            return {
                newCredits: updatedUser.credits,
                newBonusCredits: updatedUser.bonusCredits,
                totalCredits: updatedUser.credits + updatedUser.bonusCredits,
            }
        })

        return NextResponse.json({
            success: true,
            message: `打卡成功，获得 ${DAILY_CHECKIN_REWARD} 积分！`,
            ...result,
        })
    } catch (error: any) {
        console.error("打卡失败:", error)

        if (error.message === "今日已打卡") {
            return NextResponse.json({ error: "今日已打卡" }, { status: 400 })
        }
        if (error.message === "用户不存在") {
            return NextResponse.json({ error: "用户不存在" }, { status: 404 })
        }

        return NextResponse.json({ error: "打卡失败" }, { status: 500 })
    }
}
