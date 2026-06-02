---
change: image-import-grid-layout
design-doc: docs/superpowers/specs/2026-06-02-image-import-grid-layout-design.md
base-ref: N/A (no git repo)
archived-with: 2026-06-02-image-import-grid-layout
---

# 实施计划：多图导入 2x2 网格布局

## 概述

将 10 个上传框的图片展示方式从"单框内嵌网格"改为"独立卡片网格"。每个上传框的修改模式完全一致。

## 通用修改模式

每个上传框的变更遵循相同模式：

**Before**（当 `batch` 存在时）:
```tsx
{batch ? (
  <div className="absolute inset-0 flex flex-col bg-slate-950">
    <div className="flex-1 grid grid-cols-2 gap-1 p-2 overflow-hidden">
      {batch.images.map((img) => (
        <div key={img.id} className="aspect-square ...">
          <img src={img.filePath} ... />
        </div>
      ))}
    </div>
    <div className="absolute top-1.5 right-1.5 ...">X</div>
    <div className="text-center pb-1.5">
      <span>N 张图片已导入</span>
    </div>
  </div>
) : ( /* 上传占位 */ )}
```

**After**（当 `batch` 存在时）:
```tsx
{batch ? (
  <div className="flex flex-col gap-2">
    <div className="grid grid-cols-2 gap-2">
      {batch.images.map((img) => (
        <div key={img.id} className="relative group aspect-square bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
          <img src={img.filePath} className="w-full h-full object-contain" alt={img.fileName} />
          <button className="absolute top-1 right-1 ..." onClick={() => removeImage(type, img.id)}>
            <X className="w-3 h-3" />
          </button>
          <div className="absolute bottom-0 ...">
            <span className="truncate">{img.fileName}</span>
          </div>
        </div>
      ))}
    </div>
    <div className="flex items-center justify-between">
      <span>N 张图片已导入</span>
      <button onClick={() => setBatch(null)}>清除全部</button>
    </div>
  </div>
) : ( /* 上传占位 */ )}
```

## 任务清单

### Task 1: StickerGen copy 上传框
- 文件: `src/components/StickerGen.tsx`
- 范围: lines 296-323（copyBatch 展示区域）
- 变更: 替换覆盖层为独立卡片网格

### Task 2: StickerGen variation 上传框
- 文件: `src/components/StickerGen.tsx`
- 范围: lines 410-437（variationBatch 展示区域）
- 变更: 同上

### Task 3: StickerGen original 上传框
- 文件: `src/components/StickerGen.tsx`
- 范围: lines 528-553（originalBatch 展示区域）
- 变更: 同上

### Task 4: ProductProcessing remove 上传框
- 文件: `src/components/ProductProcessing.tsx`
- 范围: lines 359-384（removeBatch 展示区域）
- 变更: 同上

### Task 5: ProductProcessing replaceScene + replaceProduct 上传框
- 文件: `src/components/ProductProcessing.tsx`
- 范围: lines 435-452, 466-483
- 变更: 同上（两个框并排在 grid-cols-2 中）

### Task 6: ProductProcessing logoSource + logoTarget 上传框
- 文件: `src/components/ProductProcessing.tsx`
- 范围: lines 536-551, 565-579
- 变更: 同上

### Task 7: ProductProcessing themeRef 上传框
- 文件: `src/components/ProductProcessing.tsx`
- 范围: lines 631-656
- 变更: 同上

### Task 8: ProductProcessing sceneRef 上传框
- 文件: `src/components/ProductProcessing.tsx`
- 范围: lines 719-742
- 变更: 同上

### Task 9: 添加 removeImage 通用函数
- 在两个组件中各添加一个 `removeImage` 函数
- 支持从 batch 中移除单张图片，batch 为空时自动清除

### Task 10: 验证
- 运行 TypeScript 类型检查 (`pnpm exec tsc --noEmit`)
- 运行构建 (`pnpm build`)
