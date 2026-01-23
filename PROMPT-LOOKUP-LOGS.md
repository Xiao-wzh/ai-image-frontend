# 提示词查找日志说明

## 日志格式

现在在查找提示词时，会输出详细的日志，方便调试和排查问题。

### 初始参数日志

```
[PROMPT_LOOKUP] Starting prompt lookup with params: {
  platformKey: 'SHOPEE',
  productType: 'MENSWEAR',
  taskType: 'MAIN_IMAGE',
  mode: 'CREATIVE',
  userId: 'clx123abc...'
}
```

**说明**：显示查找提示词时使用的初始参数。

### 查找步骤日志

#### 克隆模式（5个回退步骤）

```
[PROMPT_LOOKUP] CLONE mode - trying 5 fallback steps...

[PROMPT_LOOKUP] Step 1 - User specific: {
  isActive: true,
  mode: 'CLONE',
  productType: 'CLONE_GENERAL',
  taskType: 'MAIN_IMAGE',
  userId: 'clx123abc...',
  platform: { key: 'SHOPEE' }
}

[PROMPT_LOOKUP] Step 2 - System specific: {
  isActive: true,
  mode: 'CLONE',
  productType: 'CLONE_GENERAL',
  taskType: 'MAIN_IMAGE',
  userId: null,
  platform: { key: 'SHOPEE' }
}
✅ Found at Step 2
```

**说明**：
- Step 1：查找用户私有的特定产品类型提示词
- Step 2：查找系统默认的特定产品类型提示词 ← 通常在这里找到
- Step 3：查找用户私有的 CLONE_GENERAL 提示词
- Step 4：查找系统默认的 CLONE_GENERAL 提示词（当前平台）
- Step 5：查找系统默认的 CLONE_GENERAL 提示词（GENERAL 平台）

#### 创意模式 - 详情页（3个回退步骤）

```
[PROMPT_LOOKUP] CREATIVE mode - DETAIL_PAGE - trying 3 fallback steps...

[PROMPT_LOOKUP] Step 1 - User specific: {
  isActive: true,
  taskType: 'DETAIL_PAGE',
  mode: 'CREATIVE',
  userId: 'clx123abc...',
  platform: { key: 'SHOPEE' }
}

[PROMPT_LOOKUP] Step 2 - System on platform: {
  isActive: true,
  taskType: 'DETAIL_PAGE',
  mode: 'CREATIVE',
  userId: null,
  platform: { key: 'SHOPEE' }
}
✅ Found at Step 2
```

**说明**：
- Step 1：查找用户私有的详情页提示词
- Step 2：查找系统默认的详情页提示词（当前平台）← 通常在这里找到
- Step 3：查找系统默认的详情页提示词（GENERAL 平台）

#### 创意模式 - 主图（3个回退步骤）

```
[PROMPT_LOOKUP] CREATIVE mode - MAIN_IMAGE - trying 3 fallback steps...

[PROMPT_LOOKUP] Step 1 - User specific: {
  isActive: true,
  productType: 'MENSWEAR',
  taskType: 'MAIN_IMAGE',
  mode: 'CREATIVE',
  userId: 'clx123abc...',
  platform: { key: 'SHOPEE' }
}

[PROMPT_LOOKUP] Step 2 - System on platform: {
  isActive: true,
  productType: 'MENSWEAR',
  taskType: 'MAIN_IMAGE',
  mode: 'CREATIVE',
  userId: null,
  platform: { key: 'SHOPEE' }
}
✅ Found at Step 2
```

**说明**：
- Step 1：查找用户私有的特定产品类型提示词
- Step 2：查找系统默认的特定产品类型提示词（当前平台）← 通常在这里找到
- Step 3：查找系统默认的特定产品类型提示词（GENERAL 平台）

### 最终结果日志

#### 成功找到

```
[PROMPT_LOOKUP] ✅ Final prompt found: {
  id: 'clx456def...',
  productType: 'MENSWEAR',
  taskType: 'MAIN_IMAGE',
  mode: 'CREATIVE',
  description: '男装'
}
```

#### 未找到

```
[PROMPT_LOOKUP] ❌ No prompt found after all fallback steps
Error: 未找到 Prompt 模板：platformKey=SHOPEE, productType=MENSWEAR, taskType=MAIN_IMAGE, mode=CREATIVE
```

## 常见日志场景

### 场景 1：创意模式主图生成

```
[PROMPT_LOOKUP] Starting prompt lookup with params: {
  platformKey: 'SHOPEE',
  productType: 'MENSWEAR',
  taskType: 'MAIN_IMAGE',
  mode: 'CREATIVE',
  userId: 'clx123abc...'
}
[PROMPT_LOOKUP] CREATIVE mode - MAIN_IMAGE - trying 3 fallback steps...
[PROMPT_LOOKUP] Step 1 - User specific: {...}
[PROMPT_LOOKUP] Step 2 - System on platform: {...}
[PROMPT_LOOKUP] ✅ Found at Step 2
[PROMPT_LOOKUP] ✅ Final prompt found: {
  id: 'clx456def...',
  productType: 'MENSWEAR',
  taskType: 'MAIN_IMAGE',
  mode: 'CREATIVE',
  description: '男装'
}
```

