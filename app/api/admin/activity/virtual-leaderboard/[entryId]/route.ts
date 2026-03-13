import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/check-admin"
import { prisma } from "@/lib/prisma"

// ============================================================
// 管理员：单条虚拟排行榜操作
// PUT    /api/admin/activity/virtual-leaderboard/[entryId]    更新
// DELETE /api/admin/activity/virtual-leaderboard/[entryId]    删除
// ============================================================

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const check = await requireAdmin()
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { entryId } = await params
  const body = await req.json()
  const { fakeName, fakeAvatar, fakeAmount } = body

  const updated = await prisma.virtualLeaderboard.update({
    where: { id: entryId },
    data: {
      ...(fakeName !== undefined && { fakeName }),
      ...(fakeAvatar !== undefined && { fakeAvatar }),
      ...(typeof fakeAmount === "number" && { fakeAmount }),
    },
  })

  return NextResponse.json({ entry: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const check = await requireAdmin()
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { entryId } = await params
  await prisma.virtualLeaderboard.delete({ where: { id: entryId } })

  return NextResponse.json({ success: true })
}
