/**
 * Agent Profile Type Definitions
 * 代理客制化配置类型定义
 */

export interface AgentProfile {
    /** 店铺名称 (默认: "Nano Banana") */
    siteName?: string
    /** 欢迎语/副标题 (默认: "AI Species") */
    welcomeMsg?: string
    /** 联系二维码 URL */
    contactQr?: string
}

/** 默认的代理配置 */
export const DEFAULT_AGENT_PROFILE: Required<AgentProfile> = {
    siteName: "AI Species",
    welcomeMsg: "专业AI电商图片生成平台",
    contactQr: "",
}

/**
 * 合并代理配置与默认值
 */
export function mergeAgentProfile(profile: AgentProfile | null | undefined): Required<AgentProfile> {
    return {
        siteName: profile?.siteName || DEFAULT_AGENT_PROFILE.siteName,
        welcomeMsg: profile?.welcomeMsg || DEFAULT_AGENT_PROFILE.welcomeMsg,
        contactQr: profile?.contactQr || DEFAULT_AGENT_PROFILE.contactQr,
    }
}
