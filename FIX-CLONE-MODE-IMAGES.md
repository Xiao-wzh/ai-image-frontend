# 克隆模式图片顺序修复

## 问题描述

在克隆模式下，参考图和商品图需要都放在 `images` 字段中传给 n8n，并且**参考图的 URL 必须在数组前面**，商品图的 URL 在后面。

之前的实现是：
- `images` 字段：只包含商品图
- `ref_images` 字段：包含参考图（单独的字段）

这导致 n8n 无法正确识别参考图的位置。

## 修复方案

### 修改 `app/api/generate/route.ts`

将参考图和商品图合并到 `images` 字段中，参考图在前：

```typescript
// 修复前
const n8nPayload: Record<string, any> = {
  // ...
  images: imageUrls,  // 只有商品图
  image_count: imageUrls.length,
  // ...
}

if (mode === "CLONE") {
  n8nPayload.features = features
  n8nPayload.ref_images = refImages  // 参考图在单独的字段
  n8nPayload.ref_image_count = refImages.length
}

// 修复后
const n8nPayload: Record<string, any> = {
  // ...
  images: mode === "CLONE" ? [...refImages, ...imageUrls] : imageUrls,  // 克隆模式：参考图在前，商品图在后
  image_count: mode === "CLONE" ? refImages.length + imageUrls.length : imageUrls.length,
  // ...
}

if (mode === "CLONE") {
  n8nPayload.features = features
  n8nPayload.ref_image_count = refImages.length  // 保留参考图数量，方便 n8n 识别
}
```

## 修复后的行为

### 创意模式
```json
{
  "images": [
    "https://商品图1.jpg",
    "https://商品图2.jpg"
  ],
  "image_count": 2,
  "mode": "CREATIVE"
}
```

### 克隆模式
```json
{
  "images": [
    "https://参考图1.jpg",  // ← 参考图在前
    "https://参考图2.jpg",
    "https://商品图1.jpg",  // ← 商品图在后
    "https://商品图2.jpg"
  ],
  "image_count": 4,
  "ref_image_count": 2,  // ← 告诉 n8n 前 2 张是参考图
  "features": "防水、耐磨、轻便",
  "mode": "CLONE"
}
```

## n8n 工作流处理

在 n8n 工作流中，可以这样处理：

```javascript
// 获取参考图数量
const refImageCount = $json.ref_image_count || 0;

// 分离参考图和商品图
const refImages = $json.images.slice(0, refImageCount);  // 前 N 张是参考图
const productImages = $json.images.slice(refImageCount);  // 后面的是商品图

// 或者直接使用所有图片
const allImages = $json.images;  // 参考图在前，商品图在后
```

## 优势

1. **简化数据结构**：不需要维护两个独立的图片数组
2. **顺序明确**：参考图始终在前，商品图在后
3. **向后兼容**：保留 `ref_image_count` 字段，n8n 可以知道前几张是参考图
4. **创意模式不受影响**：创意模式下 `images` 仍然只包含商品图

## 测试步骤

### 1. 测试克隆模式

1. 选择克隆模式
2. 上传 2 张参考图
3. 上传 2 张商品图
4. 填写卖点
5. 点击生成

**预期 n8n payload**：
```json
{
  "images": [
    "参考图1_url",
    "参考图2_url",
    "商品图1_url",
    "商品图2_url"
  ],
  "image_count": 4,
  "ref_image_count": 2,
  "features": "...",
  "mode": "CLONE"
}
```

### 2. 测试创意模式

1. 选择创意模式
2. 上传 2 张商品图
3. 点击生成

**预期 n8n payload**：
```json
{
  "images": [
    "商品图1_url",
    "商品图2_url"
  ],
  "image_count": 2,
  "mode": "CREATIVE"
}
```

## 验证方法

查看服务器日志中的 `[N8N_REQUEST]` 输出：

```bash
# 克隆模式
[N8N_REQUEST] User: xxx, Payload: {
  "images": [
    "https://xxx/ref1.jpg",  // ← 参考图在前
    "https://xxx/ref2.jpg",
    "https://xxx/product1.jpg",  // ← 商品图在后
    "https://xxx/product2.jpg"
  ],
  "image_count": 4,
  "ref_image_count": 2,
  "mode": "CLONE"
}

# 创意模式
[N8N_REQUEST] User: xxx, Payload: {
  "images": [
    "https://xxx/product1.jpg",
    "https://xxx/product2.jpg"
  ],
  "image_count": 2,
  "mode": "CREATIVE"
}
```

## 数据库影响

此修改不影响数据库结构，因为：
- 数据库中仍然分别存储 `originalImage`（商品图）和 `refImages`（参考图）
- 只是在发送给 n8n 时合并成一个数组
- 顺序由代码控制：`[...refImages, ...imageUrls]`

## 注意事项

1. **n8n 工作流需要更新**：
   - 移除对 `ref_images` 字段的依赖
   - 使用 `ref_image_count` 来分离参考图和商品图
   - 或者直接使用 `images` 数组（参考图在前）

2. **提示词模板**：
   - 确保克隆模式的提示词模板中使用 `${refImageCount}` 变量
   - 例如："根据以下 ${refImageCount} 张参考图的构图方式..."

3. **向后兼容**：
   - 如果 n8n 工作流还在使用 `ref_images` 字段，需要先更新工作流
   - 或者暂时保留 `ref_images` 字段（同时发送两个字段）

## 相关文件

- 修改文件：`app/api/generate/route.ts`
- 相关文档：`CHANGELOG-MODE-SEPARATION.md`
