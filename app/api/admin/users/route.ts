import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireReviewerOrAdminForUsers, REVIEWER_GIFT_LIMIT } from "@/lib/check-admin"
import { revalidateTag } from "next/cache"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = {
    tags: ["admin-users"]
}

type SortField = "createdAt" | "credits" | "totalConsumed" | "totalRecharged"
type SortOrder = "asc" | "desc"

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

export async function GET(req: NextRequest) {
    const guard = await requireReviewerOrAdminForUsers()
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const { searchParams } = new URL(req.url)

    // Pagination params
    const page = Math.max(Number(searchParams.get("page") || 1), 1)
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE)

    // Filter and sort params
    const status = searchParams.get("status") // "active" | "inactive" | null (all)
    const sortBy = (searchParams.get("sortBy") || "createdAt") as SortField
    const sortOrder = (searchParams.get("sortOrder") || "desc") as SortOrder
    const search = searchParams.get("search")?.trim() || ""

    // 48 hours ago threshold
    const activeThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000)

    // Build where clause for search
    const whereClause = search ? {
        OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { username: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
        ],
    } : {}

    // For computed field sorting (credits, totalConsumed), we need to:
    // 1. Fetch ALL matching users
    // 2. Compute the values
    // 3. Sort
    // 4. Paginate in memory
    // For createdAt sorting, we can use Prisma directly

    // Fetch ALL users matching the search criteria (for proper sorting)
    const allUsers = await prisma.user.findMany({
        where: whereClause,
        orderBy: sortBy === "createdAt" ? [{ createdAt: sortOrder }] : [{ createdAt: "desc" }],
        select: {
            id: true,
            email: true,
            username: true,
            name: true,
            role: true,
            credits: true,
            bonusCredits: true,
            createdAt: true,
            creditRecords: {
                where: { amount: { lt: 0 } },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true, amount: true },
            },
            orders: {
                where: { status: "PAID" },
                select: { amount: true },
            },
        },
    })

    // Transform to include lastActiveAt, totalConsumed and totalRecharged
    const usersWithActivity = allUsers.map(user => {
        const lastCreditRecord = user.creditRecords[0]
        const lastActiveAt = lastCreditRecord?.createdAt || null
        const totalConsumed = user.creditRecords.reduce((sum, r) => sum + Math.abs(r.amount), 0)
        const totalRecharged = user.orders.reduce((sum, o) => sum + (o.amount || 0), 0)
        const { creditRecords, orders, ...rest } = user
        return {
            ...rest,
            lastActiveAt,
            isActive: lastActiveAt ? new Date(lastActiveAt) >= activeThreshold : false,
            totalConsumed,
            totalRecharged,
            totalCredits: user.credits + user.bonusCredits,
        }
    })

    // Filter by status if specified
    let filteredUsers = usersWithActivity
    if (status === "active") {
        filteredUsers = usersWithActivity.filter(u => u.isActive)
    } else if (status === "inactive") {
        filteredUsers = usersWithActivity.filter(u => !u.isActive)
    }

    // Sort by the selected field (now sorting ALL data before pagination)
    if (sortBy === "createdAt") {
        // Already sorted by Prisma
    } else if (sortBy === "credits") {
        filteredUsers.sort((a, b) => {
            const diff = a.totalCredits - b.totalCredits
            return sortOrder === "desc" ? -diff : diff
        })
    } else if (sortBy === "totalConsumed") {
        filteredUsers.sort((a, b) => {
            const diff = a.totalConsumed - b.totalConsumed
            return sortOrder === "desc" ? -diff : diff
        })
    } else if (sortBy === "totalRecharged") {
        filteredUsers.sort((a, b) => {
            const diff = a.totalRecharged - b.totalRecharged
            return sortOrder === "desc" ? -diff : diff
        })
    }

    // Calculate total for pagination (after filtering)
    const totalCount = filteredUsers.length

    // Paginate in memory
    const skip = (page - 1) * limit
    const paginatedUsers = filteredUsers.slice(skip, skip + limit)

    // Get counts for stats
    const activeCount = usersWithActivity.filter(u => u.isActive).length
    const inactiveCount = usersWithActivity.filter(u => !u.isActive).length

    // 今日新增用户数
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayNewCount = usersWithActivity.filter(u => new Date(u.createdAt) >= today).length

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
        success: true,
        users: paginatedUsers,
        pagination: {
            total: totalCount,
            page,
            limit,
            totalPages,
        },
        stats: {
            total: allUsers.length,
            active: activeCount,
            inactive: inactiveCount,
            todayNew: todayNewCount,
        },
    })
}

/**
 * POST /api/admin/users
 * Gift credits to a user
 * Body: { userId, amount, reason? }
 */
export async function POST(req: NextRequest) {
    const guard = await requireReviewerOrAdminForUsers()
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    try {
        const body = await req.json()
        const { userId, amount, reason } = body

        if (!userId || typeof userId !== "string") {
            return NextResponse.json({ error: "缺少用户ID" }, { status: 400 })
        }

        const giftAmount = Number(amount)
        if (!Number.isFinite(giftAmount) || giftAmount <= 0) {
            return NextResponse.json({ error: "积分数量必须为正整数" }, { status: 400 })
        }

        // 审核员单次赠送限额检查
        if (guard.role === "REVIEWER" && giftAmount > REVIEWER_GIFT_LIMIT) {
            return NextResponse.json(
                { error: `审核员单次赠送积分上限为 ${REVIEWER_GIFT_LIMIT} 积分` },
                { status: 400 }
            )
        }

        // 检查用户是否存在
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, bonusCredits: true },
        })

        if (!user) {
            return NextResponse.json({ error: "用户不存在" }, { status: 404 })
        }

        // 添加赠送积分并创建记录
        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { bonusCredits: { increment: giftAmount } },
            }),
            prisma.creditRecord.create({
                data: {
                    userId,
                    amount: giftAmount,
                    type: "GIFT",
                    description: reason?.trim() || (guard.role === "REVIEWER" ? "审核员" : "管理员") + `赠送 ${giftAmount} 积分`,
                },
            }),
        ])

        // 刷新缓存
        revalidateTag("admin-users")

        return NextResponse.json({
            success: true,
            message: `已成功赠送 ${giftAmount} 积分给 ${user.email}`,
        })
    } catch (err: any) {
        console.error("[Admin Gift Credits] Error:", err)
        return NextResponse.json({ error: "赠送失败" }, { status: 500 })
    }
}
