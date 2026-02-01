import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const email = String(body?.email ?? "").trim().toLowerCase()
    const code = String(body?.code ?? "").trim()
    const newPassword = String(body?.newPassword ?? "").trim()

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "密码长度至少 6 位" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: "该邮箱未注册" }, { status: 404 })
    }

    const record = await prisma.verificationCode.findFirst({
      where: { email, code },
      orderBy: { createdAt: "desc" },
    })

    if (!record) {
      return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 })
    }

    if (record.expires < new Date()) {
      await prisma.verificationCode.delete({ where: { id: record.id } }).catch(() => {})
      return NextResponse.json({ error: "验证码已过期，请重新获取" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      })

      await tx.verificationCode.delete({ where: { id: record.id } })

      await tx.verificationCode.deleteMany({
        where: {
          email,
          expires: { lt: new Date() },
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: "重置失败", message: error?.message || "未知错误" }, { status: 500 })
  }
}

