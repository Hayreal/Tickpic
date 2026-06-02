---
comet_change: image-import-grid-layout
role: technical-design
canonical_spec: openspec
archived-with: 2026-06-02-image-import-grid-layout
status: final
---

# 多图导入 2x2 网格布局 Design Doc

## Context

Tickpic 左侧参数面板有 10 个上传框，支持最多 4 张图片导入。当前所有上传框使用相同的展示模式：图片导入后以 `absolute inset-0` 覆盖层嵌入上传框内部，用 `grid-cols-2` 显示缩略图。由于框体高度有限（h-24 ~ h-36），多张图片挤在一起，辨识度低。

## Technical Design

### 布局结构变更

**Before**：单个上传框内嵌 `absolute` 覆盖层 + `grid-cols-2` 缩略图。

**After**：条件渲染切换 — 有图片时显示独立卡片网格，无图片时显示上传框。

```
无图片状态:                    有图片状态（4张）:
┌──────────────────┐          ┌────────┐ ┌────────┐
│   ⬆ 上传图片     │    →     │ img-1  │ │ img-2  │
│  点击/拖拽/粘贴   │          │ file1  │ │ file2  │
└──────────────────┘          ├────────┤ ├────────┤
                              │ img-3  │ │ img-4  │
                              │ file3  │ │ file4  │
                              └────────┘ └────────┘
                              已导入 4 张  [清除全部]
```

### 布局规则

| 图片数量 | 网格列数 | 行为 |
|---------|---------|------|
| 1 | 1 列 | 单卡片占满整行 |
| 2 | 2 列 | 一行两列 |
| 3 | 2 列 | 第一行 2 列 + 第二行 1 列（左对齐） |
| 4 | 2 列 | 2x2 完整网格 |

使用 Tailwind `grid grid-cols-2 gap-2`，最后行不满时不强制填满。

### 单个图片卡片结构

每个卡片包含：
- **图片预览区**：`aspect-square`，`object-contain` 居中，背景 `bg-slate-950`
- **单张删除按钮**：右上角 `X` 图标，`bg-slate-900/80 hover:bg-red-900/80`
- **文件名标签**：底部，`text-[10px] text-slate-500`，`truncate` 截断

### 单张删除行为

- 点击单张删除按钮 → 从 `batch.images` 中移除该图片
- 若移除后 `images.length === 0` → `setXxxBatch(null)` 恢复上传框
- 若移除后仍有图片 → 更新 batch，网格自动重排

### 数据层

无需修改 `ImportBatch` 类型或 `importBatch.ts`。单张删除通过过滤 `images` 数组实现：

```typescript
const removeImage = (batchType: string, imageId: string) => {
  const batch = getBatch(batchType);
  if (!batch) return;
  const remaining = batch.images.filter(img => img.id !== imageId);
  if (remaining.length === 0) {
    setBatch(batchType, null);
  } else {
    setBatch(batchType, { ...batch, images: remaining });
  }
};
```

### 受影响文件清单

| 文件 | 上传框数量 | 框 ID 列表 |
|------|-----------|-----------|
| `src/components/StickerGen.tsx` | 3 | copy, variation, original |
| `src/components/ProductProcessing.tsx` | 7 | remove, replaceScene, replaceProduct, logoSource, logoTarget, themeRef, sceneRef |

每个上传框的修改模式完全一致：
1. 将 `{batch ? (覆盖层) : (上传占位)}` 改为 `{batch ? (网格卡片 + 底部操作栏) : (上传占位)}`
2. 为每个框添加 `removeImage` 处理函数（或统一一个通用函数）

### 不变的部分

- `ImportBatch` 和 `StoredImageRecord` 类型定义
- `importBatch.ts` 的 `collectImportFiles` 函数
- 拖拽、点击、粘贴三种导入方式
- 右侧预览区域的生成结果展示
- 图片导入上限（4 张）
