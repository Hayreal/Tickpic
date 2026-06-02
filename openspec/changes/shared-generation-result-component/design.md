## Context

ProductProcessing 有 5 个子 tab，其中 4 个（去除产品、替换产品、主图裂变、创作新场景）的右侧结果展示区域各自内联了相似但不完全一致的布局代码。贴纸复刻页面的 "生成结果" 区域具有统一的 header + 内容区结构，是被验证过的最佳实践。需要抽离为公共组件以消除重复、统一视觉风格。

当前状态：
- 去除产品/替换产品：单图居中展示 + 空状态
- 主图裂变：2列 grid 多图 + header 带计数
- 创作新场景：2列 grid 多图 + header 带历史记录按钮
- 替换 Logo：棋盘格画布（不在本次范围内）

## Goals / Non-Goals

**Goals:**
- 创建 `GenerationResult` 组件，提供统一的结果展示壳
- 支持 `single` / `multi` 两种结果展示模式
- 支持 `empty` / `completed` 两种状态
- 4 个 tab 统一迁移到该组件

**Non-Goals:**
- 不改动替换 Logo tab 的棋盘格画布
- 不改动左侧参数面板
- 不引入 generating 状态或进度条
- 不引入 footer 状态栏

## Decisions

### 1. 组件模式：单一可配置组件 vs 组合式子组件

选择：**单一可配置组件**

理由：4 个 tab 的右侧布局模式高度一致（header + 内容区），差异仅在于 mode 和少量文案。单一组件通过 props 配置即可覆盖所有场景，维护成本最低。组合式拆分（ResultPanel + ResultCard + EmptyState）在此场景下过度设计。

### 2. 结果展示模式

- `mode: 'single'`：大尺寸居中展示（`max-w-lg aspect-video`），适用于去除产品、替换产品
- `mode: 'multi'`：2列 grid（`grid-cols-2 gap-4, aspect-square`），适用于主图裂变、创作新场景

### 3. 空状态设计

空状态只保留描述文案（`emptyDescription`），不展示图标和标题。保持极简。

### 4. 组件放置位置

`src/components/GenerationResult.tsx`，与现有组件平级。类型定义放在 `src/types.ts`。

## Risks / Trade-offs

- [Risk] 创作新场景 tab 当前有 "历史记录" 按钮 → 通过 `headerRight` prop 注入，不影响组件通用性
- [Trade-off] single 模式的大图展示与 multi 模式的 grid 在组件内部有分支逻辑 → 可接受，两个分支都很简单
