# 模式分离功能更新日志

## 更新时间
2025-01-22

## 更新内容

### 问题 1：模式分离
用户反馈：在选择产品类型时，创意模式和克隆模式的提示词混在一起，用户体验不佳。

### 问题 2：管理后台模式识别
管理后台在克隆模式标签下创建的提示词会出现在创意模式列表中。

### 问题 3：克隆模式图片顺序
克隆模式下，参考图和商品图需要都放在 `images` 字段中传给 n8n，并且参考图必须在数组前面。

### 问题 4：重试模式不一致
点击"优惠重试"时，重试使用的提示词与上一次不一样，因为重试时没有从原始记录获取 `mode`、`features`、`refImages` 字段。

### 解决方案
1. 实现了完整的模式分离机制
2. 修复了管理后台的模式识别问题
3. 调整了克隆模式的图片传递顺序
4. 修复了重试时的模式一致性问题

## 修改的文件

### 1. 后端修改

#### `scripts/init-prompts.ts`
- 为所有创意模式提示词显式添加 `mode: "CREATIVE"` 字段
- 确保数据一致性和代码可读性

#### `scripts/fix-prompt-modes.ts` (新增)
- 创建数据库修复脚本
- 用于修复现有数据库中的提示词 mode 字段

#### `app/api/config/platforms/route.ts`
- 新增 `mode` 查询参数支持
- 根据 mode 过滤返回的产品类型
- 默认值为 "CREATIVE"

### 2. 前端修改

#### `components/upload-zone.tsx`
- 在加载平台配置时传递 `mode` 参数
- 在 useEffect 依赖中添加 `generationMode`
- 切换模式时自动重置产品类型选择
- 切换模式时自动重新加载对应的产品类型列表

#### `components/admin/prompts-admin-client.tsx` (新增修复)
- 在 `Prompt` 接口中添加 `mode: string` 字段定义
- 修复过滤逻辑：从 `(p as any).mode` 改为 `p.mode`
- 在 useEffect 依赖中添加 `promptMode`，切换模式时重置创建状态
- 在创建表单中显示当前的创建模式（创意/克隆）
- 确保用户在正确的标签下创建提示词

#### `scripts/fix-generation-modes.ts` (新增)
- 创建生成记录修复脚本
- 用于修复旧的生成记录中缺失或错误的 mode 字段
- 根据 productType 推断正确的 mode 值

#### `app/api/admin/prompts/route.ts` (新增修复)
- 在 select 中添加 `mode: true`，确保 API 返回 mode 字段
- 前端可以正确识别和过滤不同模式的提示词

#### `app/api/generate/route.ts` (克隆模式图片顺序修复 + 重试模式一致性修复)
- 修改 n8n payload 构建逻辑
- 克隆模式下：`images` 字段包含参考图和商品图，参考图在前
- 创意模式下：`images` 字段只包含商品图
- 保留 `ref_image_count` 字段，方便 n8n 识别参考图数量
- 重试时从原始记录获取 `mode`、`features`、`refImages` 字段
- 确保重试使用与原始生成相同的模式和参数

## 技术实现

### API 层
```typescript
// 接受 mode 参数
const mode = searchParams.get("mode") || "CREATIVE"

// 在查询时过滤
prompts: {
  where: { 
    isActive: true, 
    userId: null, 
    taskType,
    mode, // 根据模式过滤
  },
}
```

### 前端层
```typescript
// 传递 mode 参数
const res = await fetch(`/api/config/platforms?taskType=${taskType}&mode=${generationMode}`)

// 监听模式变化
useEffect(() => {
  // 重新加载平台配置
}, [taskType, generationMode])

// 切换模式时重置
setGenerationMode(v as "CREATIVE" | "CLONE")
setProductType("") // 重置产品类型
```

## 用户体验改进

### 之前的问题
1. **前端上传页面**：
   - 创意模式下可以看到 "CLONE_GENERAL" 等克隆模式的产品类型
   - 克隆模式下可以看到 "男装"、"寝具" 等创意模式的产品类型
   - 容易混淆，选错类型会导致生成失败

2. **管理后台**：
   - 在克隆模式标签下创建的提示词会出现在创意模式列表中
   - 用户不知道当前创建的是哪种模式的提示词
   - 切换标签时创建状态不会重置，导致 mode 字段错误

### 现在的改进
1. **前端上传页面**：
   - ✅ 创意模式：只显示男装、寝具、Sexyspecies 等创意类型
   - ✅ 克隆模式：只显示 CLONE_GENERAL 等克隆类型
   - ✅ 切换模式时自动重置并重新加载产品类型
   - ✅ 界面更清晰，不会选错

2. **管理后台**：
   - ✅ 切换模式标签时自动重置创建状态
   - ✅ 创建表单显示当前的创建模式（创意/克隆）
   - ✅ 创建的提示词会出现在正确的标签列表中
   - ✅ 用户清楚知道自己在创建哪种模式的提示词

## 数据库迁移

### 方式一：重新初始化（推荐用于开发环境）
```bash
node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/init-prompts.ts dotenv_config_path=.env.local
```

### 方式二：修复现有数据（推荐用于生产环境）
```bash
node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/fix-prompt-modes.ts dotenv_config_path=.env.local
```

## 兼容性

- ✅ 向后兼容：API 的 mode 参数有默认值 "CREATIVE"
- ✅ 不影响现有功能：其他调用 platforms API 的地方无需修改
- ✅ 数据安全：修复脚本不会删除任何数据

## 测试建议

1. **前端上传页面**：
   - 切换到创意模式，检查产品类型列表
   - 切换到克隆模式，检查产品类型列表
   - 在两种模式下分别生成图片，验证功能正常

2. **管理后台**：
   - 在创意模式标签下创建提示词，验证它出现在创意模式列表
   - 在克隆模式标签下创建提示词，验证它出现在克隆模式列表
   - 检查提示词管理功能

3. **克隆模式图片顺序**：
   - 上传参考图和商品图
   - 查看服务器日志中的 n8n payload
   - 验证 `images` 数组中参考图在前、商品图在后
   - 验证 `ref_image_count` 字段正确

4. **重试模式一致性**：
   - 生成一张图片（创意或克隆模式）
   - 点击"优惠重试"
   - 查看服务器日志，确认 mode 与原始生成一致
   - 验证重试使用的提示词与原始一致

详细测试步骤：
- 前端测试：`scripts/TEST-MODE-SEPARATION.md`
- 图片顺序测试：`TEST-CLONE-MODE-IMAGES.md`
- 重试测试：`FIX-RETRY-MODE-CONSISTENCY.md`

## 相关文档

- 详细说明：`scripts/README-PROMPT-MODE-FIX.md`
- 修复脚本：
  - `scripts/fix-prompt-modes.ts` - 修复提示词 mode 字段
  - `scripts/fix-generation-modes.ts` - 修复生成记录 mode 字段
- 初始化脚本：`scripts/init-prompts.ts`
- 管理后台修复：`FIX-ADMIN-PROMPT-MODE.md`
- 克隆模式图片顺序：`FIX-CLONE-MODE-IMAGES.md`
- 重试模式一致性：`FIX-RETRY-MODE-CONSISTENCY.md`
- 测试指南：
  - `scripts/TEST-MODE-SEPARATION.md`
  - `TEST-CLONE-MODE-IMAGES.md`
  - `scripts/verify-mode-field.md`
