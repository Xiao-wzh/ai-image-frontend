/**
 * WeChat Pay V3 加密/解密工具
 * 
 * 独立可测试的加密工具函数：
 * - RSA-SHA256 验签（用于回调验证）
 * - AES-256-GCM 解密（用于回调数据解密）
 */

import * as crypto from 'crypto';

/**
 * 验证微信支付回调签名（RSA-SHA256）
 * 
 * @param timestamp 回调时间戳 (Wechatpay-Timestamp)
 * @param nonce 随机串 (Wechatpay-Nonce)
 * @param body 原始请求体
 * @param signature Base64 编码的签名 (Wechatpay-Signature)
 * @param publicKey 微信支付公钥（PEM 格式）
 * @returns 验签是否通过
 */
export function verifyWechatSignature(
    timestamp: string,
    nonce: string,
    body: string,
    signature: string,
    publicKey: string
): boolean {
    try {
        // 构造验签串：时间戳\n随机串\n请求体\n
        const message = `${timestamp}\n${nonce}\n${body}\n`;

        // 创建验证器
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(message);

        // 验证签名
        return verifier.verify(publicKey, signature, 'base64');
    } catch (error) {
        console.error('[WechatPay] 验签失败:', error);
        return false;
    }
}

/**
 * 解密微信支付回调资源（AES-256-GCM）
 * 
 * @param ciphertext Base64 编码的密文
 * @param associatedData 附加数据
 * @param nonce 12字节随机串
 * @param apiV3Key API V3 密钥（32字节）
 * @returns 解密后的 JSON 对象
 */
export function decryptWechatResource<T = unknown>(
    ciphertext: string,
    associatedData: string,
    nonce: string,
    apiV3Key: string
): T {
    // 密钥必须是 32 字节
    if (apiV3Key.length !== 32) {
        throw new Error('[WechatPay] API V3 密钥必须是 32 字符');
    }

    try {
        // Base64 解码密文
        const ciphertextBuffer = Buffer.from(ciphertext, 'base64');

        // GCM 认证标签在密文末尾，长度为 16 字节
        const AUTH_TAG_LENGTH = 16;
        const authTag = ciphertextBuffer.subarray(ciphertextBuffer.length - AUTH_TAG_LENGTH);
        const encryptedData = ciphertextBuffer.subarray(0, ciphertextBuffer.length - AUTH_TAG_LENGTH);

        // 创建解密器
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            Buffer.from(apiV3Key),
            Buffer.from(nonce)
        );

        // 设置认证标签
        decipher.setAuthTag(authTag);

        // 设置附加认证数据
        decipher.setAAD(Buffer.from(associatedData));

        // 解密
        const decrypted = Buffer.concat([
            decipher.update(encryptedData),
            decipher.final()
        ]);

        // 解析 JSON
        return JSON.parse(decrypted.toString('utf8')) as T;
    } catch (error) {
        console.error('[WechatPay] 解密失败:', error);
        throw new Error('[WechatPay] 回调数据解密失败');
    }
}

/**
 * 生成订单号（带渠道前缀）
 * 格式: WX_{timestamp}_{random}
 */
export function generateOutTradeNo(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `WX_${timestamp}_${random}`;
}
