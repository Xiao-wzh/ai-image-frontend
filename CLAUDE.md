# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 常用命令

```bash
npm run dev          # 启动开发服务器（Next.js）
npm run build        # 生产环境构建
npm run start        # 启动生产服务器
npm run lint         # 运行 ESLint
npm run worker:watermark  # 启动水印后台 Worker（需要 Redis）
```

数据库迁移：
```bash
npx prisma migrate dev    # 在开发环境应用迁移
npx prisma generate       # Schema 变更后重新生成 Prisma 客户端
npx prisma db push        # 直接推送 Schema 变更（仅限开发，无迁移记录）
```

## 架构概览

这是一个面向电商卖家的 SaaS AI 图片生成平台。用户上传商品图片，选择平台（Shopee、TikTok 等）和商品类型，系统通过 n8n 工作流生成专业营销主图。

### 核心流程

1. 用户上传图片 → 选择平台/商品类型 → 提交表单
2. `POST /api/generate` 原子性扣除积分，创建 `Generation` 记录，发送任务到 n8n webhook
3. n8n 调用 AI 处理后，回调 `POST /api/webhook/n8n` 返回结果
4. 客户端轮询 `/api/tasks` 获取任务状态

### 关键架构模式

**动态提示词系统**：AI 提示词存储在 `ProductTypePrompt` 表中，通过 `lib/prompt-compiler.ts` 编译（Handlebars 语法，兼容旧版 `${var}` 语法）。提示词按 `productType`、`platform`、`taskType`、`qualityMode` 匹配，支持用户级别的个人覆盖。

**积分系统**：积分分两个池子 — `credits`（充值购买）和 `bonusCredits`（赠送促销）。所有扣减/退款均通过 Prisma 原子事务完成。`lib/credit-service.ts` 处理退款；费用配置从 `SystemConfig` 表读取，通过 `lib/system-config.ts` 缓存（Next.js tag-based 缓存）。

**代理/推荐系统**：支付结算时进行多级佣金分发。`lib/order-service.ts` 使用 CAS 乐观锁（`notifyProcessedAt` 字段）保证微信支付回调幂等性。`lib/agent-service.ts` 沿推荐关系树向上分配佣金。

**水印队列**：后台 Worker（`workers/watermark-worker.ts`）使用 BullMQ + Redis 异步处理水印去除任务，作为独立进程运行。

### 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15（App Router） |
| 数据库 | PostgreSQL + Prisma ORM |
| 认证 | NextAuth v5（账号密码 + 邮箱魔法链接） |
| UI | Shadcn/UI + Tailwind CSS 4 + Radix UI |
| 任务队列 | BullMQ + Redis（仅水印 Worker 使用） |
| 对象存储 | 火山引擎 TOS |
| 支付 | 微信支付 v3（多商户） |
| AI 编排 | n8n webhook |

### 目录结构

- `app/` — Next.js App Router 页面与 API 路由
- `app/api/` — 按功能分组的 API 路由
- `components/` — React 组件（大量使用 `"use client"` 客户端组件）
- `components/admin/` — 管理后台专用组件
- `lib/` — 业务逻辑、服务层、工具函数
- `lib/pay/wechat/` — 微信支付 v3 集成
- `prisma/` — Schema 与迁移文件
- `workers/` — 后台 Worker 进程
- `hooks/` — 自定义 React Hooks
- `public/` — 静态资源

### 管理员与普通用户路由

管理员路由位于 `/admin/*`，由 `lib/check-admin.ts` 的 `requireAdmin()` 保护（校验 `session.user.role === "ADMIN"`）。普通用户路由由 `middleware.ts` 中的 NextAuth 中间件保护。

### 多商户支付

微信支付通过 `WECHAT_MERCHANTS_JSON` 环境变量支持多商户配置，当前生效商户由 `WECHAT_DEFAULT_MERCHANT_KEY` 指定。商户私钥文件需存放在 `secrets/<merchant-key>/apiclient_key.pem`。

### 环境变量

必填环境变量（参考 `.env.example`）：
- `DATABASE_URL` — PostgreSQL 连接字符串
- `AUTH_SECRET` — NextAuth 密钥
- `N8N_WEBHOOK_URL` — n8n 自动化 webhook 地址
- `TOS_*` — 火山引擎对象存储凭证
- `WECHAT_MERCHANTS_JSON` + `WECHAT_DEFAULT_MERCHANT_KEY` — 微信支付配置
- `EMAIL_SERVER_*` + `EMAIL_FROM` — 认证邮件 SMTP 配置
- `REDIS_HOST/PORT/PASSWORD` — 仅运行水印 Worker 时需要

### 开发中功能（分支：develop-video）

`develop-video` 分支正在开发视频生成功能（`/video` 页面、`app/api/video/`），目前部分实现，视频渠道暂时禁用。
