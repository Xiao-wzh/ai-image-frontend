import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const codeRaw = String(body?.code ?? "").trim()

  if (!codeRaw) {
    return NextResponse.json({ error: "请输入卡密" }, { status: 400 })
  }

  const code = codeRaw.toUpperCase()

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) 锁定兑换码行，确保并发只会有一个人核销成功
      const rows = await tx.$queryRaw<
        Array<{ id: string; credits: number; bonus: number; status: string; usedBy: string | null }>
      >`SELECT "id", "credits", "bonus", "status", "usedBy" FROM "RedemptionCode" WHERE "code" = ${code} FOR UPDATE`

      if (rows.length === 0) {
        return { ok: false as const, status: 400 as const, error: "卡密不存在" }
      }

      const row = rows[0]
      if (row.status !== "UNUSED") {
        return { ok: false as const, status: 400 as const, error: "卡密已被使用" }
      }

      const paid = row.credits ?? 0
      const bonus = row.bonus ?? 0

      // 2) 标记兑换码已使用
      await tx.redemptionCode.update({
        where: { id: row.id },
        data: {
          status: "USED",
          usedBy: userId,
          usedAt: new Date(),
        },
      })

      // 3) 给用户加积分（paid + bonus）
      await tx.user.update({
        where: { id: userId },
        data: {
          credits: paid > 0 ? { increment: paid } : undefined,
          bonusCredits: bonus > 0 ? { increment: bonus } : undefined,
        },
        select: { id: true },
      })

      // 4) 写入用户可见的流水：只记录总变动
      const total = paid + bonus
      await tx.creditRecord.create({
        data: {
          userId,
          amount: total,
          type: "RECHARGE",
          description: bonus > 0 ? `兑换卡密：积分+${paid} 赠送积分+${bonus}` : `兑换卡密：积分+${paid}`,
        },
      })

      // 5) 返回最新余额
      const userAfter = await tx.user.findUnique({
        where: { id: userId },
        select: { credits: true, bonusCredits: true },
      })

      return {
        ok: true as const,
        paid,
        bonus,
        credits: userAfter?.credits ?? 0,
        bonusCredits: userAfter?.bonusCredits ?? 0,
      }
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      success: true,
      message: "兑换成功",
      added: {
        credits: result.paid,
        bonusCredits: result.bonus,
      },
      balance: {
        credits: result.credits,
        bonusCredits: result.bonusCredits,
        totalCredits: result.credits + result.bonusCredits,
      },
    })
  } catch (e: any) {
    console.error("❌ 兑换卡密失败:", e)
    return NextResponse.json({ error: "兑换失败，请稍后重试" }, { status: 500 })
  }
}

