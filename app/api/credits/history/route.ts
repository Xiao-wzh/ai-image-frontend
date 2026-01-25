import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)

  // Pagination parameters
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")))
  const skip = (page - 1) * limit

  // Date filter parameters
  const startDate = searchParams.get("startDate") || null
  const endDate = searchParams.get("endDate") || null

  // Build where conditions
  const whereConditions: any = { userId }

  if (startDate) {
    whereConditions.createdAt = {
      ...whereConditions.createdAt,
      gte: new Date(startDate),
    }
  }

  if (endDate) {
    const endOfDay = new Date(endDate)
    endOfDay.setHours(23, 59, 59, 999)
    whereConditions.createdAt = {
      ...whereConditions.createdAt,
      lte: endOfDay,
    }
  }

  // Fetch records and total count in parallel
  const [records, total] = await Promise.all([
    prisma.creditRecord.findMany({
      where: whereConditions,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        amount: true,
        type: true,
        description: true,
        createdAt: true,
      },
    }),
    prisma.creditRecord.count({ where: whereConditions }),
  ])

  const totalPages = Math.ceil(total / limit)

  return NextResponse.json({
    records,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  })
}


