// 引入 dotenv 库
const dotenv = require('dotenv');
const path = require('path');

// 手动读取 .env 文件
const envConfig = dotenv.config({ path: '/var/www/ai-image-frontend/ai-image-frontend/.env' }).parsed;

if (!envConfig) {
    console.error('❌ 严重错误: 无法读取 .env 文件！请检查路径和权限。');
} else {
    console.log('✅ 成功读取 .env 文件，准备注入 PM2...');
}

module.exports = {
    apps: [
        // Next.js 主应用
        {
            name: "ai-image-frontend",
            script: "node_modules/next/dist/bin/next",
            args: "start",
            cwd: "/var/www/ai-image-frontend/ai-image-frontend",
            instances: 1,
            autorestart: true,
            time: true,
            env: {
                ...envConfig,
                NODE_ENV: "production",
                PORT: 3000
            }
        },
        // TOS 上传 Worker 进程（并发=3，防止带宽爆炸）
        {
            name: "tos-upload-worker",
            script: "npx",
            args: "tsx workers/tos-upload-worker.ts",
            cwd: "/var/www/ai-image-frontend/ai-image-frontend",
            instances: 1,              // 单实例，并发由 BullMQ concurrency=3 控制
            autorestart: true,
            time: true,
            max_memory_restart: "500M",
            restart_delay: 3000,
            max_restarts: 10,
            min_uptime: 5000,
            env: {
                ...envConfig,
                NODE_ENV: "production"
            }
        },
        // 去水印 Worker 进程
        {
            name: "watermark-worker",
            script: "npx",
            args: "tsx workers/watermark-worker.ts",
            cwd: "/var/www/ai-image-frontend/ai-image-frontend",
            instances: 1,              // 单实例，通过 concurrency 控制并发
            autorestart: true,
            time: true,                // 日志带时间戳
            max_memory_restart: "500M",
            restart_delay: 3000,       // 重启延迟 3 秒（防抖动）
            max_restarts: 10,          // 10 分钟内最多重启 10 次
            min_uptime: 5000,          // 5 秒内崩溃视为启动失败
            env: {
                ...envConfig,
                NODE_ENV: "production"
            }
        }
    ]
};
