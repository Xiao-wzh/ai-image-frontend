import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { tosClient, TOS_BUCKET } from "@/lib/tos"
import { v4 as uuidv4 } from "uuid"
import "dotenv/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/video/veo
 *
 * 接收 FormData：
 *   - prompt: string
 *   - videoParams: string（JSON）
 *   - images: File[]（首帧/尾帧图片文件）
 *
 * 流程：
 *   1. 将图片上传到 TOS，获取 CDN URL
 *   2. 以 JSON { prompt, images: [url1, url2] } 格式转发到 N8N_VEO_URL
 */

/** 生成日期前缀 */
function yyyymmdd(d = new Date()) {
    const yyyy = String(d.getFullYear())
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}${mm}${dd}`
}

/** 从文件名提取扩展名 */
function getExtFromFilename(name: string) {
    const idx = name.lastIndexOf(".")
    if (idx === -1) return ""
    return name.slice(idx + 1).toLowerCase()
}

/** 将 File 上传到 TOS，返回公开 CDN URL */
async function uploadFileToTos(file: File): Promise<string> {
    const ext = getExtFromFilename(file.name)
    const uuid = uuidv4()
    const objectKey = `veo/${yyyymmdd()}/${uuid}${ext ? "." + ext : ""}`

    // 读取文件内容为 Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 上传到 TOS
    await tosClient.putObject({
        bucket: TOS_BUCKET,
        key: objectKey,
        body: buffer,
        headers: {
            "Content-Type": file.type || "image/png",
        },
    })

    // 拼接 CDN URL
    const cdnHost = process.env.NEXT_PUBLIC_CDN_HOST || "img.wzhdjy.xin"
    return `https://${cdnHost}/${objectKey}`
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "未登录" }, { status: 401 })
        }

        const webhookUrl = process.env.N8N_VEO_URL
        if (!webhookUrl) {
            console.error("N8N_VEO_URL 未配置")
            return NextResponse.json(
                { error: "VEO 视频生成服务未配置" },
                { status: 500 }
            )
        }

        // 解析 FormData
        const formData = await req.formData()
        const prompt = (formData.get("prompt") as string) || ""
        const videoParamsRaw = (formData.get("videoParams") as string) || "{}"

        if (!prompt.trim()) {
            return NextResponse.json({ error: "缺少 prompt" }, { status: 400 })
        }

        // 上传所有图片到 TOS，获取 CDN URL
        const imageFiles = formData.getAll("images") as File[]
        const imageUrls: string[] = []

        for (const file of imageFiles) {
            console.log(`[VEO_SUBMIT] 上传图片到TOS: ${file.name} (${file.size} bytes)`)
            const cdnUrl = await uploadFileToTos(file)
            imageUrls.push(cdnUrl)
            console.log(`[VEO_SUBMIT] 上传成功: ${cdnUrl}`)
        }

        // 构建发送给 N8N 的 JSON 请求体
        const n8nPayload = {
            prompt,
            images: imageUrls,
        }

        console.log(
            `[VEO_SUBMIT] 调用 N8N: ${webhookUrl}, 图片数量: ${imageUrls.length}, 用户: ${session.user.id}`
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
                    `[VEO_SUBMIT] N8N 错误: ${n8nRes.status}`,
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

            console.log(`[VEO_SUBMIT] 成功, 用户: ${session.user.id}`)
            return NextResponse.json({ success: true, data: json })
        } catch (err: any) {
            if (err?.name === "AbortError") {
                console.error("[VEO_SUBMIT] N8N 请求超时")
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
        console.error("[VEO_SUBMIT] 未知错误:", err)
        return NextResponse.json(
            { error: err?.message || "服务器错误" },
            { status: 500 }
        )
    }
}
