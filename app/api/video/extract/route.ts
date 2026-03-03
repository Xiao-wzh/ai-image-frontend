import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { tosClient, TOS_BUCKET } from "@/lib/tos"
import { v4 as uuidv4 } from "uuid"
import "dotenv/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getExtFromFilename(name: string) {
    const idx = name.lastIndexOf(".")
    if (idx === -1) return ""
    return name.slice(idx + 1).toLowerCase()
}

function yyyymmdd(d = new Date()) {
    const yyyy = String(d.getFullYear())
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}${mm}${dd}`
}

/**
 * POST /api/video/extract
 *
 * Accepts FormData with:
 *   - image: File (uploaded product image)
 *   - productCategory: string
 *   - region: string
 *   - language: string
 *   - videoType: string
 *   - prompt: string (optional)
 *
 * 1. Uploads the image to TOS and gets a public URL
 * 2. Sends JSON payload (with image URL) to the N8N video-prompt webhook
 * 3. Returns the N8N response
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "未登录" }, { status: 401 })
        }

        const webhookUrl = process.env.N8N_VIDEO_PROMPT_URL
        if (!webhookUrl) {
            console.error("N8N_VIDEO_PROMPT_URL 未配置")
            return NextResponse.json(
                { error: "视频提取服务未配置" },
                { status: 500 }
            )
        }

        // 解析 FormData
        const formData = await req.formData()
        const images = formData.getAll("image") as File[]
        const productCategory = (formData.get("productCategory") as string) || ""
        const region = (formData.get("region") as string) || ""
        const language = (formData.get("language") as string) || ""
        const videoType = (formData.get("videoType") as string) || ""
        const productName = (formData.get("productName") as string) || ""
        const step = (formData.get("step") as string) || "1"
        const targetUsers = (formData.get("targetUsers") as string) || ""
        const coreBenefits = (formData.get("coreBenefits") as string) || ""
        const prompt = (formData.get("prompt") as string) || ""
        const selectedScenarioRaw = (formData.get("selectedScenario") as string) || ""
        let selectedScenario: any = null
        if (selectedScenarioRaw) {
            try { selectedScenario = JSON.parse(selectedScenarioRaw) } catch { }
        }

        // 上传所有图片到 TOS
        const imageUrls: string[] = []
        for (const image of images) {
            if (!image || image.size === 0) continue
            const ext = getExtFromFilename(image.name)
            const uuid = uuidv4()
            const objectKey = `video-extract/${yyyymmdd()}/${uuid}${ext ? "." + ext : ""}`

            const arrayBuffer = await image.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            await tosClient.putObject({
                bucket: TOS_BUCKET,
                key: objectKey,
                body: buffer,
                contentType: image.type || "image/png",
            })

            const endpoint = String(
                process.env.TOS_PUBLIC_ENDPOINT || process.env.TOS_ENDPOINT || ""
            )
                .trim()
                .replace(/\/$/, "")
            const base = endpoint.startsWith("http")
                ? endpoint
                : `https://${TOS_BUCKET}.${endpoint}`
            const url = `${base}/${objectKey}`
            imageUrls.push(url)

            console.log(
                `[VIDEO_EXTRACT] 上传到 TOS: ${url}, 用户: ${session.user.id}`
            )
        }

        // 构建 N8N JSON 请求体
        const n8nPayload: Record<string, any> = {
            imageUrl: imageUrls[0] || "",
            imageUrls,
            productCategory,
            region,
            language,
            videoType,
            productName,
            step,
            targetUsers,
            coreBenefits,
            prompt,
            userId: session.user.id,
        }
        if (selectedScenario) {
            n8nPayload.selectedScenario = selectedScenario
        }

        console.log(
            `[VIDEO_EXTRACT] Calling N8N: ${webhookUrl}`,
            JSON.stringify(n8nPayload)
        )

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 120_000)

        try {
            const n8nRes = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(n8nPayload),
                signal: controller.signal,
            })

            if (!n8nRes.ok) {
                const errorText = await n8nRes.text().catch(() => "")
                console.error(
                    `[VIDEO_EXTRACT] N8N error: ${n8nRes.status}`,
                    errorText
                )
                return NextResponse.json(
                    { error: `提取服务错误: ${n8nRes.status}` },
                    { status: 502 }
                )
            }

            const rawText = await n8nRes.text()
            if (!rawText) {
                return NextResponse.json(
                    { error: "N8N 响应为空" },
                    { status: 502 }
                )
            }

            let json: any
            try {
                json = JSON.parse(rawText)
            } catch {
                // If response is plain text (a prompt), wrap it
                json = { prompt: rawText }
            }

            console.log(`[VIDEO_EXTRACT] Success for user: ${session.user.id}`)
            return NextResponse.json({ success: true, data: json })
        } catch (err: any) {
            if (err?.name === "AbortError") {
                console.error("[VIDEO_EXTRACT] N8N 请求超时")
                return NextResponse.json(
                    { error: "提取请求超时，请稍后重试" },
                    { status: 504 }
                )
            }
            throw err
        } finally {
            clearTimeout(timeoutId)
        }
    } catch (err: any) {
        console.error("[VIDEO_EXTRACT] Unexpected error:", err)
        return NextResponse.json(
            { error: err?.message || "服务器错误" },
            { status: 500 }
        )
    }
}
