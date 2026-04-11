import { NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/user/credits
// 返回当前用户的实时积分余额
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { credits: true, bonusCredits: true },
  })

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 })
  }

  const credits = user.credits ?? 0
  const bonusCredits = user.bonusCredits ?? 0

  return NextResponse.json({
    credits,
    bonusCredits,
    total: credits + bonusCredits,
  })
}
