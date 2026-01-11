import crypto from "crypto"

// 使用环境变量中的密钥，如果没有则使用备用密钥
const INVITE_SECRET = process.env.INVITE_LINK_SECRET || process.env.NEXTAUTH_SECRET || "fallback-invite-secret"

/**
 * 生成邀请链接签名
 * 防止用户篡改 inviteCode 和 type 参数
 */
export function signInviteLink(inviteCode: string, type: "user" | "agent"): string {
    const payload = `${inviteCode}:${type}`
    const signature = crypto
        .createHmac("sha256", INVITE_SECRET)
        .update(payload)
        .digest("hex")
        .slice(0, 12) // 取前12位，足够安全且链接不会太长
    return signature
}

/**
 * 验证邀请链接签名
 * 返回 true 如果签名有效
 */
export function verifyInviteSignature(inviteCode: string, type: "user" | "agent", signature: string): boolean {
    const expectedSignature = signInviteLink(inviteCode, type)
    return signature === expectedSignature
}

/**
 * 生成完整的邀请链接参数
 * @param inviteCode 邀请码
 * @param type 邀请类型
 * @returns URL 查询参数字符串
 */
export function generateInviteLinkParams(inviteCode: string, type: "user" | "agent"): string {
    const sig = signInviteLink(inviteCode, type)
    if (type === "agent") {
        return `inviteCode=${inviteCode}&type=agent&sig=${sig}`
    }
    return `inviteCode=${inviteCode}&sig=${sig}`
}
