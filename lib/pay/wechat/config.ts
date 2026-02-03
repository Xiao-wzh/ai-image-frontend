/**
 * WeChat Pay 多商户配置加载器
 * 
 * 从环境变量读取商户配置，并加载对应的 PEM 证书文件
 */

import * as fs from 'fs';
import * as path from 'path';
import type { MerchantConfig, MerchantConfigRaw } from './types';

// 配置缓存（避免重复读取文件）
let merchantConfigsCache: Map<string, MerchantConfig> | null = null;
let serialToMerchantKeyCache: Map<string, string> | null = null;

/**
 * 解析商户配置
 * 优先从 secrets/wechat-merchants.json 文件读取（支持格式化）
 * 如果文件不存在，则从 WECHAT_MERCHANTS_JSON 环境变量读取
 */
function parseMerchantsJson(): Record<string, MerchantConfigRaw> {
    // 1. 优先尝试从 JSON 文件读取
    const configFilePath = path.resolve(process.cwd(), 'secrets/wechat-merchants.json');
    if (fs.existsSync(configFilePath)) {
        try {
            const fileContent = fs.readFileSync(configFilePath, 'utf8');
            console.log('[WechatPay] 从 secrets/wechat-merchants.json 加载商户配置');
            return JSON.parse(fileContent);
        } catch (e) {
            console.error(`[WechatPay] 解析配置文件失败: ${e}`);
        }
    }

    // 2. 回退到环境变量
    const json = process.env.WECHAT_MERCHANTS_JSON;
    if (!json) {
        throw new Error('[WechatPay] 未找到商户配置：请创建 secrets/wechat-merchants.json 或设置 WECHAT_MERCHANTS_JSON 环境变量');
    }

    try {
        return JSON.parse(json);
    } catch (e) {
        throw new Error(`[WechatPay] WECHAT_MERCHANTS_JSON 解析失败: ${e}`);
    }
}

/**
 * 读取 PEM 文件内容
 */
function readPemFile(relativePath: string): string {
    const absolutePath = path.resolve(process.cwd(), relativePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`[WechatPay] 证书文件不存在: ${absolutePath}`);
    }

    return fs.readFileSync(absolutePath, 'utf8');
}

/**
 * 初始化并缓存所有商户配置
 */
function initMerchantConfigs(): Map<string, MerchantConfig> {
    if (merchantConfigsCache) {
        return merchantConfigsCache;
    }

    const rawConfigs = parseMerchantsJson();
    const configs = new Map<string, MerchantConfig>();
    const serialMap = new Map<string, string>();

    for (const [merchantKey, raw] of Object.entries(rawConfigs)) {
        // 验证必要字段
        if (!raw.mchid || !raw.appid || !raw.apiV3Key || !raw.merchantSerial) {
            console.warn(`[WechatPay] 商户 ${merchantKey} 配置不完整，已跳过`);
            continue;
        }

        try {
            const config: MerchantConfig = {
                merchantKey,
                mchid: raw.mchid,
                appid: raw.appid,
                apiV3Key: raw.apiV3Key,
                merchantSerial: raw.merchantSerial,
                merchantPrivateKey: readPemFile(raw.merchantPrivateKeyPath),
                merchantCert: readPemFile(raw.merchantCertPath),
                wechatpayPublicKey: readPemFile(raw.wechatpayPublicKeyPath),
                wechatpayCertSerial: raw.wechatpayCertSerial,
            };

            configs.set(merchantKey, config);

            // 建立 serial -> merchantKey 映射（用于回调验签）
            if (raw.wechatpayCertSerial) {
                serialMap.set(raw.wechatpayCertSerial, merchantKey);
            }

            console.log(`[WechatPay] 加载商户配置成功: ${merchantKey} (mchid: ${raw.mchid})`);
        } catch (e) {
            console.error(`[WechatPay] 加载商户 ${merchantKey} 配置失败:`, e);
        }
    }

    if (configs.size === 0) {
        throw new Error('[WechatPay] 没有可用的商户配置');
    }

    merchantConfigsCache = configs;
    serialToMerchantKeyCache = serialMap;

    return configs;
}

/**
 * 获取指定商户的配置
 */
export function getMerchantConfig(merchantKey: string): MerchantConfig {
    const configs = initMerchantConfigs();
    const config = configs.get(merchantKey);

    if (!config) {
        throw new Error(`[WechatPay] 商户配置不存在: ${merchantKey}`);
    }

    return config;
}

/**
 * 获取默认商户的配置
 */
export function getDefaultMerchantConfig(): MerchantConfig {
    const defaultKey = process.env.WECHAT_DEFAULT_MERCHANT_KEY;
    if (!defaultKey) {
        throw new Error('[WechatPay] WECHAT_DEFAULT_MERCHANT_KEY 未配置');
    }
    return getMerchantConfig(defaultKey);
}

/**
 * 获取默认商户 Key
 */
export function getDefaultMerchantKey(): string {
    const defaultKey = process.env.WECHAT_DEFAULT_MERCHANT_KEY;
    if (!defaultKey) {
        throw new Error('[WechatPay] WECHAT_DEFAULT_MERCHANT_KEY 未配置');
    }
    return defaultKey;
}

/**
 * 获取所有商户配置
 */
export function getAllMerchantConfigs(): MerchantConfig[] {
    const configs = initMerchantConfigs();
    return Array.from(configs.values());
}

/**
 * 根据微信支付公钥证书序列号查找商户配置
 * 用于回调验签时优先匹配
 */
export function getMerchantConfigBySerial(serial: string): MerchantConfig | null {
    initMerchantConfigs();

    if (!serialToMerchantKeyCache) {
        return null;
    }

    const merchantKey = serialToMerchantKeyCache.get(serial);
    if (!merchantKey) {
        return null;
    }

    return merchantConfigsCache?.get(merchantKey) ?? null;
}

/**
 * 获取微信支付回调通知 URL
 */
export function getNotifyUrl(): string {
    const url = process.env.WECHAT_NOTIFY_URL;
    if (!url) {
        throw new Error('[WechatPay] WECHAT_NOTIFY_URL 未配置');
    }
    return url;
}

/**
 * 清除配置缓存（仅用于测试）
 */
export function clearConfigCache(): void {
    merchantConfigsCache = null;
    serialToMerchantKeyCache = null;
}
