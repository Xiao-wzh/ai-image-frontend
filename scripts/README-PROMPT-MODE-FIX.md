# 提示词模式修复说明

## 问题描述

之前的代码中存在两个问题：

1. **后端问题**：创意模式（CREATIVE）的提示词定义没有显式设置 `mode: "CREATIVE"` 字段，而是依赖数据库的默认值。这可能导致：
   - 代码不够清晰，容易混淆
   - 如果数据库中有旧数据，可能 mode 字段不正确
   - 克隆模式和创意模式的提示词可能会混用

2. **前端问题**：用户在选择产品类型时，无论选择哪种模式，都会看到所有的产品类型选项，包括：
   - 创意模式下可以看到克隆模式的产品类型（如 CLONE_GENERAL）
   - 克隆模式下可以看到创意模式的产品类型（如男装、寝具等）

## 修复内容

### 1. 更新初始化脚本 (`scripts/init-prompts.ts`)

为所有创意模式的提示词显式添加 `mode: "CREATIVE"` 字段：

- ✅ Shopee 男装 - 主图
- ✅ Shopee 寝具 - 主图  
- ✅ Shopee Sexyspecies - 主图
- ✅ General 男装 - 主图（兜底）
- ✅ Shopee 男装 - 详情页
- ✅ Shopee 寝具 - 详情页
- ✅ Shopee Sexyspecies - 详情页
- ✅ General 男装 - 详情页（兜底）

克隆模式的提示词已经有 `mode: "CLONE"` 字段，无需修改。

### 2. 创建数据库修复脚本 (`scripts/fix-prompt-modes.ts`)

用于修复数据库中已有的提示词记录，确保：
- 所有 `productType = "CLONE_GENERAL"` 的提示词 → `mode = "CLONE"`
- 其他所有提示词 → `mode = "CREATIVE"`

### 3. 修改平台配置 API (`app/api/config/platforms/route.ts`)

**新增 `mode` 参数**，根据用户选择的模式过滤返回的产品类型：

```typescript
const mode = searchParams.get("mode") || "CREATIVE"

const platforms = await prisma.platform.findMany({
  // ...
  prompts: {
    where: { 
      isActive: true, 
      userId: null, 
      taskType,
      mode, // 根据模式过滤
    },
    // ...
  },
})
```

### 4. 修改前端上传组件 (`components/upload-zone.tsx`)

**a) 在加载平台配置时传递 mode 参数：**

```typescript
const res = await fetch(`/api/config/platforms?taskType=${taskType}&mode=${generationMode}`)
```

**b) 在 useEffect 依赖中添加 generationMode：**

```typescript
}, [taskType, generationMode])
```

这样当用户切换模式时，会自动重新加载对应模式的产品类型。

**c) 切换模式时重置产品类型选择：**

```typescript
setGenerationMode(v as "CREATIVE" | "CLONE")
setProductType("") // 重置产品类型
```

## 使用方法

### 重新初始化提示词（推荐）

如果你的数据库可以重置，直接运行初始化脚本：

```bash
node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/init-prompts.ts dotenv_config_path=.env.local
```

这会清空系统默认提示词并重新创建，所有 mode 字段都会正确设置。

### 修复现有数据（保留用户自定义提示词）

如果你的数据库中有用户自定义的提示词，不想清空，可以运行修复脚本：

```bash
node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/fix-prompt-modes.ts dotenv_config_path=.env.local
```

这会更新所有提示词的 mode 字段，但不会删除任何数据。

## 验证

运行修复后，你应该看到类似的输出：

```
📈 当前统计：
   - 创意模式提示词: 8 条
   - 克隆模式提示词: 4 条
```

## 用户体验改进

修复后的用户体验：

1. **创意模式**：用户只能看到创意模式的产品类型（男装、寝具、Sexyspecies 等）
2. **克隆模式**：用户只能看到克隆模式的产品类型（CLONE_GENERAL）
3. **切换模式**：切换模式时，产品类型选择会自动重置并重新加载对应模式的选项

## 代码逻辑确认

在 `app/api/generate/route.ts` 中，提示词选择逻辑已经正确实现：

- **克隆模式**（第 687-726 行）：只查找 `mode: "CLONE"` 的提示词
- **创意模式**（第 735-750 行）：只查找 `mode: "CREATIVE"` 的提示词

这确保了两种模式不会混用提示词。
