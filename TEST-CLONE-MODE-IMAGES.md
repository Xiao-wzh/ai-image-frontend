# 克隆模式图片顺序测试

## 测试目标

验证克隆模式下，参考图和商品图都放在 `images` 字段中，并且参考图在前、商品图在后。

## 测试环境准备

1. 确保已运行数据库初始化脚本
2. 确保有克隆模式的提示词（CLONE_GENERAL）
3. 准备测试图片：
   - 2 张参考图（用于克隆风格）
   - 2 张商品图（实际商品）

## 测试场景

### 场景 1：克隆模式 - 标准流程

**步骤**：
1. 打开应用首页
2. 选择 "⚡ 克隆模式"
3. 选择平台和产品类型（如 Shopee / 克隆模式通用）
4. 输入商品名称："测试商品"
5. 输入卖点："防水、耐磨、轻便"
6. 上传参考图：
   - 参考图 1：ref1.jpg
   - 参考图 2：ref2.jpg
7. 上传商品图：
   - 商品图 1：product1.jpg
   - 商品图 2：product2.jpg
8. 点击"生成"

**预期结果**：

查看服务器日志 `[N8N_REQUEST]`：
```json
{
  "username": "test_user",
  "generation_id": "xxx",
  "product_name": "测试商品",
  "product_type": "CLONE_GENERAL",
  "prompt_template": "...",
  "images": [
    "https://xxx/ref1.jpg",      // ← 参考图 1（第一张）
    "https://xxx/ref2.jpg",      // ← 参考图 2（第二张）
    "https://xxx/product1.jpg",  // ← 商品图 1（第三张）
    "https://xxx/product2.jpg"   // ← 商品图 2（第四张）
  ],
  "image_count": 4,
  "ref_image_count": 2,
  "features": "防水、耐磨、轻便",
  "mode": "CLONE"
}
```

**验证点**：
- ✅ `images` 数组包含 4 张图片
- ✅ 前 2 张是参考图（ref1.jpg, ref2.jpg）
- ✅ 后 2 张是商品图（product1.jpg, product2.jpg）
- ✅ `image_count` = 4
- ✅ `ref_image_count` = 2
- ✅ `features` 字段存在
- ✅ `mode` = "CLONE"

### 场景 2：克隆模式 - 单张参考图

**步骤**：
1. 选择克隆模式
2. 上传 1 张参考图
3. 上传 3 张商品图
4. 点击生成

**预期结果**：
```json
{
  "images": [
    "https://xxx/ref1.jpg",      // ← 参考图（第一张）
    "https://xxx/product1.jpg",  // ← 商品图 1
    "https://xxx/product2.jpg",  // ← 商品图 2
    "https://xxx/product3.jpg"   // ← 商品图 3
  ],
  "image_count": 4,
  "ref_image_count": 1,
  "mode": "CLONE"
}
```

### 场景 3：克隆模式 - 多张参考图

**步骤**：
1. 选择克隆模式
2. 上传 3 张参考图
3. 上传 2 张商品图
4. 点击生成

**预期结果**：
```json
{
  "images": [
    "https://xxx/ref1.jpg",      // ← 参考图 1
    "https://xxx/ref2.jpg",      // ← 参考图 2
    "https://xxx/ref3.jpg",      // ← 参考图 3
    "https://xxx/product1.jpg",  // ← 商品图 1
    "https://xxx/product2.jpg"   // ← 商品图 2
  ],
  "image_count": 5,
  "ref_image_count": 3,
  "mode": "CLONE"
}
```

### 场景 4：创意模式 - 对比测试

**步骤**：
1. 选择 "✨ 创意模式"
2. 上传 2 张商品图
3. 点击生成

**预期结果**：
```json
{
  "images": [
    "https://xxx/product1.jpg",
    "https://xxx/product2.jpg"
  ],
  "image_count": 2,
  "mode": "CREATIVE"
  // ❌ 没有 ref_image_count 字段
  // ❌ 没有 features 字段
}
```

**验证点**：
- ✅ `images` 只包含商品图
- ✅ 没有 `ref_image_count` 字段
- ✅ 没有 `features` 字段
- ✅ `mode` = "CREATIVE"

### 场景 5：错误处理 - 克隆模式缺少参考图

**步骤**：
1. 选择克隆模式
2. 只上传商品图，不上传参考图
3. 点击生成

**预期结果**：
- ❌ 显示错误："克隆模式需要至少上传 1 张参考图"
- ❌ 不发送请求到 n8n

### 场景 6：错误处理 - 克隆模式缺少商品图

**步骤**：
1. 选择克隆模式
2. 只上传参考图，不上传商品图
3. 点击生成

**预期结果**：
- ❌ 显示错误："请至少上传 1 张图片"
- ❌ 不发送请求到 n8n

## 验证方法

### 方法 1：查看服务器日志

在终端中查看服务器输出：
```bash
npm run dev
```

生成时会看到：
```
[N8N_REQUEST] User: xxx, Payload: {
  "images": [...],
  "image_count": 4,
  "ref_image_count": 2,
  ...
}
```

### 方法 2：使用浏览器开发者工具

1. 打开浏览器开发者工具（F12）
2. 切换到 Network 标签
3. 点击生成
4. 找到 `/api/generate` 请求
5. 查看 Request Payload

### 方法 3：数据库验证

生成完成后，查看数据库：
```sql
SELECT 
  id,
  "productName",
  mode,
  "refImages",
  "originalImage",
  "createdAt"
FROM "Generation"
WHERE mode = 'CLONE'
ORDER BY "createdAt" DESC
LIMIT 1;
```

**预期结果**：
- `refImages` 数组包含参考图 URL
- `originalImage` 数组包含商品图 URL
- 两个数组是分开存储的（数据库层面）

## n8n 工作流验证

如果你有访问 n8n 的权限，可以在工作流中添加调试节点：

```javascript
// 在 n8n 工作流的第一个节点中
const payload = $json;

console.log('Total images:', payload.image_count);
console.log('Ref image count:', payload.ref_image_count);
console.log('Images array:', payload.images);

// 分离参考图和商品图
const refImages = payload.images.slice(0, payload.ref_image_count || 0);
const productImages = payload.images.slice(payload.ref_image_count || 0);

console.log('Reference images:', refImages);
console.log('Product images:', productImages);

return {
  json: {
    refImages,
    productImages,
    allImages: payload.images
  }
};
```

## 常见问题

### Q1: 图片顺序错误？
**A**: 
1. 确认前端上传时的顺序
2. 检查 `refImages` 和 `imageUrls` 变量的值
3. 确认使用了 `[...refImages, ...imageUrls]` 而不是 `[...imageUrls, ...refImages]`

### Q2: ref_image_count 不正确？
**A**: 
1. 检查前端是否正确传递了 `refImages` 数组
2. 确认 `refImages.length` 的值
3. 查看服务器日志中的 `refImages` 变量

### Q3: 创意模式也有 ref_image_count？
**A**: 
1. 确认前端没有在创意模式下传递 `refImages`
2. 检查 `mode === "CLONE"` 的条件判断

## 成功标志

测试通过的标志：
- ✅ 克隆模式：`images` 数组中参考图在前，商品图在后
- ✅ 克隆模式：`ref_image_count` 正确反映参考图数量
- ✅ 创意模式：`images` 只包含商品图，没有 `ref_image_count`
- ✅ 错误处理：缺少参考图或商品图时正确提示
- ✅ 数据库：`refImages` 和 `originalImage` 分开存储
- ✅ n8n：可以正确识别和处理图片顺序
