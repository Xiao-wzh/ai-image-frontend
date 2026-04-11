import { NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/tasks/pending-count
// 纯计数接口，只返回待处理任务数量，不做状态同步
export async function GET() {
  const session = await auth()
  const userId = session?.user?.id || null
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const pendingStatuses = { in: ["PENDING", "PROCESSING"] as string[] }

    const [imageCount, videoCount] = await Promise.all([
      prisma.generation.count({ where: { userId, status: pendingStatuses } }),
      prisma.videoGeneration.count({ where: { userId, status: pendingStatuses } }),
    ])

    return NextResponse.json({
      count: imageCount + videoCount,
      pendingVideoCount: videoCount,
    })
  } catch (err: any) {
    const message = err?.message || String(err)
    console.error("❌ pending-count API 错误:", message)
    return NextResponse.json({ error: "查询失败", message }, { status: 500 })
  }
}
