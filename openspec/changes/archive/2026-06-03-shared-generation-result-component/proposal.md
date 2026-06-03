## Why

ProductProcessing 的 5 个 tab 各自内联了右侧结果展示逻辑，布局风格不统一，代码重复。贴纸复刻页面的 "生成结果" 布局（header + grid/单图 + 空状态）已被验证为最佳实践，应抽离为公共组件供所有 tab 复用。

## What Changes

- 新增 `GenerationResult` 公共组件，支持 `single` / `multi` 两种模式和 `empty` / `completed` 两种状态
- 重构 ProductProcessing 中 4 个 tab（去除产品、替换产品、主图裂变、创作新场景）的右侧内容，统一使用 GenerationResult 组件
- 替换 Logo tab 保持现有棋盘格画布布局不变

## Capabilities

### New Capabilities
- `generation-result-component`: 可复用的生成结果展示组件，支持单图/多图 grid 布局、空状态、header 定制和下载回调

### Modified Capabilities

## Impact

- 新增文件: `src/components/GenerationResult.tsx`
- 修改文件: `src/components/ProductProcessing.tsx`（重构 4 个 tab 的右侧内容）
- 受影响类型: `src/types.ts`（新增 `ResultItem` 接口）
- 无新增依赖
