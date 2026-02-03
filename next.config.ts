import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // wechatpay-node-v3 uses formidable which has dynamic requires
  // that don't work with Turbopack, so we mark them as external
  serverExternalPackages: [
    'wechatpay-node-v3',
    'formidable',
    'superagent',
  ],
};

export default nextConfig;
