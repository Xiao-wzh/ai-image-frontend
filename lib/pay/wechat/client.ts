/**
 * WeChat Pay V3 客户端工厂
 * 
 * 按 merchantKey 创建并缓存 wechatpay-node-v3 客户端实例
 */

import WxPay from 'wechatpay-node-v3';
import { getMerchantConfig, getDefaultMerchantKey } from './config';
import type { MerchantConfig } from './types';

// 客户端缓存
const clientCache = new Map<string, WxPay>();

/**
 * 获取指定商户的 WxPay 客户端
 */
export function getWechatPayClient(merchantKey?: string): WxPay {
    const key = merchantKey ?? getDefaultMerchantKey();

    // 检查缓存
    const cached = clientCache.get(key);
    if (cached) {
        return cached;
    }

    // 获取商户配置
    const config = getMerchantConfig(key);

    // 创建客户端
    const client = createClient(config);

    // 缓存
    clientCache.set(key, client);

    console.log(`[WechatPay] 创建客户端成功: ${key}`);

    return client;
}

/**
 * 根据配置创建 WxPay 客户端
 * 
 * 注意：wechatpay-node-v3 的 publicKey 参数需要证书格式（BEGIN CERTIFICATE）
 * 使用商户的 apiclient_cert.pem 证书文件
 */
function createClient(config: MerchantConfig): WxPay {
    return new WxPay({
        appid: config.appid,
        mchid: config.mchid,
        publicKey: Buffer.from(config.merchantCert),
        privateKey: Buffer.from(config.merchantPrivateKey),
    });
}

/**
 * 清除客户端缓存（仅用于测试）
 */
export function clearClientCache(): void {
    clientCache.clear();
}
