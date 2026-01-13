import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import "dotenv/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/edit-image
 * 调用 N8N_EDIT_WEBHOOK_URL 进行图片编辑
 * 入参: { image: string, content: string }
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id || null
    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    try {
        const body = await req.json().catch(() => null)

        const image = body?.image as string | undefined
        const content = body?.content as string | undefined

        if (!image) {
            return NextResponse.json({ error: "请提供图片 URL" }, { status: 400 })
        }
        if (!content) {
            return NextResponse.json({ error: "请提供修改内容" }, { status: 400 })
        }

        const webhookUrl = process.env.N8N_EDIT_WEBHOOK_URL
        if (!webhookUrl) {
            console.error("N8N_EDIT_WEBHOOK_URL 未配置")
            return NextResponse.json({ error: "编辑服务未配置" }, { status: 500 })
        }

        const payload = {
            image,
            content,
            userId,
            username: (session?.user as any)?.username ?? (session?.user as any)?.name ?? null,
        }

        console.log(`[EDIT_IMAGE_API] User: ${userId}, Payload:`, JSON.stringify(payload, null, 2))

        // 超时设置：5 分钟
        const timeoutMs = 300_000
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

        let response: Response
        try {
            response = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal,
            })
        } finally {
            clearTimeout(timeoutId)
        }

        if (!response.ok) {
            const errorText = await response.text().catch(() => "")
            console.error(`[EDIT_IMAGE_API] N8N error: ${response.status} ${response.statusText}`, errorText)
            return NextResponse.json(
                { error: `编辑服务返回错误: ${response.status}` },
                { status: 502 }
            )
        }

        const rawText = await response.text().catch(() => "")
        if (!rawText) {
            return NextResponse.json({ error: "编辑服务响应为空" }, { status: 502 })
        }

        let result: any
        try {
            result = JSON.parse(rawText)
        } catch {
            console.error("[EDIT_IMAGE_API] Invalid JSON response:", rawText.slice(0, 200))
            return NextResponse.json({ error: "编辑服务响应格式错误" }, { status: 502 })
        }

        console.log(`[EDIT_IMAGE_API] Success for user ${userId}`)

        return NextResponse.json({
            success: true,
            ...result,
        })
    } catch (err: any) {
        const message = err?.message || String(err)
        const errName = err?.name

        if (errName === "AbortError" || errName === "TimeoutError") {
            console.error("[EDIT_IMAGE_API] Request timeout")
            return NextResponse.json({ error: "编辑请求超时，请稍后重试" }, { status: 504 })
        }

        console.error("[EDIT_IMAGE_API] Error:", message)
        return NextResponse.json({ error: "编辑失败", message }, { status: 500 })
    }
}
