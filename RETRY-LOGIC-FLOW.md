# 重试逻辑流程说明

## 概述

系统有两种重试方式：
1. **优惠重试**：每条记录只能使用一次，价格优惠（99积分）
2. **普通重试**：可以无限次使用，标准价格（199积分）

## 完整流程图

```
用户点击重试按钮
    ↓
前端判断：是否已使用优惠重试？
    ↓
┌─────────────────────────────────────┐
│  已使用优惠 (hasUsedDiscountedRetry=true)  │
│  → 只显示"重新生成"按钮（标准价格）        │
└─────────────────────────────────────┘
    ↓
    调用 /api/generate
    传递完整参数（不含 retryFromId）
    ↓
    后端标准流程
    ↓
    创建新的 Generation 记录
    ↓
    发送到 n8n 生成

┌─────────────────────────────────────┐
│  未使用优惠 (hasUsedDiscountedRetry=false) │
│  → 显示"优惠重试"按钮（优惠价格）         │
└─────────────────────────────────────┘
    ↓
    调用 /api/generate
    传递 { retryFromId: "原始记录ID" }
    ↓
    后端优惠重试流程
    ↓
    从原始记录读取所有参数
    ↓
    标记原始记录 hasUsedDiscountedRetry=true
    ↓
    创建新的 Generation 记录
    ↓
    发送到 n8n 生成
```

## 详细流程

### 1. 前端判断逻辑

#### 位置：`components/task-item.tsx` 和 `components/history-detail-dialog.tsx`

```typescript
// 判断是否可以使用优惠重试
const isDiscountAvailable = !item.hasUsedDiscountedRetry

// 根据是否有优惠决定价格
const standardCost = item.taskType === "DETAIL_PAGE" ? 199 : 199
const retryCost = item.taskType === "DETAIL_PAGE" ? 99 : 99
const cost = isDiscountAvailable ? retryCost : standardCost
```

**UI 显示**：
- 如果 `hasUsedDiscountedRetry = false`：显示"优惠重试 (99积分)"
- 如果 `hasUsedDiscountedRetry = true`：显示"重新生成 (199积分)"

### 2. 前端发送请求

#### A. 优惠重试（第一次重试）

**位置**：`components/task-item.tsx` 第 84-94 行

```typescript
const requestBody = isDiscountAvailable
  ? { retryFromId: item.id }  // ← 只传 ID，后端会读取原始记录
  : {
      // 普通重试的参数...
    }
```

**发送到后端**：
```json
{
  "retryFromId": "clx123abc..."
}
```

#### B. 普通重试（第二次及以后）

**位置**：`components/task-item.tsx` 第 84-94 行 和 `components/history-detail-dialog.tsx` 第 268-281 行

```typescript
const requestBody = {
  productName: item.productName,
  productType: item.productType,
  taskType: item.taskType || "MAIN_IMAGE",
  images: item.originalImage,
  platformKey: "SHOPEE",
  outputLanguage: item.outputLanguage || "简体中文",
  mode: item.mode || "CREATIVE",  // ✅ 修复后添加
  features: item.features || "",  // ✅ 修复后添加
  refImages: item.refImages || [],  // ✅ 修复后添加
}
```

**发送到后端**：
```json
{
  "productName": "测试商品",
  "productType": "CLONE_GENERAL",
  "taskType": "MAIN_IMAGE",
  "images": ["商品图1.jpg", "商品图2.jpg"],
  "platformKey": "SHOPEE",
  "outputLanguage": "简体中文",
  "mode": "CLONE",
  "features": "防水、耐磨",
  "refImages": ["参考图1.jpg", "参考图2.jpg"]
}
```

### 3. 后端处理逻辑

#### 位置：`app/api/generate/route.ts`

```typescript
// 第 129 行：接收 retryFromId 参数
const retryFromId = body?.retryFromId as string | undefined

// 第 137 行：判断是否是 combo 模式
if (withDetailCombo && !retryFromId) {
  return handleComboGeneration(...)
}

// 第 144 行：进入单任务处理
return handleSingleGeneration(body, userId, session, costs, retryFromId)
```

#### A. 优惠重试流程（有 retryFromId）

**位置**：`app/api/generate/route.ts` 第 530-559 行

