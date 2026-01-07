import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { REGISTRATION_BONUS, INVITE_CODE_BONUS } from "@/lib/constants"
import { normalizeEmail } from "@/lib/normalize-email"
import { checkRegistrationRateLimit, recordRegistrationSuccess } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 获取客户端 IP
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  const realIp = req.headers.get("x-real-ip")
  if (realIp) {
    return realIp
  }
  return "127.0.0.1"
}

// 生成6位随机推广码（大写字母+数字）
function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // 排除容易混淆的字符 I/1, O/0
  let result = ""
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 确保推广码唯一
async function generateUniqueReferralCode(): Promise<string> {
  let code = generateReferralCode()
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    const existing = await prisma.user.findUnique({
      where: { referralCode: code },
    })
    if (!existing) {
      return code
    }
    code = generateReferralCode()
    attempts++
  }

  // 如果多次尝试后仍冲突，添加时间戳后缀
  return code + Date.now().toString(36).slice(-2).toUpperCase()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, username, password, code, inviteCode, deviceId } = body

    // 0. 频率限制检查
    const clientIp = getClientIp(req)
    const rateCheck = await checkRegistrationRateLimit(clientIp, deviceId)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.reason || "操作过于频繁" },
        { status: 429 }
      )
    }

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

    // 限制只允许 QQ邮箱
    const emailLower = email.toLowerCase().trim()
    if (!emailLower.endsWith("@qq.com")) {
      return NextResponse.json(
        { error: "仅支持 QQ邮箱注册" },
        { status: 400 }
      )
    }

    // QQ邮箱只支持纯数字前缀（如 123456@qq.com）
    if (emailLower.endsWith("@qq.com")) {
      const qqPrefix = emailLower.split("@")[0]
      if (!/^\d+$/.test(qqPrefix)) {
        return NextResponse.json(
          { error: "QQ邮箱仅支持纯数字格式（如 123456@qq.com）" },
          { status: 400 }
        )
      }
    }

    // 验证用户名格式
    // 规则: 6-12个字符，只允许字母、数字、下划线，必须以字母开头
    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{5,11}$/
    if (!usernameRegex.test(username.trim())) {
      return NextResponse.json(
        { error: "用户名需6-12个字符，只能包含字母、数字和下划线，且必须以字母开头" },
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

    // 3. 检查邮箱和用户名是否已存在（双保险：原始邮箱 + 归一化邮箱）
    const emailLowerTrimmed = email.trim().toLowerCase()
    const normalizedEmailValue = normalizeEmail(email)

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailLowerTrimmed },
          { normalizedEmail: normalizedEmailValue },
          { username: username.trim() },
        ],
      },
    })

    if (existingUser) {
      if (existingUser.email === emailLowerTrimmed || existingUser.normalizedEmail === normalizedEmailValue) {
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

    // 安全检查：禁止用户名与其他用户的邮箱相同（防止登录欺骗）
    const usernameAsEmail = await prisma.user.findUnique({
      where: { email: username.trim() },
    })
    if (usernameAsEmail) {
      return NextResponse.json(
        { error: "该用户名不可用" },
        { status: 400 }
      )
    }

    // 4. 验证邀请码（如果提供）
    let inviter = null
    if (inviteCode?.trim()) {
      inviter = await prisma.user.findUnique({
        where: { referralCode: inviteCode.trim().toUpperCase() },
        select: { id: true, email: true },
      })
      if (!inviter) {
        return NextResponse.json(
          { error: "邀请码无效" },
          { status: 400 }
        )
      }
    }

    // 5. 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 6. 生成唯一推广码
    const referralCode = await generateUniqueReferralCode()

    // 7. 计算初始积分（使用全局配置）
    const inviteBonus = inviter ? INVITE_CODE_BONUS : 0
    const initialBonusCredits = REGISTRATION_BONUS + inviteBonus

    // 8. 创建用户（使用事务）
    const user = await prisma.$transaction(async (tx) => {
      // 创建用户
      const newUser = await tx.user.create({
        data: {
          email: emailLowerTrimmed,
          normalizedEmail: normalizedEmailValue,
          username: username.trim(),
          password: hashedPassword,
          emailVerified: new Date(),
          referralCode,
          invitedById: inviter?.id || null,
          bonusCredits: initialBonusCredits,
        },
      })

      // 如果有邀请人，记录邀请奖励
      if (inviter && inviteBonus > 0) {
        await tx.creditRecord.create({
          data: {
            userId: newUser.id,
            amount: inviteBonus,
            type: "SYSTEM_REWARD",
            description: "邀请码注册奖励",
          },
        })
      }

      return newUser
    })

    // 9. 删除已使用的验证码
    await prisma.verificationCode.delete({
      where: { id: verificationCode.id },
    })

    console.log(`✅ 用户注册成功: ${user.email} (${user.username})${inviter ? ` - 由 ${inviter.email} 邀请` : ""}`)

    // 记录成功注册（限流计数）
    await recordRegistrationSuccess(clientIp, deviceId)

    return NextResponse.json({
      success: true,
      message: inviter ? "注册成功！已获得 200 邀请奖励积分" : "注册成功",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        referralCode: user.referralCode,
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
