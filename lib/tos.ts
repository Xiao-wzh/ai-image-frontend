import TosClient from "@volcengine/tos-sdk"

function normalizeEndpoint(endpoint: string) {
  // tos-sdk 期望 endpoint 不带协议
  return endpoint.replace(/^https?:\/\//, "").trim()
}

export const TOS_BUCKET = process.env.TOS_BUCKET || ""

export const tosClient = new TosClient({
  accessKeyId: process.env.TOS_ACCESS_KEY || "",
  accessKeySecret: process.env.TOS_SECRET_KEY || "",
  endpoint: normalizeEndpoint(process.env.TOS_ENDPOINT || ""),
  region: process.env.TOS_REGION || "",
})

if (!TOS_BUCKET) {
  console.warn("[tos] TOS_BUCKET 未设置")
}




