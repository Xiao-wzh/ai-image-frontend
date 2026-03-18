import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { createTransport } from "nodemailer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 生成 6 位随机验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email?.trim()

    // 验证邮箱
    if (!email) {
      return NextResponse.json({ error: "邮箱地址不能为空" }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 })
    }

    // 限制只允许 QQ邮箱（纯数字格式）
    const emailLower = email.toLowerCase()
    if (!emailLower.endsWith("@qq.com")) {
      return NextResponse.json(
        { error: "仅支持 QQ邮箱注册" },
        { status: 400 }
      )
    }

    // QQ邮箱只支持纯数字前缀
    const qqPrefix = emailLower.split("@")[0]
    if (!/^\d+$/.test(qqPrefix)) {
      return NextResponse.json(
        { error: "QQ邮箱仅支持纯数字格式（如 123456@qq.com）" },
        { status: 400 }
      )
    }

    // 检查邮箱是否已注册
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "该邮箱已被注册，请直接登录" },
        { status: 400 }
      )
    }

    // 检查是否频繁发送（1分钟内只能发送一次）
    const recentCode = await prisma.verificationCode.findFirst({
      where: {
        email,
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000), // 1分钟内
        },
      },
    })

    if (recentCode) {
      return NextResponse.json(
        { error: "发送过于频繁，请稍后再试" },
        { status: 429 }
      )
    }

    // 生成验证码
    const code = generateCode()
    const expires = new Date(Date.now() + 5 * 60 * 1000) // 5分钟后过期

    // 保存到数据库
    await prisma.verificationCode.create({
      data: {
        email,
        code,
        expires,
      },
    })

    console.log(`📧 生成验证码: ${code} for ${email}`)

    // 发送邮件
    const transport = createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT),
      secure: Number(process.env.EMAIL_SERVER_PORT) === 465,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    })

    await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "【AI-Species】您的注册验证码",
      text: `您的验证码是：${code}，5分钟内有效。如果这不是您的操作，请忽略此邮件。`,
      html: `
        <!DOCTYPE html>
        <html lang="zh-CN">
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 40px 20px;
                margin: 0;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 40px 30px;
                text-align: center;
              }
              .header h1 {
                color: white;
                margin: 0;
                font-size: 28px;
                font-weight: 700;
              }
              .content {
                padding: 40px 30px;
                text-align: center;
              }
              .content p {
                color: #333;
                line-height: 1.8;
                margin: 0 0 20px 0;
                font-size: 16px;
              }
              .code-box {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                font-size: 36px;
                font-weight: 700;
                letter-spacing: 8px;
                padding: 20px;
                border-radius: 12px;
                margin: 30px 0;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
              }
              .warning {
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin: 20px 0;
                border-radius: 8px;
                text-align: left;
              }
              .warning p {
                color: #856404;
                margin: 0;
                font-size: 14px;
              }
              .footer {
                background: #f7f7f7;
                padding: 30px;
                text-align: center;
                color: #666;
                font-size: 14px;
                line-height: 1.6;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✨ AI-Species</h1>
              </div>
              <div class="content">
                <p style="font-size: 18px; color: #333; margin-bottom: 10px;">您的验证码</p>
                
                <div class="code-box">
                  ${code}
                </div>

                <div class="warning">
                  <p><strong>⏰ 重要提示：</strong>验证码将在 <strong>5 分钟</strong>后失效，请尽快使用。</p>
                </div>

                <p style="color: #999; font-size: 14px; margin-top: 30px;">
                  如果这不是您的操作，请忽略此邮件。
                </p>
              </div>
              <div class="footer">
                <p>此邮件由 <strong>AI 智能绘图系统</strong> 自动发送，请勿回复。</p>
                <p style="margin-top: 10px;">© 2025 AI-Species. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    })

    console.log(`✅ 验证码邮件已发送至: ${email}`)

    return NextResponse.json({
      success: true,
      message: "验证码已发送，请查收邮箱",
    })
  } catch (error: any) {
    console.error("❌ 发送验证码失败:", error)
    return NextResponse.json(
      {
        error: "发送失败",
        message: error?.message || "未知错误",
      },
      { status: 500 }
    )
  }
}

