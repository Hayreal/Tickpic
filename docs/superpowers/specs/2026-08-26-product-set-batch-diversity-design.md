# 套图批次区分度强化与手持标签朝向修复

**日期：** 2026-08-26

## 背景

套图主图从「每张独立任务 + `variant` 差异方向」改为「单次 `count` 批量输出」后，`batch_output` 仅保留 `require_distinct: true`，丢失了按序号分配的具体构图/机位/光线差异指令，导致同批主图高度相似。

手持模式（尤其带参考图）缺少「logo/主标签相对瓶嘴端」的硬约束，瓶身倒置时标签被单独翻转，logo 出现在尾端而非瓶嘴侧。

## 目标

- 主图、对比图、多场景图在 `count > 1` 时，`batch_output` 为每张输出分配互不重复的具体差异方向。
- 主图手持模式下，logo/品牌/主标签相对瓶嘴/喷口/盖端的位置与 SKU 原图一致，禁止单独翻转标签。
- 不改变 UI、请求结构、任务拆分或 API 调用次数。

## 方案

在 `productSetJsonPrompt.ts` 的 `batch_output` 中增加 `diversity` 对象：

- `min_changed_dimensions: 3`
- `dimensions`: 按 feature 列出可观察差异维度
- `slots[]`: 为第 1…N 张各写一条具体方向（循环 3 个基础方向，第 4 张起要求换未用过的具体子场景）
- `forbidden` 补充：只换色、只改标题、只微移产品、同构图复刻

手持修复：在 `sku_lock`、`HANDHELD_RULES`、`handheld_reference`、quality/negative 中明确标签朝向相对瓶嘴端锁定。

## 测试

- `productSetJsonPrompt.test.ts`: 断言 `batch_output.diversity.slots` 长度与 count 一致且方向互异；手持模式含标签朝向规则。
- `instructionPrompt.test.ts`: `batch_output` 含 `diversity` 字段。

## 验收

- 默认 3 张主图、3 张对比图、2 张多场景图各自携带 N 条互不重复的差异方向。
- 手持主图提示词明确要求 logo 在瓶嘴端，禁止标签独立翻转。
