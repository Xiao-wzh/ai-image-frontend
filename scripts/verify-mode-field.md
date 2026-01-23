# 验证 mode 字段是否正确返回

## 问题描述

管理后台的提示词列表 API 之前没有返回 `mode` 字段，导致前端无法识别提示词的模式（创意/克隆）。

## 修复内容

在 `app/api/admin/prompts/route.ts` 的 select 中添加了 `mode: true`。

## 验证步骤

### 方法 1：浏览器开发者工具

1. 打开管理后台的提示词管理页面
2. 打开浏览器开发者工具（F12）
3. 切换到 Network 标签
4. 刷新页面
5. 找到 `/api/admin/prompts?scope=all` 请求
6. 查看 Response 数据

**预期结果**：每个 prompt 对象都应该包含 `mode` 字段：

```json
{
  "success": true,
  "platforms": [
    {
      "id": "...",
      "key": "SHOPEE",
      "label": "虾皮 (Shopee)",
      "prompts": [
        {
          "id": "...",
          "productType": "MENSWEAR",
          "taskType": "MAIN_IMAGE",
          "mode": "CREATIVE",  // ✅ 应该有这个字段
          "description": "男装",
          "promptTemplate": "...",
          "isActive": true,
          "userId": null,
          "createdAt": "...",
          "updatedAt": "..."
        }
      ]
    }
  ]
}
```

### 方法 2：直接访问 API

使用 curl 或浏览器直接访问（需要管理员权限）：

```bash
curl -X GET "http://localhost:3000/api/admin/prompts?scope=all" \
  -H "Cookie: your-session-cookie"
```

或在浏览器中直接访问：
```
http://localhost:3000/api/admin/prompts?scope=all
```

### 方法 3：检查前端控制台

1. 打开管理后台的提示词管理页面
2. 打开浏览器控制台（F12 → Console）
3. 输入以下代码：

```javascript
fetch('/api/admin/prompts?scope=all')
  .then(r => r.json())
  .then(data => {
    const firstPrompt = data.platforms[0]?.prompts[0]
    console.log('First prompt:', firstPrompt)
    console.log('Has mode field:', 'mode' in firstPrompt)
    console.log('Mode value:', firstPrompt?.mode)
  })
```

**预期输出**：
```
First prompt: {id: "...", productType: "...", mode: "CREATIVE", ...}
Has mode field: true
Mode value: CREATIVE
```

## 验证前端过滤

1. 在管理后台提示词管理页面
2. 切换到"创意模式"标签
3. 检查列表中的提示词是否都是创意模式的
4. 切换到"克隆模式"标签
5. 检查列表中的提示词是否都是克隆模式的

**预期结果**：
- ✅ 创意模式标签：只显示 mode="CREATIVE" 的提示词
- ✅ 克隆模式标签：只显示 mode="CLONE" 的提示词
- ❌ 不应该出现混合的情况

## 常见问题

### Q1: API 返回的数据中没有 mode 字段？
**A**: 
1. 确认已经修改了 `app/api/admin/prompts/route.ts`
2. 重启开发服务器（Ctrl+C 然后 npm run dev）
3. 清除浏览器缓存并刷新

### Q2: mode 字段的值是 null 或 undefined？
**A**: 
1. 运行数据库修复脚本：
   ```bash
   node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/fix-prompt-modes.ts dotenv_config_path=.env.local
   ```
2. 或重新初始化提示词：
   ```bash
   node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/init-prompts.ts dotenv_config_path=.env.local
   ```

### Q3: 前端过滤不工作？
**A**: 
1. 确认 TypeScript 接口已更新（`Prompt` 接口包含 `mode: string`）
2. 确认过滤逻辑已修复（使用 `p.mode` 而不是 `(p as any).mode`）
3. 清除浏览器缓存并刷新

## 数据库检查

如果需要直接检查数据库中的 mode 字段：

```sql
-- 查看所有提示词的 mode 字段
SELECT id, "productType", "taskType", mode, description 
FROM "ProductTypePrompt" 
WHERE "userId" IS NULL
ORDER BY mode, "taskType", "productType";

-- 统计各模式的提示词数量
SELECT mode, COUNT(*) as count
FROM "ProductTypePrompt"
WHERE "userId" IS NULL
GROUP BY mode;
```

**预期结果**：
```
mode      | count
----------|------
CREATIVE  | 8
CLONE     | 4
```

## 成功标志

修复成功的标志：
- ✅ API 返回的每个 prompt 都有 mode 字段
- ✅ mode 字段的值是 "CREATIVE" 或 "CLONE"
- ✅ 前端可以正确过滤和显示不同模式的提示词
- ✅ 在克隆模式标签下创建的提示词出现在克隆模式列表中
- ✅ 在创意模式标签下创建的提示词出现在创意模式列表中
