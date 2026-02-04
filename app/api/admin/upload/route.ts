/**
 * Admin Asset Upload API
 * 用于上传管理员资源（如客服二维码），返回 CDN 加速后的 URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { tosClient, TOS_BUCKET } from '@/lib/tos';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getExtFromFilename(name: string) {
    const idx = name.lastIndexOf('.');
    if (idx === -1) return '';
    return name.slice(idx + 1).toLowerCase();
}

function yyyymmdd(d = new Date()) {
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        // 检查是否为管理员
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        });

        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: '无权限访问' }, { status: 403 });
        }

        const body = await req.json().catch(() => null);
        const filename = String(body?.filename ?? '').trim();
        const contentType = String(body?.contentType ?? '').trim();

        if (!filename) {
            return NextResponse.json({ error: '缺少 filename' }, { status: 400 });
        }
        if (!contentType) {
            return NextResponse.json({ error: '缺少 contentType' }, { status: 400 });
        }

        // 只允许图片格式
        const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!ALLOWED_TYPES.includes(contentType.toLowerCase())) {
            return NextResponse.json({ error: '只支持 JPG、PNG、GIF、WebP 格式的图片' }, { status: 400 });
        }

        if (!TOS_BUCKET) {
            return NextResponse.json({ error: 'TOS_BUCKET 未配置' }, { status: 500 });
        }

        const ext = getExtFromFilename(filename);
        const uuid = uuidv4();
        // 使用独立目录: admin-assets/YYYYMMDD/uuid.ext
        const objectKey = `admin-assets/${yyyymmdd()}/${uuid}${ext ? '.' + ext : ''}`;

        // 生成 PUT 预签名 URL (300s)
        const uploadUrl = await tosClient.getPreSignedUrl({
            bucket: TOS_BUCKET,
            key: objectKey,
            method: 'PUT',
            expires: 300,
        });

        // 优先使用 CDN 域名，否则使用 TOS_PUBLIC_ENDPOINT
        const cdnDomain = process.env.NEXT_PUBLIC_CDN_HOST || '';
        let publicUrl: string;

        if (cdnDomain) {
            // 使用 CDN 域名
            const base = cdnDomain.replace(/\/$/, '');
            publicUrl = `${base.startsWith('http') ? base : `https://${base}`}/${objectKey}`;
        } else {
            // 回退到 TOS_PUBLIC_ENDPOINT
            const endpoint = String(process.env.TOS_PUBLIC_ENDPOINT || process.env.TOS_ENDPOINT || '')
                .trim()
                .replace(/\/$/, '');
            const base = endpoint.startsWith('http') ? endpoint : `https://${TOS_BUCKET}.${endpoint}`;
            publicUrl = `${base}/${objectKey}`;
        }

        return NextResponse.json({
            uploadUrl,
            publicUrl,
            objectKey,
        });
    } catch (error) {
        console.error('[API] 获取上传 URL 失败:', error);
        return NextResponse.json({ error: '获取上传地址失败' }, { status: 500 });
    }
}
