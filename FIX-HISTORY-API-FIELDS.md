# 历史记录 API 字段缺失修复

## 问题描述

用户反馈：普通重试时，克隆模式的记录变成了创意模式。

### 根本原因

虽然前端代码已经修改为传递 `mode`、`features`、`refImages` 字段：

```typescript
body: JSON.stringify({
  // ...
  mode: item.mode || "CREATIVE",
  features: item.features || "",
  refImages: item.refImages || [],
})
```

但是 `item` 对象中这些字段的值都是 `undefined`，因为：

1. **历史记录 API** (`app/api/history/route.ts`) 没有返回这些字段
2. **TypeScript 类型定义** (`components/history-card.tsx`) 中没有定义这些字段

导致：
- `item.mode` = `undefined` → 使用默认值 `"CREATIVE"`
- `item.features` = `undefined` → 使用默认值 `""`
- `item.refImages` = `undefined` → 使用默认值 `[]`

## 修复方案

### 1. 修改历史记录 API

**文件**：`app/api/history/route.ts`

在 select 中添加缺失的字段：

```typescript
// 修复前
select: {
  id: true,
  productName: true,
  productType: true,
  taskType: true,
  generatedImages: true,
  // ❌ 缺少 mode, features, refImages
  // ...
}

// 修复后
select: {
  id: true,
  productName: true,
  productType: true,
  taskType: true,
  mode: true,  // ✅ 添加
  features: true,  // ✅ 添加
  refImages: true,  // ✅ 添加
  generatedImages: true,
  // ...
}
```

### 2. 修改 TypeScript 类型定义

**文件**：`components/history-card.tsx`

在 `HistoryItem` 类型中添加缺失的字段：

```typescript
// 修复前
export type HistoryItem = {
  id: string
  productName: string
  productType: string
  taskType?: string
  // ❌ 缺少 mode, features, refImages
  generatedImages: string[]
  // ...
}

// 修复后
export type HistoryItem = {
  id: string
  productName: string
  productType: string
  taskType?: string
  mode?: string  // ✅ 添加：CREATIVE / CLONE
  features?: string  // ✅ 添加：卖点（克隆模式）
  refImages?: string[]  // ✅ 添加：参考图（克隆模式）
  generatedImages: string[]
  // ...
}
```

## 修复后的数据流

### 创意模式记录

**数据库**：
```json
{
  "id": "abc123",
  "productName": "测试商品",
  "mode": "CREATIVE",
  "features": null,
  "refImages": []
}
```

**API 返回**：
```json
{
  "id": "abc123",
  "productName": "测试商品",
  "mode": "CREATIVE",
  "features": null,
  "refImages": []
}
```

**前端重试时传递**：
```json
{
  "productName": "测试商品",
  "mode": "CREATIVE",  // ✅ 正确
  "features": "",
  "refImages": []
}
```

### 克隆模式记录

**数据库**：
```json
{
  "id": "def456",
  "productName": "测试商品",
  "mode": "CLONE",
  "features": "防水、耐磨",
  "refImages": ["ref1.jpg", "ref2.jpg"]
}
```

**API 返回**：
```json
{
  "id": "def456",
  "productName": "测试商品",
  "mode": "CLONE",
  "features": "防水、耐磨",
  "refImages": ["ref1.jpg", "ref2.jpg"]
}
```

**前端重试时传递**：
```json
{
  "productName": "测试商品",
  "mode": "CLONE",  // ✅ 正确
  "features": "防水、耐磨",  // ✅ 正确
  "refImages": ["ref1.jpg", "ref2.jpg"]  // ✅ 正确
}
```

## 测试步骤

### 1. 测试 API 返回

打开浏览器开发者工具，查看历史记录 API 的响应：

```
GET /api/history?limit=20&offset=0
```

**预期响应**：
```json
{
  "success": true,
  "items": [
    {
      "id": "...",
      "productName": "...",
      "mode": "CLONE",  // ✅ 应该有这个字段
      "features": "防水、耐磨",  // ✅ 应该有这个字段
      "refImages": ["..."],  // ✅ 应该有这个字段
      // ...
    }
  ]
}
```

### 2. 测试前端类型

在浏览器控制台中：

```javascript
// 获取历史记录
fetch('/api/history?limit=1')
  .then(r => r.json())
  .then(data => {
    const item = data.items[0]
    console.log('mode:', item.mode)
    console.log('features:', item.features)
    console.log('refImages:', item.refImages)
  })
```

**预期输出**：
```
mode: "CLONE"
features: "防水、耐磨"
refImages: ["https://...", "https://..."]
```

### 3. 测试普通重试

1. 生成一张克隆模式的图片
2. 使用完优惠重试机会
3. 点击"重新生成"（普通重试）
4. 查看服务器日志

**预期日志**：
```
[PROMPT_LOOKUP] Starting prompt lookup with params: {
  platformKey: 'SHOPEE',
  productType: 'CLONE_GENERAL',
  taskType: 'MAIN_IMAGE',
  mode: 'CLONE',  // ✅ 应该是 CLONE，不是 CREATIVE
  userId: '...'
}
```

## 影响范围

此修复影响：
- ✅ 历史记录列表页面
- ✅ 历史记录详情页面
- ✅ 任务列表页面
- ✅ 所有使用 `HistoryItem` 类型的组件

不影响：
- ❌ 首次生成（不依赖历史记录）
- ❌ 优惠重试（使用 retryFromId，后端从数据库读取）

## 相关修复

这是重试模式一致性修复的最后一块拼图：

1. ✅ 后端优惠重试：从原始记录读取 mode、features、refImages
2. ✅ 前端传递参数：在重试时传递 mode、features、refImages
3. ✅ **历史记录 API**：返回 mode、features、refImages（本次修复）
4. ✅ **TypeScript 类型**：定义 mode、features、refImages（本次修复）

## 常见问题

### Q1: 为什么之前没有发现这个问题？

**A**: 
- 优惠重试使用 `retryFromId`，后端直接从数据库读取，不依赖前端传递
- 只有普通重试才依赖前端传递的参数
- 如果用户一直使用优惠重试，不会遇到这个问题

### Q2: 旧的历史记录会受影响吗？

**A**: 
- 旧记录如果 mode 字段为空，会使用默认值 "CREATIVE"
- 可以运行修复脚本更新旧记录：
  ```bash
  node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/fix-generation-modes.ts dotenv_config_path=.env.local
  ```

### Q3: 为什么 features 和 refImages 是可选的？

**A**: 
- 创意模式不需要这些字段
- 使用 `?` 标记为可选，兼容两种模式

## 相关文件

- 修复文件：
  - `app/api/history/route.ts` - 历史记录 API
  - `components/history-card.tsx` - HistoryItem 类型定义
- 相关文档：
  - `FIX-RETRY-MODE-CONSISTENCY.md` - 重试模式一致性修复
  - `CHANGELOG-MODE-SEPARATION.md` - 完整更新日志
