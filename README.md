# AI 图像生成器（Next.js 16 + Prisma）

一个用于「商品图/电商图」批量生成的 Web 控制台：上传图片 + 选择商品类型 → 调用 n8n 工作流 → 返回九宫格结果，并支持一键打包下载。

## ✨ 功能特性

### 核心功能
- **图片生成**：上传多张图片 + 商品名称/类型 → 调用 n8n Webhook → 生成九宫格商品图
- **积分系统**：扣费与失败自动退款（默认每次生成 199 积分，优惠重试 99 积分）
- **任务队列**：实时轮询任务状态，支持分页和搜索
- **历史记录**：瀑布流展示，支持无限滚动加载
- **批量下载**：九宫格图片一键 ZIP 打包下载

### 用户系统
- 登录/注册/邮箱验证码（NextAuth v5 + Prisma Adapter）
- 积分充值（集成支付宝 Native 扫码支付）
- 用户积分余额实时显示

### 界面特性
- **现代 UI 设计**：Glassmorphism 玻璃拟态 + Aurora 极光渐变
- **响应式布局**：适配桌面端和移动端
- **流畅动效**：Framer Motion 动画过渡
- **暗色主题**：护眼深色模式

---

## 🛠️ 技术栈

| 分类 | 说明 |
|---|---|
| 前端框架 | Next.js 16（App Router）+ React 19 |
| UI 组件 | Shadcn UI + Radix UI + Lucide Icons |
| 样式 | Tailwind CSS 4 |
| 动效 | Framer Motion |
| 认证 | NextAuth.js v5（beta）+ Prisma Adapter |
| 数据库 | PostgreSQL + Prisma ORM 7（@prisma/adapter-pg） |
| API | Next.js Route Handlers（`app/api/*`） |
| 工作流 | n8n Webhook 集成 |
| 支付 | 支付宝（Native 扫码支付） |
| 运行环境 | Node.js 20+ |

---

## 🚀 快速开始

> 需要：Node.js ≥ 20、PostgreSQL。

```bash
# 1) 安装依赖
npm install

# 2) 配置环境变量（创建 .env 或 .env.local）
# 见下方"环境变量"

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

## 🔧 环境变量

创建 **.env** 或 **.env.local**：

```bash
# PostgreSQL 连接串
DATABASE_URL="postgresql://用户名:密码@localhost:5432/ai_image?schema=public"

# n8n Webhook 地址（由你的 n8n 工作流提供）
N8N_WEBHOOK_URL="http://localhost:5678/webhook/your-flow"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="your-secret-key"

# 支付宝配置（可选，用于积分充值）
ALIPAY_APP_ID="your-app-id"
ALIPAY_PRIVATE_KEY="your-private-key"
ALIPAY_PUBLIC_KEY="alipay-public-key"

# 邮件服务（可选，用于验证码）
EMAIL_SERVER_HOST=
EMAIL_SERVER_PORT=
EMAIL_SERVER_USER=
EMAIL_SERVER_PASSWORD=
EMAIL_FROM=
```

---

## 📁 项目结构

```text
.
├─ app/
│  ├─ api/
│  │  ├─ generate/route.ts        # 生成：扣费→调用n8n→写库→失败退款
│  │  ├─ history/route.ts         # 历史记录：分页+搜索
│  │  ├─ download-images/route.ts # 下载：后端拉取图片以绕过 CORS
│  │  ├─ credits/*                # 积分相关 API
│  │  └─ auth/*                   # 注册/验证码/NextAuth
│  ├─ login/page.tsx              # 登录页
│  ├─ tasks/page.tsx              # 任务队列（分页+搜索）
│  ├─ history/page.tsx            # 历史记录（瀑布流）
│  ├─ credits/page.tsx            # 积分充值
│  └─ page.tsx                    # 首页（生成控制台）
├─ components/
│  ├─ sidebar.tsx                 # 侧边栏导航
│  ├─ upload-zone.tsx             # 上传区域
│  ├─ generation-result.tsx       # 结果展示 + ZIP 下载
│  ├─ history-card.tsx            # 历史卡片
│  ├─ history-detail-dialog.tsx   # 详情弹窗（再次生成/优惠重试）
│  ├─ task-item.tsx               # 任务项
│  └─ ui/*                        # Shadcn UI 组件
├─ prisma/
│  ├─ schema.prisma               # 数据库模型
│  └─ migrations/
└─ scripts/
   └─ init-prompts.ts             # 初始化 Prompt 模板
```

---

## 📡 API 接口

### POST /api/generate
生成图片接口

**请求字段：**
- `productName`: 商品名称
- `productType`: 商品类型（需与数据库中的 Prompt 模板匹配）
- `images`: 可多张图片（Base64）
- `platformKey`: 平台标识（如 "SHOPEE"）

**n8n 返回格式：**
```json
{
  "images": ["https://.../1.png", "https://.../2.png"],
  "full_image_url": "https://.../full.png"
}
```

### GET /api/history
获取历史记录

**查询参数：**
- `limit`: 每页数量（默认 20，最大 50）
- `offset`: 偏移量
- `query`: 搜索关键词（按产品名称模糊搜索）

---

## 🎯 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地开发（热更新） |
| `npm run build` | 生产构建 |
| `npm run start` | 本地启动生产版本 |
| `npm run lint` | ESLint 检查 |
| `npx prisma studio` | 数据库可视化管理 |

---

## 🌐 部署提示

- **Vercel**：配置 `DATABASE_URL`、`N8N_WEBHOOK_URL` 等环境变量即可。
- **Docker**：确保容器可访问 PostgreSQL 与 n8n；并正确配置环境变量。

---

## 📄 License

本项目仅供学习与交流使用。