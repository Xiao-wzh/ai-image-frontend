import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { tosClient, TOS_BUCKET } from "@/lib/tos"
import { v4 as uuidv4 } from "uuid"

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
 * POST /api/watermark/upload
 * Get presigned URL for uploading watermark removal images to TOS
 * Uses a separate directory: watermark-remove/YYYYMMDD/uuid.ext
 */
export async function POST(req: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const filename = String(body?.filename ?? "").trim()
    const contentType = String(body?.contentType ?? "").trim()

    if (!filename) {
        return NextResponse.json({ error: "缺少 filename" }, { status: 400 })
    }
    if (!contentType) {
        return NextResponse.json({ error: "缺少 contentType" }, { status: 400 })
    }

    // 只允许特定图片格式 (API 支持: jpg, jpeg, bmp, png)
    const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/bmp"]
    if (!ALLOWED_TYPES.includes(contentType.toLowerCase())) {
        return NextResponse.json({ error: "只支持 JPG、PNG、BMP 格式的图片" }, { status: 400 })
    }

    if (!TOS_BUCKET) {
        return NextResponse.json({ error: "TOS_BUCKET 未配置" }, { status: 500 })
    }

    const ext = getExtFromFilename(filename)
    const uuid = uuidv4()
    // 使用独立目录: watermark-remove/YYYYMMDD/uuid.ext
    const objectKey = `watermark-remove/${yyyymmdd()}/${uuid}${ext ? "." + ext : ""}`

    // 生成 PUT 预签名 URL (300s)
    const uploadUrl = await tosClient.getPreSignedUrl({
        bucket: TOS_BUCKET,
        key: objectKey,
        method: "PUT",
        expires: 300,
    })

    // publicUrl：假设桶公有读
    const endpoint = String(process.env.TOS_PUBLIC_ENDPOINT || process.env.TOS_ENDPOINT || "")
        .trim()
        .replace(/\/$/, "")

    // 如果用户给的是不带协议的 endpoint，这里统一补 https
    const base = endpoint.startsWith("http") ? endpoint : `https://${TOS_BUCKET}.${endpoint}`
    const publicUrl = `${base}/${objectKey}`

    return NextResponse.json({
        uploadUrl,
        publicUrl,
        objectKey,
    })
}
