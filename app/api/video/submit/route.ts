import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import "dotenv/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/video/submit
 *
 * Accepts FormData with:
 *   - prompt: string
 *   - videoParams: string (JSON)
 *   - images: File[] (binary image files)
 *
 * Forwards everything as multipart/form-data to N8N_VIDEO_URL,
 * so N8N receives the raw binary image files directly.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "未登录" }, { status: 401 })
        }

        const webhookUrl = process.env.N8N_VIDEO_URL
        if (!webhookUrl) {
            console.error("N8N_VIDEO_URL 未配置")
            return NextResponse.json(
                { error: "视频生成服务未配置" },
                { status: 500 }
            )
        }

        // Parse incoming FormData
        const formData = await req.formData()
        const prompt = (formData.get("prompt") as string) || ""
        const videoParamsRaw = (formData.get("videoParams") as string) || "{}"

        if (!prompt.trim()) {
            return NextResponse.json({ error: "缺少 prompt" }, { status: 400 })
        }

        // Build new FormData to forward to N8N (binary files included)
        const n8nForm = new FormData()
        n8nForm.append("prompt", prompt)
        n8nForm.append("videoParams", videoParamsRaw)
        n8nForm.append("userId", session.user.id)

        // Forward all image files as binary
        const imageFiles = formData.getAll("images")
        for (const file of imageFiles) {
            n8nForm.append("images", file)
        }

        console.log(
            `[VIDEO_SUBMIT] Calling N8N: ${webhookUrl}, images: ${imageFiles.length}, user: ${session.user.id}`
        )

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 120_000)

        try {
            const n8nRes = await fetch(webhookUrl, {
                method: "POST",
                body: n8nForm,
                signal: controller.signal,
            })

            if (!n8nRes.ok) {
                const errorText = await n8nRes.text().catch(() => "")
                console.error(
                    `[VIDEO_SUBMIT] N8N error: ${n8nRes.status}`,
                    errorText
                )
                return NextResponse.json(
                    { error: `生成服务错误: ${n8nRes.status}` },
                    { status: 502 }
                )
            }

            const rawText = await n8nRes.text()
            let json: any
            try {
                json = JSON.parse(rawText)
            } catch {
                json = { result: rawText }
            }

            console.log(`[VIDEO_SUBMIT] Success for user: ${session.user.id}`)
            return NextResponse.json({ success: true, data: json })
        } catch (err: any) {
            if (err?.name === "AbortError") {
                console.error("[VIDEO_SUBMIT] N8N 请求超时")
                return NextResponse.json(
                    { error: "请求超时，请稍后重试" },
                    { status: 504 }
                )
            }
            throw err
        } finally {
            clearTimeout(timeoutId)
        }
    } catch (err: any) {
        console.error("[VIDEO_SUBMIT] Unexpected error:", err)
        return NextResponse.json(
            { error: err?.message || "服务器错误" },
            { status: 500 }
        )
    }
}
