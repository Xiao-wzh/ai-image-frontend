// 代理等级常量 - 可在客户端和服务端使用
export const AGENT_LEVEL = {
    USER: 0,      // 普通用户
    L1: 1,        // 合伙人 (最高代理等级)
    L2: 2,        // 运营中心
    L3: 3,        // 推广大使 (最低代理等级)
} as const

// 分润比例 (单位: %)
export const COMMISSION_RATES = {
    DIRECT: 10,     // 直推奖励
    MANAGEMENT: 5,  // 管理奖励 (需要L2+)
    TOP: 5,         // 顶级奖励 (需要L1)
} as const

// L1 初始授权名额
export const L1_INITIAL_QUOTA = 5