```typescript
if (retryFromId) {
  // 1. 查询原始记录
  const originalGeneration = await prisma.generation.findUnique({
    where: { id: retryFromId },
  })

  // 2. 验证权限和状态
  if (!originalGeneration) throw new Error("原始记录不存在")
  if (originalGeneration.userId !== userId) throw new Error("无权重试")
  if (originalGeneration.hasUsedDiscountedRetry) throw new Error("已使用过优惠")

  // 3. 从原始记录读取所有参数
  taskType = originalGeneration.taskType || "MAIN_IMAGE"
  actualCost = getRetryCost(taskType, costs)  // 优惠价格
  productName = originalGeneration.productName
  productType = originalGeneration.productType as ProductTypeKey
  imageUrls = originalGeneration.originalImage
  platformKey = "SHOPEE"
  outputLanguage = originalGeneration.outputLanguage || "简体中文"
  mode = originalGeneration.mode || "CREATIVE"  // ✅ 修复后添加
  features = originalGeneration.features || ""  // ✅ 修复后添加
  refImages = originalGeneration.refImages || []  // ✅ 修复后添加
}
```

**关键点**：
- 使用优惠价格：`getRetryCost(taskType, costs)`
- 从原始记录读取所有参数，确保一致性
- 后续会标记原始记录 `hasUsedDiscountedRetry = true`

#### B. 普通重试流程（无 retryFromId）

**位置**：`app/api/generate/route.ts` 第 560-620 行

```typescript
else {
  // 标准流程：从请求 body 中读取参数
  productName = String(body?.productName ?? "").trim()
  productType = String(body?.productType ?? "").trim() as ProductTypeKey
  platformKey = String(body?.platformKey ?? "SHOPEE").trim().toUpperCase()
  taskType = String(body?.taskType ?? "MAIN_IMAGE").trim().toUpperCase()
  outputLanguage = String(body?.outputLanguage ?? "简体中文").trim()
  mode = String(body?.mode ?? "CREATIVE").trim().toUpperCase()
  features = String(body?.features ?? "").trim()
  actualCost = getStandardCost(taskType, costs)  // 标准价格
  
  // 解析图片
  const rawImages = body?.images
  const rawRefImages = body?.refImages
  // ...
}
```

**关键点**：
- 使用标准价格：`getStandardCost(taskType, costs)`
- 从请求 body 中读取参数
- 前端必须传递完整参数（包括 mode、features、refImages）

### 4. 后端扣费和标记

**位置**：`app/api/generate/route.ts` 第 622-651 行

```typescript
const deductResult = await prisma.$transaction(async (tx: TxClient) => {
  // 1. 扣除积分
  await tx.user.update({
    where: { id: userId },
    data: {
      credits: { decrement: Math.min(actualCost, userRow.credits) },
      bonusCredits: { decrement: Math.max(0, actualCost - userRow.credits) },
    },
  })

  // 2. 记录积分流水
  await tx.creditRecord.create({
    data: {
      userId,
      amount: -actualCost,
      type: "CONSUME",
      description: retryFromId ? `折扣重试: ${productName}` : `生成图片: ${productName}`,
    },
  })

  // 3. 如果是优惠重试，标记原始记录
  if (retryFromId) {
    await tx.generation.update({
      where: { id: retryFromId },
      data: { hasUsedDiscountedRetry: true },  // ← 标记已使用
    })
  }
})
```

**关键点**：
- 优惠重试：标记原始记录 `hasUsedDiscountedRetry = true`
- 下次重试时，前端会检测到这个标志，只显示"重新生成"按钮

### 5. 查找提示词

**位置**：`app/api/generate/route.ts` 第 680-750 行

```typescript
// 根据 mode 查找对应的提示词
if (mode === "CLONE") {
  // 查找克隆模式的提示词
  promptRecord = await prisma.productTypePrompt.findFirst({
    where: { 
      isActive: true, 
      mode: "CLONE", 
      productType, 
      taskType, 
      // ...
    },
  })
} else {
  // 查找创意模式的提示词
  promptRecord = await prisma.productTypePrompt.findFirst({
    where: { 
      isActive: true, 
      mode: "CREATIVE", 
      productType, 
      taskType, 
      // ...
    },
  })
}
```

**关键点**：
- 根据 `mode` 字段查找对应模式的提示词
- 确保重试时使用与原始生成相同的提示词

### 6. 构建 n8n Payload

**位置**：`app/api/generate/route.ts` 第 780-796 行

```typescript
const n8nPayload: Record<string, any> = {
  username: (session?.user as any)?.username ?? null,
  generation_id: generationId,
  product_name: productName,
  product_type: ProductTypePromptKey[productType as ProductTypeKey] || productType,
  prompt_template: filledPrompt,
  images: mode === "CLONE" ? [...refImages, ...imageUrls] : imageUrls,  // 克隆模式：参考图在前
  image_count: mode === "CLONE" ? refImages.length + imageUrls.length : imageUrls.length,
  output_language: outputLanguage,
  mode,
}

// 克隆模式额外字段
if (mode === "CLONE") {
  n8nPayload.features = features
  n8nPayload.ref_image_count = refImages.length
}
```

