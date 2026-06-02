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