### 场景 2：克隆模式主图生成

```
[PROMPT_LOOKUP] Starting prompt lookup with params: {
  platformKey: 'SHOPEE',
  productType: 'CLONE_GENERAL',
  taskType: 'MAIN_IMAGE',
  mode: 'CLONE',
  userId: 'clx123abc...'
}
[PROMPT_LOOKUP] CLONE mode - trying 5 fallback steps...
[PROMPT_LOOKUP] Step 1 - User specific: {...}
[PROMPT_LOOKUP] Step 2 - System specific: {...}
[PROMPT_LOOKUP] ✅ Found at Step 2
[PROMPT_LOOKUP] ✅ Final prompt found: {
  id: 'clx789ghi...',
  productType: 'CLONE_GENERAL',
  taskType: 'MAIN_IMAGE',
  mode: 'CLONE',
  description: '克隆模式通用'
}
```

### 场景 3：详情页生成

```
[PROMPT_LOOKUP] Starting prompt lookup with params: {
  platformKey: 'SHOPEE',
  productType: 'MENSWEAR',
  taskType: 'DETAIL_PAGE',
  mode: 'CREATIVE',
  userId: 'clx123abc...'
}
[PROMPT_LOOKUP] CREATIVE mode - DETAIL_PAGE - trying 3 fallback steps...
[PROMPT_LOOKUP] Step 1 - User specific: {...}
[PROMPT_LOOKUP] Step 2 - System on platform: {...}
[PROMPT_LOOKUP] ✅ Found at Step 2
[PROMPT_LOOKUP] ✅ Final prompt found: {
  id: 'clx012jkl...',
  productType: 'MENSWEAR',
  taskType: 'DETAIL_PAGE',
  mode: 'CREATIVE',
  description: '男装详情页'
}
```

### 场景 4：重试时的日志

#### 优惠重试

```
[GENERATE_API] Discount retry mode for MAIN_IMAGE - setting actualCost to 99
[PROMPT_LOOKUP] Starting prompt lookup with params: {
  platformKey: 'SHOPEE',
  productType: 'CLONE_GENERAL',
  taskType: 'MAIN_IMAGE',
  mode: 'CLONE',  ← 从原始记录读取
  userId: 'clx123abc...'
}
```

#### 普通重试

```
[PROMPT_LOOKUP] Starting prompt lookup with params: {
  platformKey: 'SHOPEE',
  productType: 'CLONE_GENERAL',
  taskType: 'MAIN_IMAGE',
  mode: 'CLONE',  ← 从前端传递
  userId: 'clx123abc...'
}
```

## 排查问题

### 问题 1：提示词未找到

**日志**：
```
[PROMPT_LOOKUP] ❌ No prompt found after all fallback steps
```

**可能原因**：
1. 数据库中没有对应的提示词
2. mode 字段不匹配
3. productType 不匹配
4. 提示词被禁用（isActive = false）

**解决方法**：
1. 运行初始化脚本：
   ```bash
   node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/init-prompts.ts dotenv_config_path=.env.local
   ```
2. 检查数据库中的提示词：
   ```sql
   SELECT * FROM "ProductTypePrompt" 
   WHERE "isActive" = true 
   AND mode = 'CLONE' 
   AND "taskType" = 'MAIN_IMAGE';
   ```

### 问题 2：使用了错误的提示词

**日志**：
```
[PROMPT_LOOKUP] ✅ Final prompt found: {
  mode: 'CREATIVE',  ← 应该是 CLONE
  ...
}
```

**可能原因**：
1. 重试时 mode 参数丢失
2. 前端传递的 mode 参数错误

**解决方法**：
1. 检查重试时是否传递了 mode 参数
2. 查看前面的日志，确认初始参数中的 mode 值

### 问题 3：找到了用户私有提示词而不是系统默认

**日志**：
```
[PROMPT_LOOKUP] ✅ Found at Step 1
```

**说明**：
- 这是正常的，用户私有提示词优先级最高
- 如果不想使用私有提示词，可以在管理后台禁用或删除

## 日志级别

所有日志都使用 `console.log` 输出，在生产环境中可以通过环境变量控制：

```typescript
// 可以添加环境变量控制
const DEBUG_PROMPT_LOOKUP = process.env.DEBUG_PROMPT_LOOKUP === 'true'

if (DEBUG_PROMPT_LOOKUP) {
  console.log('[PROMPT_LOOKUP] ...')
}
```

## 相关日志

除了提示词查找日志，还有其他相关日志：

- `[GENERATE_API]`：生成 API 的主要流程
- `[N8N_REQUEST]`：发送到 n8n 的请求
- `[COMBO_MODE]`：组合模式（主图+详情页）

## 总结

通过这些详细的日志，你可以：
1. ✅ 确认查找提示词时使用的参数
2. ✅ 了解查找的回退步骤
3. ✅ 知道最终使用了哪个提示词
4. ✅ 快速定位问题（mode 不匹配、提示词缺失等）
