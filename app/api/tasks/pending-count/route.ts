import { NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/tasks/pending-count → { count: number }
// 轻量级接口，仅返回 PENDING/PROCESSING 任务数量（约 30B），替代原来拉取 50 条完整记录（约 89KB）
export async function GET() {
  const session = await auth()
  const userId = session?.user?.id || null
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const count = await prisma.generation.count({
      where: {
        userId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
    })
    return NextResponse.json({ count })
  } catch (err: any) {
    const message = err?.message || String(err)
    console.error("❌ pending-count API 错误:", message)
    return NextResponse.json({ error: "查询失败", message }, { status: 500 })
  }
}
