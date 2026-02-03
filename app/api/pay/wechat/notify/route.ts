/**
 * 微信支付回调通知接口
 * 
 * POST /api/pay/wechat/notify
 * 
 * 关键点：
 * - 必须使用 req.text() 获取原始 body 参与验签
 * - 从 headers 获取签名信息
 * - 返回 { code: "SUCCESS" } 或 { code: "FAIL" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleNotify } from '@/lib/pay/wechat/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // 获取原始请求体（用于验签）
        const rawBody = await req.text();

        // 获取必要的 headers
        const timestamp = req.headers.get('wechatpay-timestamp') ?? '';
        const nonce = req.headers.get('wechatpay-nonce') ?? '';
        const signature = req.headers.get('wechatpay-signature') ?? '';
        const serial = req.headers.get('wechatpay-serial') ?? '';

        // 校验 headers 完整性
        if (!timestamp || !nonce || !signature || !serial) {
            console.error('[WechatPay Notify] 缺少必要的 headers');
            return NextResponse.json(
                { code: 'FAIL', message: '缺少必要的请求头' },
                { status: 400 }
            );
        }

        console.log(`[WechatPay Notify] 收到回调: serial=${serial.substring(0, 10)}...`);

        // 调用服务层处理回调
        const result = await handleNotify(
            {
                'wechatpay-timestamp': timestamp,
                'wechatpay-nonce': nonce,
                'wechatpay-signature': signature,
                'wechatpay-serial': serial,
            },
            rawBody
        );

        // 返回给微信
        // 注意：无论成功失败都返回 200，通过 code 字段区分
        // 返回 FAIL 时微信会重试，返回 SUCCESS 时不再重试
        return NextResponse.json(
            { code: result.code, message: result.message },
            { status: 200 }
        );
    } catch (error) {
        console.error('[WechatPay Notify] 处理异常:', error);

        // 返回 FAIL 让微信重试
        return NextResponse.json(
            { code: 'FAIL', message: '系统错误' },
            { status: 200 }
        );
    }
}

// 禁止其他方法
export async function GET() {
    return NextResponse.json(
        { error: 'Method Not Allowed' },
        { status: 405 }
    );
}
