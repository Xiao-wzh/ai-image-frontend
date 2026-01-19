import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/check-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SortField = "createdAt" | "credits" | "totalConsumed"
type SortOrder = "asc" | "desc"

export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") // "active" | "inactive" | null (all)
  const sortBy = (searchParams.get("sortBy") || "createdAt") as SortField
  const sortOrder = (searchParams.get("sortOrder") || "desc") as SortOrder
  const limit = Math.min(Number(searchParams.get("limit") || 200), 500)
  const offset = Math.max(Number(searchParams.get("offset") || 0), 0)

  // 48 hours ago threshold
  const activeThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000)

  // Fetch users with their credit records
  const users = await prisma.user.findMany({
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
      // Get most recent credit consumption record
      creditRecords: {
        where: { amount: { lt: 0 } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, amount: true },
      },
    },
    take: limit,
    skip: offset,
  })

  // Transform to include lastActiveAt and totalConsumed
  const usersWithActivity = users.map(user => {
    const lastCreditRecord = user.creditRecords[0]
    const lastActiveAt = lastCreditRecord?.createdAt || null
    // Sum all negative amounts (consumption)
    const totalConsumed = user.creditRecords.reduce((sum, r) => sum + Math.abs(r.amount), 0)
    const { creditRecords, ...rest } = user
    return {
      ...rest,
      lastActiveAt,
      isActive: lastActiveAt ? new Date(lastActiveAt) >= activeThreshold : false,
      totalConsumed,
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

  // Sort by credits or totalConsumed (in-memory since Prisma can't aggregate)
  if (sortBy === "credits") {
    filteredUsers.sort((a, b) => {
      const diff = a.totalCredits - b.totalCredits
      return sortOrder === "desc" ? -diff : diff
    })
  } else if (sortBy === "totalConsumed") {
    filteredUsers.sort((a, b) => {
      const diff = a.totalConsumed - b.totalConsumed
      return sortOrder === "desc" ? -diff : diff
    })
  }

  // Get counts for stats
  const activeCount = usersWithActivity.filter(u => u.isActive).length
  const inactiveCount = usersWithActivity.filter(u => !u.isActive).length

  return NextResponse.json({
    success: true,
    users: filteredUsers,
    stats: {
      total: users.length,
      active: activeCount,
      inactive: inactiveCount,
    },
  })
}

/**
 * POST /api/admin/users
 * Gift credits to a user
 * Body: { userId, amount, reason? }
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
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

    // Check user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, bonusCredits: true },
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    // Add bonus credits and create record
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
          description: reason?.trim() || `管理员赠送 ${giftAmount} 积分`,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: `已成功赠送 ${giftAmount} 积分给 ${user.email}`,
    })
  } catch (err: any) {
    console.error("[Admin Gift Credits] Error:", err)
    return NextResponse.json({ error: "赠送失败" }, { status: 500 })
  }
}
