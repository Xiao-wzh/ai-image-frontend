# 重试逻辑简化说明

## 一句话总结

- **优惠重试**：只传 `retryFromId`，后端从原始记录读取所有参数（99积分，每条记录限用一次）
- **普通重试**：前端传所有参数，后端直接使用（199积分，无限次）

## 快速对比

| 特性 | 优惠重试 | 普通重试 |
|------|---------|---------|
| **价格** | 99积分 | 199积分 |
| **使用次数** | 每条记录1次 | 无限次 |
| **前端传参** | `{ retryFromId: "xxx" }` | 完整参数 |
| **后端读参** | 从数据库读取原始记录 | 从请求body读取 |
| **标记字段** | `hasUsedDiscountedRetry = true` | 不标记 |
| **按钮文字** | "优惠重试 (99积分)" | "重新生成 (199积分)" |

## 代码位置速查

### 前端

| 文件 | 行数 | 功能 |
|------|------|------|
| `components/task-item.tsx` | 50-110 | 任务列表的重试按钮 |
| `components/history-detail-dialog.tsx` | 247-340 | 详情页的重试按钮 |

### 后端

| 文件 | 行数 | 功能 |
|------|------|------|
| `app/api/generate/route.ts` | 129 | 接收 retryFromId |
| `app/api/generate/route.ts` | 530-559 | 优惠重试：读取原始记录 |
| `app/api/generate/route.ts` | 560-620 | 普通重试：读取请求参数 |
| `app/api/generate/route.ts` | 644-651 | 标记 hasUsedDiscountedRetry |

## 关键字段

### Generation 表

```typescript
{
  id: string                    // 记录ID
  productName: string           // 商品名称
  productType: string           // 产品类型
  taskType: string              // MAIN_IMAGE / DETAIL_PAGE
  mode: string                  // CREATIVE / CLONE
  features: string              // 卖点（克隆模式）
  refImages: string[]           // 参考图（克隆模式）
  originalImage: string[]       // 商品图
  hasUsedDiscountedRetry: boolean  // 是否已使用优惠重试
  outputLanguage: string        // 输出语言
}
```

## 修复前后对比

### 修复前

```typescript
// ❌ 优惠重试：缺少 mode, features, refImages
mode = "CREATIVE"  // 默认值
features = ""
refImages = []

// ❌ 普通重试：前端不传 mode, features, refImages
body: {
  productName: "xxx",
  productType: "xxx",
  // 缺少 mode, features, refImages
}
```

**结果**：克隆模式重试后变成创意模式 ❌

### 修复后

```typescript
// ✅ 优惠重试：从原始记录读取
mode = originalGeneration.mode || "CREATIVE"
features = originalGeneration.features || ""
refImages = originalGeneration.refImages || []

// ✅ 普通重试：前端传递完整参数
body: {
  productName: "xxx",
  productType: "xxx",
  mode: item.mode || "CREATIVE",
  features: item.features || "",
  refImages: item.refImages || [],
}
```

**结果**：克隆模式重试后仍是克隆模式 ✅

## 测试检查清单

- [ ] 创意模式 + 优惠重试 → 仍是创意模式
- [ ] 创意模式 + 普通重试 → 仍是创意模式
- [ ] 克隆模式 + 优惠重试 → 仍是克隆模式
- [ ] 克隆模式 + 普通重试 → 仍是克隆模式
- [ ] 优惠重试后，原始记录 `hasUsedDiscountedRetry = true`
- [ ] 优惠重试后，只显示"重新生成"按钮
- [ ] 克隆模式重试后，卖点和参考图不丢失

## 相关文档

- 详细流程：`RETRY-LOGIC-FLOW.md`
- 修复说明：`FIX-RETRY-MODE-CONSISTENCY.md`
- 完整更新日志：`CHANGELOG-MODE-SEPARATION.md`
