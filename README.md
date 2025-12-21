# AI 图像生成器前端 (Next.js)

> 作者: **@xiaoWu**  
> 基于 Next.js 16 / Tailwind CSS 4 / Prisma 7 / Shadcn UI 的全栈示例项目

本仓库是一个 **AI 图像生成控制台** 的前端及轻量后端实现：

- 上传任意图片或以文本提示生成图片
- 图片将转换为 Base64 发送至 n8n Webhook，调用后端 AI 服务
- 使用 **Prisma + PostgreSQL** 持久化生成记录
- 支持明暗主题、响应式布局

---

## 技术栈

| 分类            | 说明 |
|----------------|------|
| 前端框架       | [Next.js](https://nextjs.org/) App Router (16.x) |
| UI 组件        | [Shadcn UI](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| 样式           | [Tailwind CSS 4](https://tailwindcss.com/) + CSS 变量 |
| 状态管理       | React 19 原生 Hook |
| 后端 / API     | Next.js Route Handler (`app/api/*`) |
| 数据库         | PostgreSQL + [Prisma ORM 7](https://www.prisma.io/) (Driver Adapter 直连) |
| 任务编排       | [n8n](https://n8n.io/) Webhook 集成 |
| 部署推荐       | Vercel / Docker / 任意 Node 20 环境 |

---

## 快速开始

> 请确保本地已安装 **Node.js ≥ 20**, **npm ≥ 9**，并运行一套 **PostgreSQL** 服务。

```bash
# 1. 克隆项目
$ git clone <repo-url> && cd ai-image-frontend

# 2. 安装依赖
$ npm install

# 3. 复制并修改环境变量
$ cp .env.example .env       # 或手动创建 .env
#   - DATABASE_URL  修改为你的 Postgres 连接串
#   - N8N_WEBHOOK_URL 修改为你的 n8n Webhook 地址

# 4. 初始化数据库 (仅首次)
$ npx prisma db push         # 快速同步
# 或生成迁移文件
$ npx prisma migrate dev --name init

# 5. 启动开发服务器
$ npm run dev

# 打开浏览器访问 http://localhost:3000
```

### 常用脚本

| 命令                 | 作用 |
|----------------------|------|
| `npm run dev`        | 开启本地开发 (热更新) |
| `npm run build`      | 生产构建 (Turbopack) |
| `npm run start`      | 启动生产环境本地预览 |
| `npm run lint`       | 代码质量检查 (ESLint) |
| `npx prisma studio`  | 图形化浏览数据库 |

---

## 环境变量说明

```
# PostgreSQL 连接 (Prisma 7 使用 Driver Adapter)
DATABASE_URL="postgresql://用户名:密码@localhost:5432/ai_image?schema=public"

# n8n Webhook 地址 (需根据实际流程调整)
N8N_WEBHOOK_URL="http://localhost:5678/webhook/nano-banana-yunwu"
```

将其放入 **.env** 或 **.env.local** 文件中即可。

---

## 项目结构

```
.
├─ app               # Next.js App Router 目录
│  ├─ api/generate   # 图像生成 API (上传文件 → n8n → Prisma)
│  ├─ layout.tsx     # 全局布局 & Toaster
│  └─ page.tsx       # 主 Dashboard 页面
├─ components        # 业务与 UI 组件
│  ├─ sidebar.tsx
│  ├─ upload-zone.tsx
│  └─ ...
├─ lib
│  └─ prisma.ts      # Prisma 客户端 (Driver Adapter)
├─ prisma
│  ├─ schema.prisma  # Prisma 数据模型 (Generation)
│  └─ prisma.config.ts
├─ public            # 静态资源
└─ README.md
```

---

## 生成流程简述

1. 用户在浏览器上传图片 (或文本提示) → `/api/generate`
2. 服务器端：
   - 将文件转为 Base64
   - 在 **Generation** 表创建状态为 `PENDING` 的记录
3. 服务器调用 **n8n Webhook**
4. n8n 调用 AI 服务生成图片后，返回 `generated_image_url`
5. 后端更新记录为 `COMPLETED` 并返回 URL
6. 前端 Toast 提示并展示生成结果

---

## 部署

### Vercel

1. 在 Vercel 控制台导入仓库
2. 设置环境变量 `DATABASE_URL`、`N8N_WEBHOOK_URL`
3. 选择 **Node 20** & `npm run build` / `npm run start`

### Docker

```bash
docker build -t ai-image-frontend .

docker run -d -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public \
  -e N8N_WEBHOOK_URL=http://n8n:5678/webhook/xxx \
  ai-image-frontend
```

---

## 常见问题 FAQ

| 问题 | 解决方案 |
|------|-----------|
| 502: n8n 响应未包含 URL | 检查 n8n 流程输出字段名应为 `generated_image_url` 或 `data` |
| Prisma P1012 错误 | 确保 `schema.prisma` 中 **datasource** 无 `url` 字段，连接串放到 `prisma.config.ts` |
| 图片过大上传失败 | 调整 `upload-zone.tsx` 或后端文件大小限制 |

---

## License

本项目仅供学习与交流，禁止商用，如需商用请联系作者获得授权。
