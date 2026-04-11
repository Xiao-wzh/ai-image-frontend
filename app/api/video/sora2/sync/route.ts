import { NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { syncVideoTaskStatus } from "@/lib/video/sync-status"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/video/sora2/sync
// 同步进行中视频任务的最新状态（查询云雾 API → 更新数据库）
// 由前端在检测到 pendingVideoCount > 0 时按需调用
export async function POST() {
  const session = await auth()
  const userId = session?.user?.id || null
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  try {
    const pendingStatuses = { in: ["PENDING", "PROCESSING"] as string[] }

    // 找到所有进行中的视频任务
    const pendingTasks = await prisma.videoGeneration.findMany({
      where: { userId, status: pendingStatuses },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })

    if (pendingTasks.length === 0) {
      return NextResponse.json({ success: true, completed: [], count: 0 })
    }

    // 并行同步（最多 3 条，各任务内部有事务锁互不干扰）
    const justCompleted: { id: string; prompt: string }[] = []
    const tasksToSync = pendingTasks.slice(0, 3)

    const results = await Promise.allSettled(
      tasksToSync.map(t => syncVideoTaskStatus(t.id))
    )

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === "fulfilled" && r.value === "COMPLETED") {
        const record = await prisma.videoGeneration.findUnique({
          where: { id: tasksToSync[i].id },
          select: { id: true, prompt: true },
        })
        if (record) {
          justCompleted.push({ id: record.id, prompt: record.prompt })
        }
      }
    }

    // 返回刚完成的任务列表（前端用来弹 toast）
    return NextResponse.json({
      success: true,
      completed: justCompleted,
      count: pendingTasks.length,
    })
  } catch (err: any) {
    const message = err?.message || String(err)
    console.error("[SORA2] sync 接口错误:", message)
    return NextResponse.json({ error: "同步失败", message }, { status: 500 })
  }
}