**关键点**：
- 克隆模式：参考图在前，商品图在后
- 包含 `ref_image_count` 字段，方便 n8n 识别

### 7. 创建新的 Generation 记录

**位置**：`app/api/generate/route.ts` 第 660-680 行

```typescript
const newGeneration = await tx.generation.create({
  data: {
    userId,
    productName,
    productType,
    taskType,
    mode,  // ← 保存模式
    features,  // ← 保存卖点
    refImages,  // ← 保存参考图
    originalImage: imageUrls,
    status: "PENDING",
    hasUsedDiscountedRetry: Boolean(retryFromId),  // ← 新记录标记为已使用（如果是优惠重试）
    outputLanguage,
  },
})
```

**关键点**：
- 新记录保存完整的参数
- 如果是优惠重试创建的记录，`hasUsedDiscountedRetry` 会被设置为 `true`
- 这样新记录也只能使用一次优惠重试

## 数据库状态变化

### 优惠重试前

```
原始记录:
  id: "abc123"
  productName: "测试商品"
  mode: "CLONE"
  hasUsedDiscountedRetry: false  ← 可以使用优惠
```

### 优惠重试后

```
原始记录:
  id: "abc123"
  productName: "测试商品"
  mode: "CLONE"
  hasUsedDiscountedRetry: true  ← 已使用优惠

新记录:
  id: "def456"
  productName: "测试商品"
  mode: "CLONE"  ← 与原始记录相同
  hasUsedDiscountedRetry: true  ← 新记录也标记为已使用
```

### 普通重试后

```
原始记录:
  id: "abc123"
  productName: "测试商品"
  mode: "CLONE"
  hasUsedDiscountedRetry: true

第一次重试记录:
  id: "def456"
  productName: "测试商品"
  mode: "CLONE"
  hasUsedDiscountedRetry: true

第二次重试记录:
  id: "ghi789"
  productName: "测试商品"
  mode: "CLONE"  ← 与原始记录相同
  hasUsedDiscountedRetry: false  ← 新记录可以再次使用优惠
```

## 关键修复点

### 修复前的问题

1. **后端优惠重试**：没有从原始记录读取 `mode`、`features`、`refImages`
2. **前端普通重试**：没有传递 `mode`、`features`、`refImages`

### 修复后的保证

1. ✅ 优惠重试：从原始记录读取所有参数
2. ✅ 普通重试：前端传递所有参数
3. ✅ 两种重试都使用与原始生成相同的模式和提示词
4. ✅ 克隆模式不会变成创意模式
5. ✅ 卖点和参考图不会丢失

## 常见问题

### Q1: 为什么优惠重试只传 retryFromId，普通重试要传所有参数？

**A**: 
- **优惠重试**：后端需要验证原始记录的状态（是否已使用优惠），所以必须查询原始记录，顺便读取所有参数
- **普通重试**：不需要查询原始记录，直接使用前端传递的参数，更高效

### Q2: 为什么新记录的 hasUsedDiscountedRetry 也是 true？

**A**: 
- 如果是通过优惠重试创建的记录，它本身就是"优惠重试的结果"
- 设置为 `true` 可以防止用户对这条记录再次使用优惠重试
- 但用户可以对这条记录使用普通重试（标准价格）

### Q3: 如果用户对新记录再次点击重试会怎样？

**A**: 
- 因为 `hasUsedDiscountedRetry = true`，前端只会显示"重新生成"按钮（标准价格）
- 点击后会走普通重试流程，创建另一条新记录
- 新记录的 `hasUsedDiscountedRetry = false`，可以再次使用优惠重试

### Q4: 为什么克隆模式的图片顺序是参考图在前？

**A**: 
- n8n 工作流需要知道哪些是参考图，哪些是商品图
- 通过 `ref_image_count` 字段，n8n 可以知道前 N 张是参考图
- 例如：`ref_image_count = 2`，则 `images[0]` 和 `images[1]` 是参考图

## 总结

整个重试逻辑的核心是：
1. **优惠重试**：后端从原始记录读取参数，确保一致性
2. **普通重试**：前端传递完整参数，后端直接使用
3. **模式一致性**：无论哪种重试，都使用与原始生成相同的 mode、features、refImages
4. **价格控制**：通过 `hasUsedDiscountedRetry` 标志控制优惠使用次数
