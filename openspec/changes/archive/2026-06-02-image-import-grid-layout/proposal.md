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
