# AI 图像生成器（Next.js 16 + Prisma）

一个用于「商品图/电商图」批量生成的 Web 控制台：上传图片 + 选择商品类型 → 调用 n8n 工作流 → 返回九宫格结果，并支持一键打包下载。

## 功能特性

- 登录/注册/邮箱验证码（NextAuth v5 + Prisma Adapter）
- 积分扣费与失败自动退款（默认每次生成扣 199 积分）
- 上传多张图片，后端转 Base64 发送至 n8n Webhook
- 返回九宫格图片数组 `images`，前端支持预览与 ZIP 打包下载（见 `components/generation-result.tsx`）
- Prisma + PostgreSQL 持久化生成记录
- Tailwind CSS + Shadcn UI + Framer Motion 动效

---

## 技术栈

| 分类 | 说明 |
|---|---|
| 前端框架 | Next.js 16（App Router）+ React 19 |
| UI | Shadcn UI + Radix UI + Lucide Icons |
| 样式 | Tailwind CSS 4 |
| 动效 | Framer Motion |
| 认证 | NextAuth.js v5（beta）+ Prisma Adapter |
| 数据库 | PostgreSQL + Prisma ORM 7（@prisma/adapter-pg） |
| API | Next.js Route Handlers（`app/api/*`） |
| 工作流 | n8n Webhook 集成 |
| 运行环境 | Node.js 20+ |

---

## 快速开始

> 需要：Node.js ≥ 20、PostgreSQL。

```bash
# 1) 安装依赖
npm install

# 2) 配置环境变量（创建 .env 或 .env.local）
# 见下方“环境变量”

# 3) 初始化数据库
npx prisma db push
# 或：npx prisma migrate dev

# 4) （可选）初始化商品类型 Prompt 模板
node scripts/init-prompts.ts

# 5) 启动开发服务器
npm run dev
```

浏览器访问：`http://localhost:3000`

---

## 环境变量

本仓库当前未提供 `.env.example`，请自行创建 **.env** 或 **.env.local**：

```bash
# PostgreSQL 连接串
DATABASE_URL="postgresql://用户名:密码@localhost:5432/ai_image?schema=public"

# n8n Webhook 地址（由你的 n8n 工作流提供）
N8N_WEBHOOK_URL="http://localhost:5678/webhook/your-flow"

# NextAuth（按需配置）
# NEXTAUTH_URL="http://localhost:3000"
# AUTH_SECRET="..."

# 若使用邮件验证码/找回等功能（按你的实现/部署环境配置）
# EMAIL_SERVER_HOST=
# EMAIL_SERVER_PORT=
# EMAIL_SERVER_USER=
# EMAIL_SERVER_PASSWORD=
# EMAIL_FROM=
```

---

## 生成接口约定（n8n 返回格式）

后端接口：`POST /api/generate`（`multipart/form-data`）

- 请求字段（关键）：
  - `productName`: 商品名称
  - `productType`: 商品类型（需与数据库中的 Prompt 模板匹配）
  - `images`: 可多张图片

n8n Webhook 期望返回：

```json
{
  "images": ["https://.../1.png", "https://.../2.png"],
  "full_image_url": "https://.../full.png"
}
```

> 目前后端会读取 `images`（必填），`full_image_url` 或 `generated_image_url`（可选）。

---

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地开发（热更新） |
| `npm run build` | 生产构建 |
| `npm run start` | 本地启动生产版本 |
| `npm run lint` | ESLint 检查 |
| `npx prisma studio` | 数据库可视化管理 |

---

## 项目结构（简）

```text
.
├─ app/
│  ├─ api/
│  │  ├─ generate/route.ts        # 生成：扣费→调用n8n→写库→失败退款
│  │  ├─ download-images/route.ts # 下载：后端拉取图片以绕过 CORS
│  │  └─ auth/*                   # 注册/验证码/NextAuth
│  ├─ login/page.tsx
│  └─ page.tsx
├─ components/
│  ├─ generation-result.tsx       # 结果展示 + ZIP 下载
│  └─ ...
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
└─ scripts/
   └─ init-prompts.ts
```

---

## 部署提示

- **Vercel**：配置 `DATABASE_URL`、`N8N_WEBHOOK_URL` 等环境变量即可。
- **Docker**：确保容器可访问 PostgreSQL 与 n8n；并正确配置环境变量。

---

## License

本项目仅供学习与交流使用。