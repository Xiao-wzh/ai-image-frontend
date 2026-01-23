# 模式分离功能测试指南

## 测试前准备

### 1. 更新数据库
选择以下方式之一：

**方式 A：重新初始化（开发环境推荐）**
```bash
node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/init-prompts.ts dotenv_config_path=.env.local
```

**方式 B：修复现有数据（生产环境推荐）**
```bash
node -r dotenv/config node_modules/tsx/dist/cli.mjs scripts/fix-prompt-modes.ts dotenv_config_path=.env.local
```

### 2. 重启开发服务器
```bash
npm run dev
```

## 测试步骤

### 测试 1：创意模式产品类型
1. 打开应用首页
2. 确认默认选中 "✨ 创意模式"
3. 点击 "平台 / 风格" 下拉框
4. **预期结果**：
   - ✅ 可以看到：男装、寝具、Sexyspecies 等
   - ❌ 不应该看到：CLONE_GENERAL 或任何包含 "克隆" 的选项

### 测试 2：克隆模式产品类型
1. 点击切换到 "⚡ 克隆模式"
2. 观察 "平台 / 风格" 下拉框是否自动重置
3. 点击 "平台 / 风格" 下拉框
4. **预期结果**：
   - ✅ 可以看到：克隆模式通用 (CLONE_GENERAL)
   - ❌ 不应该看到：男装、寝具、Sexyspecies 等创意模式的选项

### 测试 3：模式切换
1. 在克隆模式下选择一个产品类型
2. 切换回创意模式
3. **预期结果**：
   - ✅ 产品类型选择应该被重置为空
   - ✅ 下拉框显示 "请选择"
   - ✅ 重新打开下拉框，只显示创意模式的选项

### 测试 4：详情页模式
1. 切换任务类型到 "详情页"
2. 在创意模式下查看产品类型
3. 切换到克隆模式查看产品类型
4. **预期结果**：
   - ✅ 创意模式：显示详情页的创意类型
   - ✅ 克隆模式：显示详情页的克隆类型
   - ✅ 两种模式的选项不重复

### 测试 5：实际生成
1. **创意模式测试**：
   - 选择创意模式
   - 选择 "男装" 产品类型
   - 上传商品图片
   - 点击生成
   - **预期**：成功生成，使用创意模式的提示词

2. **克隆模式测试**：
   - 选择克隆模式
   - 选择 "克隆模式通用" 产品类型
   - 上传商品图片和参考图片
   - 填写卖点
   - 点击生成
   - **预期**：成功生成，使用克隆模式的提示词

### 测试 6：管理后台提示词创建

1. 进入管理后台的提示词管理页面
2. 选择 "✨ 创意模式" 标签
3. 点击 "创建 Prompt" 按钮
4. **预期结果**：
   - ✅ 表单顶部显示 "创建模式: ✨ 创意模式"
   - ✅ 提示文字显示 "(由当前选中的标签决定)"

5. 填写产品类型（如 TEST_CREATIVE）和提示词内容
6. 点击 "创建" 按钮
7. **预期结果**：
   - ✅ 创建成功
   - ✅ 新提示词出现在 "创意模式" 标签的列表中
   - ❌ 新提示词不应该出现在 "克隆模式" 标签的列表中

8. 切换到 "⚡ 克隆模式" 标签
9. 点击 "创建 Prompt" 按钮
10. **预期结果**：
    - ✅ 表单顶部显示 "创建模式: ⚡ 克隆模式"
    - ✅ 之前填写的内容已被清空（因为切换标签会重置创建状态）

11. 填写产品类型（如 TEST_CLONE）和提示词内容
12. 点击 "创建" 按钮
13. **预期结果**：
    - ✅ 创建成功
    - ✅ 新提示词出现在 "克隆模式" 标签的列表中
    - ❌ 新提示词不应该出现在 "创意模式" 标签的列表中

### 测试 7：API 直接测试
使用浏览器或 curl 测试 API：

**创意模式**：
```bash
curl "http://localhost:3000/api/config/platforms?taskType=MAIN_IMAGE&mode=CREATIVE"
```

**克隆模式**：
```bash
curl "http://localhost:3000/api/config/platforms?taskType=MAIN_IMAGE&mode=CLONE"
```

**预期结果**：
- 创意模式返回的 types 数组不包含 CLONE_GENERAL
- 克隆模式返回的 types 数组只包含 CLONE_GENERAL

## 验证数据库

### 检查提示词统计
```sql
-- 查看创意模式提示词数量
SELECT COUNT(*) FROM "ProductTypePrompt" WHERE mode = 'CREATIVE';

-- 查看克隆模式提示词数量
SELECT COUNT(*) FROM "ProductTypePrompt" WHERE mode = 'CLONE';

-- 查看所有提示词的 mode 分布
SELECT mode, COUNT(*) FROM "ProductTypePrompt" GROUP BY mode;
```

**预期结果**：
```
CREATIVE: 8 条（主图 4 条 + 详情页 4 条）
CLONE: 4 条（主图 2 条 + 详情页 2 条）
```

### 检查具体提示词
```sql
-- 查看创意模式的产品类型
SELECT DISTINCT "productType", "taskType", mode 
FROM "ProductTypePrompt" 
WHERE mode = 'CREATIVE' AND "userId" IS NULL
ORDER BY "taskType", "productType";

-- 查看克隆模式的产品类型
SELECT DISTINCT "productType", "taskType", mode 
FROM "ProductTypePrompt" 
WHERE mode = 'CLONE' AND "userId" IS NULL
ORDER BY "taskType", "productType";
```

## 常见问题

### Q1: 切换模式后还是看到旧的产品类型？
**A**: 清除浏览器缓存或硬刷新（Ctrl+Shift+R / Cmd+Shift+R）

### Q2: API 返回空数组？
**A**: 检查数据库是否已运行初始化或修复脚本

### Q3: 生成时提示 "未找到 Prompt 模板"？
**A**: 确认数据库中的提示词 mode 字段已正确设置

### Q4: 管理后台看不到提示词？
**A**: 管理后台的提示词管理功能不受影响，应该能看到所有提示词

## 回滚方案

如果测试发现问题，可以临时回滚：

1. 恢复 `app/api/config/platforms/route.ts`：
   - 移除 `mode` 参数的过滤逻辑

2. 恢复 `components/upload-zone.tsx`：
   - 移除 URL 中的 `&mode=${generationMode}`
   - 移除 useEffect 依赖中的 `generationMode`

3. 重启服务器

## 测试完成检查清单

- [ ] 创意模式只显示创意类型
- [ ] 克隆模式只显示克隆类型
- [ ] 切换模式时产品类型自动重置
- [ ] 创意模式可以正常生成
- [ ] 克隆模式可以正常生成
- [ ] API 返回正确的数据
- [ ] 数据库统计正确
- [ ] 管理后台功能正常

## 报告问题

如果发现问题，请记录：
1. 操作步骤
2. 预期结果
3. 实际结果
4. 浏览器控制台错误（如有）
5. 服务器日志错误（如有）
