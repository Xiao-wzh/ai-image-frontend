/**
 * WeChat Pay V3 类型定义
 * 
 * 包含商户配置、订单状态、回调数据等核心类型
 */

// ============================================
// 订单状态枚举
// ============================================
export const OrderStatus = {
    PENDING: 'PENDING',   // 待支付（业务下单完成，等待发起支付）
    CREATED: 'CREATED',   // 订单已创建（兼容旧逻辑）
    PAYING: 'PAYING',     // 用户扫码中
    PAID: 'PAID',         // 支付成功
    CLOSED: 'CLOSED',     // 订单已关闭（超时/手动）
    REFUND: 'REFUND',     // 已退款
} as const;

export type OrderStatusType = typeof OrderStatus[keyof typeof OrderStatus];

// ============================================
// 支付渠道枚举
// ============================================
export const PayChannel = {
    WECHAT: 'wechat',
    ALIPAY: 'alipay',
} as const;

export type PayChannelType = typeof PayChannel[keyof typeof PayChannel];

// ============================================
// 商户配置
// ============================================
export interface MerchantConfig {
    /** 商户标识 key，如 mch_indi / mch_company */
    merchantKey: string;
    /** 微信商户号 */
    mchid: string;
    /** 微信公众号/小程序 AppID */
    appid: string;
    /** API v3 密钥（32位） */
    apiV3Key: string;
    /** 商户 API 证书序列号 */
    merchantSerial: string;
    /** 商户私钥内容（PEM 格式字符串） */
    merchantPrivateKey: string;
    /** 商户证书内容（PEM 格式，用于 SDK 初始化） */
    merchantCert: string;
    /** 微信平台公钥内容（PEM 格式，用于回调验签） */
    wechatpayPublicKey: string;
    /** 微信支付公钥证书序列号（用于回调验签匹配） */
    wechatpayCertSerial?: string;
}

/** 从环境变量解析的原始配置（路径形式） */
export interface MerchantConfigRaw {
    mchid: string;
    appid: string;
    apiV3Key: string;
    merchantSerial: string;
    merchantPrivateKeyPath: string;
    /** 商户证书路径（用于 SDK 初始化） */
    merchantCertPath: string;
    /** 微信平台公钥路径（用于回调验签） */
    wechatpayPublicKeyPath: string;
    wechatpayCertSerial?: string;
}

// ============================================
// 创建订单
// ============================================
export interface CreateOrderRequest {
    /** 套餐ID（必须从数据库查询价格，不信任前端） */
    planId: string;
    /** 商户标识（可选，默认使用 WECHAT_DEFAULT_MERCHANT_KEY） */
    merchantKey?: string;
    /** 用户ID（必须登录） */
    userId: string;
}

export interface CreateOrderResponse {
    /** 商户订单号 */
    outTradeNo: string;
    /** 二维码链接（用于生成二维码） */
    codeUrl: string;
    /** 使用的商户标识 */
    merchantKey: string;
    /** 微信商户号 */
    mchid: string;
}

// ============================================
// 查询订单
// ============================================
export interface QueryOrderResponse {
    outTradeNo: string;
    status: OrderStatusType;
    amount: number;
    title: string;
    paidAt: Date | null;
    createdAt: Date;
}

// ============================================
// 微信回调
// ============================================

/** 微信回调请求头 */
export interface WechatNotifyHeaders {
    'wechatpay-timestamp': string;
    'wechatpay-nonce': string;
    'wechatpay-signature': string;
    'wechatpay-serial': string;
}

/** 微信回调加密资源 */
export interface WechatNotifyResource {
    original_type: string;
    algorithm: string;
    ciphertext: string;
    associated_data: string;
    nonce: string;
}

/** 微信回调原始 Body */
export interface WechatNotifyBody {
    id: string;
    create_time: string;
    resource_type: string;
    event_type: string;
    summary: string;
    resource: WechatNotifyResource;
}

/** 解密后的回调明文数据 */
export interface NotifyPlainResource {
    mchid: string;
    appid: string;
    out_trade_no: string;
    transaction_id: string;
    trade_type: string;
    trade_state: 'SUCCESS' | 'REFUND' | 'NOTPAY' | 'CLOSED' | 'REVOKED' | 'USERPAYING' | 'PAYERROR';
    trade_state_desc: string;
    bank_type: string;
    attach?: string;
    success_time: string;
    payer: {
        openid: string;
    };
    amount: {
        total: number;
        payer_total: number;
        currency: string;
        payer_currency: string;
    };
}

// ============================================
// 回调处理结果
// ============================================
export interface NotifyHandleResult {
    success: boolean;
    code: 'SUCCESS' | 'FAIL';
    message: string;
    orderId?: string;
}

// ============================================
// 错误类型
// ============================================
export class PaymentError extends Error {
    constructor(
        message: string,
        public code: 'BAD_REQUEST' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL',
        public httpStatus: number = 500
    ) {
        super(message);
        this.name = 'PaymentError';
    }
}

export class BadRequestError extends PaymentError {
    constructor(message: string) {
        super(message, 'BAD_REQUEST', 400);
        this.name = 'BadRequestError';
    }
}

export class UnauthorizedError extends PaymentError {
    constructor(message: string) {
        super(message, 'UNAUTHORIZED', 401);
        this.name = 'UnauthorizedError';
    }
}

export class NotFoundError extends PaymentError {
    constructor(message: string) {
        super(message, 'NOT_FOUND', 404);
        this.name = 'NotFoundError';
    }
}

export class ConflictError extends PaymentError {
    constructor(message: string) {
        super(message, 'CONFLICT', 409);
        this.name = 'ConflictError';
    }
}
