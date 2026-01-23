# 管理后台提示词模式问题修复

## 问题描述

用户在管理后台的提示词管理页面中，在"克隆模式"标签下创建新的提示词时，该提示词却出现在"创意模式"的列表中，而不是"克隆模式"的列表中。

## 根本原因

在 `components/admin/prompts-admin-client.tsx` 和 `app/api/admin/prompts/route.ts` 中存在两个问题：

1. **API 未返回 mode 字段**：管理后台的 API 在查询提示词时，select 中没有包含 `mode` 字段
2. **前端类型定义缺失**：TypeScript 接口 `Prompt` 中没有定义 `mode` 字段
3. **创建状态未重置**：当用户切换模式标签（创意 ↔ 克隆）时，`isCreating` 状态没有被重置
4. **mode 字段未同步**：用户可能在创意模式下点击"创建 Prompt"，然后切换到克隆模式标签，但 `editMode` 仍然是 "CREATIVE"
5. **用户无感知**：创建表单中没有显示当前的创建模式，用户不知道自己在创建哪种模式的提示词

## 修复方案

### 1. API 返回 mode 字段（核心修复）

在 `app/api/admin/prompts/route.ts` 的 select 中添加 `mode` 字段：

```typescript
select: {
  id: true,
  productType: true,
  taskType: true,
  mode: true,  // 添加 mode 字段
  description: true,
  promptTemplate: true,
  isActive: true,
  userId: true,
  // ...
}
```

**效果**：API 返回的数据中包含 mode 字段，前端可以正确识别提示词的模式。

### 2. 更新前端类型定义

在 `components/admin/prompts-admin-client.tsx` 的 `Prompt` 接口中添加 `mode` 字段：

```typescript
interface Prompt {
  id: string
  productType: string
  taskType: string
  mode: string  // 添加 mode 字段
  description: string | null
  // ...
}
```

### 3. 修复过滤逻辑

将过滤逻辑从 `(p as any).mode` 改为 `p.mode`：

```typescript
// 修复前
let prompts = currentPlatform.prompts.filter(
  (p) => p.taskType === taskType && ((p as any).mode || "CREATIVE") === promptMode
)

// 修复后
let prompts = currentPlatform.prompts.filter(
  (p) => p.taskType === taskType && (p.mode || "CREATIVE") === promptMode
)
```

### 4. 重置创建状态

在 useEffect 依赖中添加 `promptMode`，确保切换标签时重置创建状态：

```typescript
// 修复前
useEffect(() => {
  setSelectedPromptId(null)
  setIsCreating(false)
}, [taskType, activePlatformId])

// 修复后
useEffect(() => {
  setSelectedPromptId(null)
  setIsCreating(false)
}, [taskType, activePlatformId, promptMode])  // 添加 promptMode
```

**效果**：用户切换标签时，创建状态会被重置，必须重新点击"创建 Prompt"按钮，此时 `editMode` 会被正确设置为当前标签的模式。

### 5. 显示创建模式（用户体验改进）

在创建表单顶部添加模式显示：

```tsx
{isCreating && (
  <div className="p-3 rounded-lg bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-white/10">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-slate-400">创建模式:</span>
      <span className={cn(
        "px-3 py-1 rounded-full text-xs font-semibold",
        editMode === "CREATIVE" 
          ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
          : "bg-gradient-to-r from-amber-600 to-orange-600 text-white"
      )}>
        {editMode === "CREATIVE" ? "✨ 创意模式" : "⚡ 克隆模式"}
      </span>
      <span className="text-xs text-slate-500 ml-auto">
        (由当前选中的标签决定)
      </span>
    </div>
  </div>
)}
```

**效果**：用户可以清楚地看到当前正在创建哪种模式的提示词。

## 修复后的行为

### 场景 1：正常创建流程
1. 用户选择"创意模式"标签
2. 点击"创建 Prompt"按钮
3. 表单显示"创建模式: ✨ 创意模式"
4. 填写内容并创建
5. ✅ 新提示词出现在"创意模式"列表中

### 场景 2：切换标签
1. 用户选择"创意模式"标签
2. 点击"创建 Prompt"按钮
3. 用户切换到"克隆模式"标签
4. ✅ 创建状态被重置，表单关闭
5. 用户重新点击"创建 Prompt"按钮
6. 表单显示"创建模式: ⚡ 克隆模式"
7. 填写内容并创建
8. ✅ 新提示词出现在"克隆模式"列表中

## 测试步骤

1. 进入管理后台提示词管理页面
2. 选择"克隆模式"标签
3. 点击"创建 Prompt"按钮
4. 验证表单显示"创建模式: ⚡ 克隆模式"
5. 填写产品类型（如 TEST_CLONE）和提示词内容
6. 点击"创建"按钮
7. 验证新提示词出现在"克隆模式"列表中
8. 切换到"创意模式"标签
9. 验证新提示词不在"创意模式"列表中

## 相关文件

- 修复文件：
  - `app/api/admin/prompts/route.ts` - 添加 mode 字段到 API 返回
  - `components/admin/prompts-admin-client.tsx` - 更新类型定义、过滤逻辑和 UI
- 测试指南：`scripts/TEST-MODE-SEPARATION.md`
- 完整日志：`CHANGELOG-MODE-SEPARATION.md`

## 注意事项

- 此修复不影响现有的提示词数据
- 不需要运行数据库迁移脚本
- 修复后立即生效，无需重启服务器（热更新）
