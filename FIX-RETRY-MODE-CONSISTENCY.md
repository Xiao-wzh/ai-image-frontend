# 重试模式一致性修复

## 问题描述

用户反馈：
1. 点击"优惠重试"时，重试使用的提示词与上一次不一样
2. 点击"普通重试"（再次生成）时，也有同样的问题
3. 克隆模式的记录重试后变成创意模式

### 根本原因

在重试流程中，有三个地方需要传递完整的模式参数：

1. **后端优惠重试**（`app/api/generate/route.ts`）：从原始记录获取参数时遗漏了 `mode`、`features`、`refImages`
2. **前端普通重试**（`components/history-detail-dialog.tsx`）：调用 API 时只传递了基本参数
3. **前端任务列表重试**（`components/task-item.tsx`）：调用 API 时只传递了基本参数

这导致：
1. **克隆模式重试变成创意模式**：原本是克隆模式的生成，重试时 `mode` 使用默认值 "CREATIVE"
2. **提示词不匹配**：由于模式不同，查找到的提示词模板也不同
3. **参数丢失**：克隆模式的卖点和参考图信息丢失

## 修复方案

### 1. 修改后端优惠重试 `app/api/generate/route.ts`

在重试流程中，从原始记录获取完整的模式相关参数：

```typescript
// 修复前
taskType = originalGeneration.taskType || "MAIN_IMAGE"
actualCost = getRetryCost(taskType, costs)
productName = originalGeneration.productName
productType = originalGeneration.productType as ProductTypeKey
imageUrls = originalGeneration.originalImage
platformKey = "SHOPEE"
outputLanguage = originalGeneration.outputLanguage || "简体中文"
// ❌ 缺少 mode, features, refImages

// 修复后
taskType = originalGeneration.taskType || "MAIN_IMAGE"
actualCost = getRetryCost(taskType, costs)
productName = originalGeneration.productName
productType = originalGeneration.productType as ProductTypeKey
imageUrls = originalGeneration.originalImage
platformKey = "SHOPEE"
outputLanguage = originalGeneration.outputLanguage || "简体中文"
mode = originalGeneration.mode || "CREATIVE"  // ✅ 从原始记录获取模式
features = originalGeneration.features || ""  // ✅ 从原始记录获取卖点
refImages = originalGeneration.refImages || []  // ✅ 从原始记录获取参考图
```

### 2. 修改前端普通重试 `components/history-detail-dialog.tsx`

在调用 API 时传递完整参数：

```typescript
// 修复前
body: JSON.stringify({
  productName: item.productName,
  productType: item.productType,
  taskType: item.taskType || "MAIN_IMAGE",
  images: item.originalImage,
  platformKey: "SHOPEE",
})

// 修复后
body: JSON.stringify({
  productName: item.productName,
  productType: item.productType,
  taskType: item.taskType || "MAIN_IMAGE",
  images: item.originalImage,
  platformKey: "SHOPEE",
  mode: item.mode || "CREATIVE",  // ✅ 添加模式
  features: item.features || "",  // ✅ 添加卖点
  refImages: item.refImages || [],  // ✅ 添加参考图
  outputLanguage: item.outputLanguage || "简体中文",  // ✅ 添加输出语言
})
```

### 3. 修改任务列表重试 `components/task-item.tsx`

在普通重试（非优惠）时传递完整参数：

```typescript
// 修复前
const requestBody = isDiscountAvailable
  ? { retryFromId: item.id }
  : {
      productName: item.productName,
      productType: item.productType,
      taskType: item.taskType || "MAIN_IMAGE",
      images: item.originalImage,
      platformKey: "SHOPEE",
      outputLanguage: item.outputLanguage || "繁体中文",
    }

// 修复后
const requestBody = isDiscountAvailable
  ? { retryFromId: item.id }
  : {
      productName: item.productName,
      productType: item.productType,
      taskType: item.taskType || "MAIN_IMAGE",
      images: item.originalImage,
      platformKey: "SHOPEE",
      outputLanguage: item.outputLanguage || "繁体中文",
      mode: item.mode || "CREATIVE",  // ✅ 添加模式
      features: item.features || "",  // ✅ 添加卖点
      refImages: item.refImages || [],  // ✅ 添加参考图
    }
```

## 修复后的行为

### 场景 1：创意模式重试

**原始生成**：
- 模式：创意模式
- 产品类型：男装
- 提示词：创意模式的男装提示词

**重试**：
- ✅ 模式：创意模式（从原始记录获取）
- ✅ 产品类型：男装（从原始记录获取）
- ✅ 提示词：创意模式的男装提示词（与原始一致）

### 场景 2：克隆模式重试

**原始生成**：
- 模式：克隆模式
- 产品类型：CLONE_GENERAL
- 卖点：防水、耐磨、轻便
- 参考图：2 张
- 提示词：克隆模式的提示词

**重试**：
- ✅ 模式：克隆模式（从原始记录获取）
- ✅ 产品类型：CLONE_GENERAL（从原始记录获取）
- ✅ 卖点：防水、耐磨、轻便（从原始记录获取）
- ✅ 参考图：2 张（从原始记录获取）
- ✅ 提示词：克隆模式的提示词（与原始一致）

### 场景 3：详情页重试

**原始生成**：
- 任务类型：详情页
- 模式：创意模式
- 产品类型：男装
- 提示词：创意模式的男装详情页提示词

