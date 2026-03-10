---
trigger: always_on
glob:
description:
---

## ⚠️ 全局开发纪律 (Global Development Rules)
使用中文进行回答
作为我的高级全栈开发助手，在执行接下来的任何新需求时，你必须严格遵守以下工作流：

### 1. 逻辑回归检查 (Regression Check)
在构思方案前，必须全局扫描相关文件，分析新功能对现有系统的影响。
**绝对不能**破坏现有的核心业务闭环，特别是：
- 支付与退款事务 (Order & Refund Transactions)
- 多维度的 Prompt 降级与隔离逻辑 (ProductTypePrompt Fallback)
- 代理商的客制化展示与分润逻辑 (Agent Profile & Referral)

### 2. 先出方案，后写代码 (Plan First, Code Later)
在理解需求后，**严禁直接开始大面积修改代码**。
你必须先输出一份结构化的 `Implementation Plan` (实施计划)，内容必须包含：
- **Database**: 涉及的 Prisma Schema 变动。
- **Backend**: 涉及的 API 路由和依赖的服务文件。
- **Frontend**: 涉及的组件树变动和状态管理思路。
- **Risk Assessment**: 评估这个改动可能对老功能造成的风险。

### 3. 等待授权 (Wait for Confirmation)
在输出完 Plan 之后，请明确使用粗体写出：**"请确认上述方案，确认后我将开始编写代码。"**
只有在我回复“确认”或“OK”后，你才可以开始真正生成和修改代码文件。