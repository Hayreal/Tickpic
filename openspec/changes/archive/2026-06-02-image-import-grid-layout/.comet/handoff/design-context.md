# Comet Design Handoff

- Change: image-import-grid-layout
- Phase: design
- Mode: compact
- Context hash: d3b66b1959a0c769245f16ccafbc708383afc0312910dc60d3c4d987284e3dcd

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/image-import-grid-layout/proposal.md

- Source: openspec/changes/image-import-grid-layout/proposal.md
- Lines: 1-22
- SHA256: f8363ea6b1d61c188c05e79384095c3ccb2e4583147b3e81979d414660956747

```md
## Why

当前项目导入多张图片（最多 4 张）时，所有图片缩略图集中展示在同一个上传框内部的 `grid-cols-2` 网格中。由于上传框高度有限（h-24 ~ h-36），多张图片挤在一起，缩略图很小，辨识度低，用户体验不佳。

## What Changes

- 将多张图片导入后的展示方式从"单框内嵌网格"改为"多个独立图片框 2x2 网格布局"。
- 每张图片占据一个独立的卡片式容器，保留图片预览、文件名信息和单张删除能力。
- 当只导入 1 张图片时，单个图片框占满整行；2 张时并排一行；3-4 张时 2x2 网格。
- 上传框在有图片时隐藏，图片网格替代其位置；清除所有图片后恢复上传框。
- 保持现有的拖拽、点击、粘贴三种导入方式不变。

## Capabilities

### Modified Capabilities
- `image-import-display`: 修改图片导入后的视觉展示布局，从单框内嵌改为独立卡片网格。

## Impact

- 受影响代码：`src/components/StickerGen.tsx`（3 个上传框）、`src/components/ProductProcessing.tsx`（7 个上传框）。
- 不涉及新依赖、新 API 或数据结构变更。
- `ImportBatch` 类型和 `importBatch.ts` 工具函数无需修改。
```

## openspec/changes/image-import-grid-layout/design.md

- Source: openspec/changes/image-import-grid-layout/design.md
- Lines: 1-37
- SHA256: 75488df52747d87c0896c25e0f0a12246af630c3c3e3c546b613208aa71deb46

```md
## Context

Tickpic 是一个 Electron + React 19 桌面应用，用于 AI 创意图生成。左侧参数面板包含多个上传框，用户可导入最多 4 张参考图片。当前所有上传框使用相同的展示模式：图片导入后以 `absolute inset-0` 覆盖层方式嵌入上传框内部，使用 `grid-cols-2` 显示缩略图。

此模式在 10 个上传框中完全一致地重复出现：
- `StickerGen.tsx`：copy（h-36）、variation（h-32）、original（h-28）
- `ProductProcessing.tsx`：remove（h-32）、replaceScene（h-28）、replaceProduct（h-28）、logoSource（h-24）、logoTarget（h-24）、themeRef（h-32）、sceneRef（h-28）

## Goals / Non-Goals

**Goals:**
- 将导入的多张图片分开展示为 2x2 网格布局，每张图片有独立的卡片容器。
- 提升图片辨识度和可操作性。
- 保持现有的三种导入方式（点击、拖拽、粘贴）不变。
- 保持现有的清除/重置功能不变。

**Non-Goals:**
- 不修改 `ImportBatch` 数据结构或 `importBatch.ts` 工具函数。
- 不修改图片导入上限（仍为 4 张）。
- 不新增拖拽排序、单张替换等额外交互功能。
- 不修改右侧预览区域的生成结果展示。

## Decisions

- 使用 Tailwind CSS `grid grid-cols-2 gap-2` 实现 2x2 网格布局，替代原有单框内嵌网格。
  - 原因：与现有技术栈一致，无需引入新依赖。
- 每个图片卡片包含：图片预览（`object-contain`）、文件名标签、单张删除按钮。
  - 原因：分开展示后每张图片需要独立的操作入口。
- 网格容器替代原上传框位置，不使用 `absolute` 覆盖，而是条件渲染切换。
  - 原因：避免覆盖层导致的布局问题，代码更清晰。
- 图片数量不满 4 张时，最后行的卡片不强制填满，自然左对齐。
  - 原因：避免空白卡片造成"缺失"的视觉错觉。

## Risks / Trade-offs

- [左侧参数面板宽度有限（340-380px）] → 2 列网格中每列约 150px，图片缩略图偏小；通过使用 `object-contain` 保证完整可见缓解。
- [10 个上传框需逐一修改] → 存在重复代码；通过保持一致的 HTML 结构和 class 降低维护成本。
```

## openspec/changes/image-import-grid-layout/tasks.md

- Source: openspec/changes/image-import-grid-layout/tasks.md
- Lines: 1-18
- SHA256: 9087e65c77881119de291d3d847e7140f1c0e5c5e427b3770497a5a608552c59

```md
## 1. StickerGen 上传框改造

- [ ] 1.1 修改 StickerGen copy 上传框：图片导入后展示为 2x2 独立卡片网格，含单张删除按钮。
- [ ] 1.2 修改 StickerGen variation 上传框：同上。
- [ ] 1.3 修改 StickerGen original 上传框：同上。

## 2. ProductProcessing 上传框改造

- [ ] 2.1 修改 ProductProcessing remove 上传框：图片导入后展示为 2x2 独立卡片网格。
- [ ] 2.2 修改 ProductProcessing replaceScene 和 replaceProduct 上传框：同上。
- [ ] 2.3 修改 ProductProcessing logoSource 和 logoTarget 上传框：同上。
- [ ] 2.4 修改 ProductProcessing themeRef 上传框：同上。
- [ ] 2.5 修改 ProductProcessing sceneRef 上传框：同上。

## 3. 验证

- [ ] 3.1 运行 TypeScript 类型检查和构建验证。
- [ ] 3.2 视觉验证：导入 1/2/3/4 张图片时布局正确，清除功能正常。
```