**重试**：
- ✅ 任务类型：详情页（从原始记录获取）
- ✅ 模式：创意模式（从原始记录获取）
- ✅ 产品类型：男装（从原始记录获取）
- ✅ 提示词：创意模式的男装详情页提示词（与原始一致）

## 测试步骤

### 测试 1：创意模式主图重试

1. 选择创意模式
2. 选择男装产品类型
3. 上传商品图并生成
4. 点击"优惠重试"
5. 查看服务器日志

**预期结果**：
```
[GENERATE_API] Discount retry mode for MAIN_IMAGE - setting actualCost to 100
[PROMPT_LOOKUP] Looking for prompt: platformKey=SHOPEE, productType=MENSWEAR, taskType=MAIN_IMAGE, mode=CREATIVE
```

### 测试 2：克隆模式主图重试

1. 选择克隆模式
2. 上传参考图和商品图
3. 填写卖点："防水、耐磨"
4. 生成
5. 点击"优惠重试"
6. 查看服务器日志

**预期结果**：
```
[GENERATE_API] Discount retry mode for MAIN_IMAGE - setting actualCost to 100
[PROMPT_LOOKUP] Looking for prompt: platformKey=SHOPEE, productType=CLONE_GENERAL, taskType=MAIN_IMAGE, mode=CLONE
```

**n8n payload 应包含**：
```json
{
  "mode": "CLONE",
  "features": "防水、耐磨",
  "ref_image_count": 2,
  "images": ["参考图1", "参考图2", "商品图1", "商品图2"]
}
```

### 测试 3：详情页重试

1. 选择详情页任务类型
2. 选择创意模式
3. 生成
4. 点击"优惠重试"
5. 查看服务器日志

**预期结果**：
```
[GENERATE_API] Discount retry mode for DETAIL_PAGE - setting actualCost to 100
[PROMPT_LOOKUP] Looking for prompt: platformKey=SHOPEE, productType=MENSWEAR, taskType=DETAIL_PAGE, mode=CREATIVE
```

## 验证方法

### 方法 1：查看服务器日志

在终端中查看日志输出，确认：
1. 重试时的 `mode` 与原始生成一致
2. 提示词查找的参数正确
3. n8n payload 包含正确的 mode、features、ref_image_count

### 方法 2：数据库验证

查询原始记录和重试记录：

```sql
-- 查看原始记录
SELECT 
  id,
  "productName",
  "productType",
  "taskType",
  mode,
  features,
  "refImages",
  "hasUsedDiscountedRetry",
  "createdAt"
FROM "Generation"
WHERE id = 'original_generation_id';

-- 查看重试记录
SELECT 
  id,
  "productName",
  "productType",
  "taskType",
  mode,
  features,
  "refImages",
  "hasUsedDiscountedRetry",
  "createdAt"
FROM "Generation"
WHERE "createdAt" > (SELECT "createdAt" FROM "Generation" WHERE id = 'original_generation_id')
ORDER BY "createdAt" DESC
LIMIT 1;
```

**预期结果**：
- 两条记录的 `mode`、`features`、`refImages` 应该相同
- 原始记录的 `hasUsedDiscountedRetry` 应该是 `true`
- 重试记录的 `hasUsedDiscountedRetry` 应该是 `false`

### 方法 3：前端验证

1. 生成一张图片（记录参数）
2. 点击"优惠重试"
3. 对比两次生成的结果
4. 确认风格和构图一致

## 常见问题

### Q1: 重试后提示词还是不一样？
**A**: 
1. 确认已重启服务器
2. 检查数据库中原始记录的 `mode` 字段是否正确
3. 查看服务器日志中的提示词查找参数

### Q2: 克隆模式重试后变成创意模式？
**A**: 
1. 确认修复已应用
2. 检查原始记录的 `mode` 字段
3. 如果原始记录的 `mode` 是 null，运行数据库修复脚本

### Q3: 重试后参考图丢失？
**A**: 
1. 确认原始记录的 `refImages` 字段有值
2. 检查重试时是否正确读取了 `refImages`
3. 查看 n8n payload 中的 `ref_image_count`

## 数据库修复

如果旧的生成记录没有 `mode` 字段，可以运行修复脚本：

```bash
node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/fix-generation-modes.ts dotenv_config_path=.env.local
```

或者手动更新：

```sql
-- 将所有没有 mode 的记录设置为 CREATIVE
UPDATE "Generation"
SET mode = 'CREATIVE'
WHERE mode IS NULL;

-- 将 productType 为 CLONE_GENERAL 的记录设置为 CLONE
UPDATE "Generation"
SET mode = 'CLONE'
WHERE "productType" = 'CLONE_GENERAL' AND mode = 'CREATIVE';
```

## 影响范围

此修复影响：
- ✅ 主图重试（创意模式和克隆模式）
- ✅ 详情页重试（创意模式和克隆模式）
- ✅ 所有使用"优惠重试"功能的场景

不影响：
- ❌ 首次生成（不是重试）
- ❌ 已完成的历史记录（只影响新的重试）

## 相关文件

- 修复文件：
  - `app/api/generate/route.ts` - 后端优惠重试
  - `components/history-detail-dialog.tsx` - 前端详情页普通重试
  - `components/task-item.tsx` - 前端任务列表重试
- 相关文档：`CHANGELOG-MODE-SEPARATION.md`

## 注意事项

1. **向后兼容**：使用 `|| "CREATIVE"` 和 `|| ""` 提供默认值，兼容旧记录
2. **数据完整性**：确保重试时使用与原始生成完全相同的参数
3. **用户体验**：重试结果应该与原始生成风格一致
