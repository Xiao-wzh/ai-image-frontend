import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, username, password, code } = body

    // 1. 验证必填字段
    if (!email?.trim() || !username?.trim() || !password?.trim() || !code?.trim()) {
      return NextResponse.json(
        { error: "所有字段都是必填的" },
        { status: 400 }
      )
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 })
    }

    // 限制只允许 QQ邮箱 和 Gmail 邮箱
    const emailLower = email.toLowerCase().trim()
    const allowedDomains = ["@qq.com", "@gmail.com"]
    const isAllowedDomain = allowedDomains.some(domain => emailLower.endsWith(domain))
    if (!isAllowedDomain) {
      return NextResponse.json(
        { error: "仅支持 QQ邮箱 和 Gmail 邮箱注册" },
        { status: 400 }
      )
    }

    // 验证用户名长度
    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: "用户名长度应在 3-20 个字符之间" },
        { status: 400 }
      )
    }

    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码长度至少 6 个字符" },
        { status: 400 }
      )
    }

    // 2. 验证验证码
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        email: email.trim(),
        code: code.trim(),
      },
    })

    if (!verificationCode) {
      return NextResponse.json(
        { error: "验证码错误或已过期" },
        { status: 400 }
      )
    }

    // 检查是否过期
    if (verificationCode.expires < new Date()) {
      // 删除过期的验证码
      await prisma.verificationCode.delete({
        where: { id: verificationCode.id },
      })
      return NextResponse.json(
        { error: "验证码已过期，请重新获取" },
        { status: 400 }
      )
    }

    // 3. 检查邮箱和用户名是否已存在
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.trim() },
          { username: username.trim() },
        ],
      },
    })

    if (existingUser) {
      if (existingUser.email === email.trim()) {
        return NextResponse.json(
          { error: "该邮箱已被注册" },
          { status: 400 }
        )
      }
      if (existingUser.username === username.trim()) {
        return NextResponse.json(
          { error: "该用户名已被使用" },
          { status: 400 }
        )
      }
    }

    // 4. 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 5. 创建用户
    const user = await prisma.user.create({
      data: {
        email: email.trim(),
        username: username.trim(),
        password: hashedPassword,
        emailVerified: new Date(), // 验证码验证通过，标记邮箱已验证
      },
    })

    // 6. 删除已使用的验证码
    await prisma.verificationCode.delete({
      where: { id: verificationCode.id },
    })

    console.log(`✅ 用户注册成功: ${user.email} (${user.username})`)

    return NextResponse.json({
      success: true,
      message: "注册成功",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    })
  } catch (error: any) {
    console.error("❌ 注册失败:", error)
    return NextResponse.json(
      {
        error: "注册失败",
        message: error?.message || "未知错误",
      },
      { status: 500 }
    )
  }
}

