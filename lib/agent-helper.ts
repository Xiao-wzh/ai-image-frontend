/**
 * Agent Helper - 代理客制化配置获取逻辑
 * 用于服务端组件获取当前应展示的代理配置
 */
import { cookies } from "next/headers"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { AgentProfile, mergeAgentProfile, DEFAULT_AGENT_PROFILE } from "@/lib/types/agent"

const REFERRAL_COOKIE_NAME = "referral_code"

export interface AgentContextResult {
    /** 代理配置 (已合并默认值) */
    profile: Required<AgentProfile>
    /** 代理用户 ID (如果找到) */
    agentUserId: string | null
    /** 代理用户名 */
    agentName: string | null
    /** 数据来源 */
    source: "self" | "inviter" | "url" | "cookie" | "default"
}

/**
 * 获取当前应展示的代理配置
 * 
 * 优先级:
 * 1. 已登录用户自己的品牌 (如果是代理且有设置)
 * 2. 已登录用户的上级代理品牌
 * 3. URL searchParams.ref 或 searchParams.inviteCode
 * 4. Cookie 中的 referral_code
 * 5. 系统默认配置
 */
export async function getCurrentAgentProfile(
    searchParams?: { ref?: string; inviteCode?: string }
): Promise<AgentContextResult> {
    try {
        const session = await auth()

        if (session?.user?.id) {
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: {
                    invitedById: true,
                    agentLevel: true,
                    agentProfile: true,
                    name: true,
                },
            })

            // **优先级 1**: 自己是代理且有品牌设置 → 使用自己的品牌
            if (user && user.agentLevel > 0) {
                const selfProfile = user.agentProfile as AgentProfile | null
                // 只要设置过任何字段，就认为有自定义配置
                if (selfProfile && (selfProfile.siteName || selfProfile.welcomeMsg || selfProfile.contactQr)) {
                    return {
                        profile: mergeAgentProfile(selfProfile),
                        agentUserId: session.user.id,
                        agentName: user.name,
                        source: "self",
                    }
                }
            }

            // **优先级 2**: 检查上级代理
            if (user?.invitedById) {
                const inviter = await prisma.user.findUnique({
                    where: { id: user.invitedById },
                    select: { id: true, name: true, agentProfile: true, agentLevel: true },
                })

                if (inviter && inviter.agentLevel > 0) {
                    return {
                        profile: mergeAgentProfile(inviter.agentProfile as AgentProfile),
                        agentUserId: inviter.id,
                        agentName: inviter.name,
                        source: "inviter",
                    }
                }
            }
        }

        // **优先级 3**: 检查 URL 参数
        const refCode = searchParams?.ref || searchParams?.inviteCode
        if (refCode) {
            const agent = await findAgentByReferralCode(refCode)
            if (agent) {
                return {
                    profile: mergeAgentProfile(agent.agentProfile as AgentProfile),
                    agentUserId: agent.id,
                    agentName: agent.name,
                    source: "url",
                }
            }
        }

        // **优先级 4**: 检查 Cookie
        const cookieStore = await cookies()
        const cookieRefCode = cookieStore.get(REFERRAL_COOKIE_NAME)?.value
        if (cookieRefCode) {
            const agent = await findAgentByReferralCode(cookieRefCode)
            if (agent) {
                return {
                    profile: mergeAgentProfile(agent.agentProfile as AgentProfile),
                    agentUserId: agent.id,
                    agentName: agent.name,
                    source: "cookie",
                }
            }
        }

        // **优先级 5**: 返回默认配置
        return {
            profile: DEFAULT_AGENT_PROFILE,
            agentUserId: null,
            agentName: null,
            source: "default",
        }
    } catch (error) {
        console.error("[AGENT_HELPER] Error getting agent profile:", error)
        return {
            profile: DEFAULT_AGENT_PROFILE,
            agentUserId: null,
            agentName: null,
            source: "default",
        }
    }
}

/**
 * 根据推广码查找代理用户
 */
async function findAgentByReferralCode(refCode: string) {
    return prisma.user.findFirst({
        where: {
            referralCode: refCode,
            agentLevel: { gt: 0 },
        },
        select: {
            id: true,
            name: true,
            agentProfile: true,
            agentLevel: true,
        },
    })
}
