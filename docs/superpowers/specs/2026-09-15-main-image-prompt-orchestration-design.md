# 主图提示词编排与参考风格设计

## 背景

当前 `product_main_image` 的提示词同时描述场景、套图差异、排版家族、SKU 图层、标题字效和多种禁止项，导致规则重复且优先级不清。生成结果容易出现三行标题、额外信息模块或所有卡片采用同一种构图。

参考样例呈现的是一组有变化但克制的跨境电商主图：真实问题表面/使用场景为主体，部分卡片自然手持产品，部分卡片独立展示或做 Before/After；标题短、醒目、通常一到两行，使用少量描边、阴影或色块，不堆卖点卡和图标墙。

## 目标

- 只调整 `product_main_image`，不改变 `product_comparison_image` 和 `product_multi_scene` 的布局规则。
- 复用现有 `presentation_mode` 等字段，不新增配置字段或独立编辑器模块。
- 允许主图规划器按卡片选择自然手持，但不要求整批都手持；`effect_demo` 仍禁止，避免喷雾/雾气等效果失控。
- 标题与副标题合计最多两行；有副标题时主标题只能一行。
- 使用规划器提供的准确文案，不允许执行层自行追加第三行、口号、信息卡或图标模块。
- 将最终约束集中追加在自然语言执行提示词末尾，作为一次短的合规收口。

## 设计

### 1. 数据流

保持现有链路：

```text
Vision 规划卡片
  -> product_main_image JSON 规格
  -> 合并每张卡的场景/构图/文案
  -> 最终自然语言执行提示词
  -> FINAL EDIT DIRECTIVE
```

Vision 只负责为每张卡选择一个现有构图模式并提供场景、SKU 位置、标题文案和字效。JSON 渲染器负责把这些信息合并成最终执行指令；末尾的 `FINAL EDIT DIRECTIVE` 只检查最终画面，不再重新设计构图。

### 2. 主图构图模式

- `carousel_hero`：真实痛点场景 + 产品主视觉，可独立展示，不手持。
- `handheld_use`：自然手持产品，手和产品比例真实，产品处于准备使用状态，不展示喷雾/雾气/泡沫等产品效果。
- `lifestyle_scene`：真实使用环境和问题表面，可有产品辅助层，但不堆信息模块。
- `before_after`：同一对象/区域的可信前后对比，保留现有对比逻辑。
- `effect_demo`：继续禁止，不作为主图规划选项。

套图内由 Vision 选择不同模式和场景；只要求不要所有卡片都使用同一种模式，不增加固定比例或复杂配额。

### 3. 文案与版式

最终执行提示词统一使用以下硬规则：

- 采用规划器提供的 `Suggested headline` 原文，不改写、不扩写。
- 所有标题、副标题、kicker 合计最多两个水平文字行。
- 使用副标题时，副标题占一行，主标题只能一行。
- 不新增第三行、额外口号、卖点卡、图标行、徽章或信息面板。
- 标题只放上方左侧、上方右侧或顶部横幅，不放画面中央。
- 标题可使用一种主字效和一种强调色，保持商业电商风格，不做复杂海报排版。

### 4. 最终编辑指令

在最终自然语言执行提示词之后追加短指令：

```text
FINAL EDIT DIRECTIVE — obey this last:
Create one clean US ecommerce image in a realistic product-use scene.
Use the exact Suggested headline without rewriting or adding copy.
The entire headline block must contain at most 2 horizontal text rows total.
A subtitle/kicker counts as one row; if used, the main title must be one row.
Never add a third text row, extra slogan, icon row, badge, or information panel.
Keep the selected composition, SKU placement, and hand-use decision unchanged.
```

这段指令只承担最后检查职责，避免重复完整的 SKU 锁定、场景规则和套图规则。

## 非目标

- 不改变产品标签保真、容量格式、图片角色顺序和模型 API 调用。
- 不为每种风格新增 schema、枚举或独立渲染器。
- 不把参考样例中的具体品牌、文案、价格、徽章或界面元素复制进生成图。

## 测试与验收

1. Vision 主图测试确认 `handheld_use` 可规划、`effect_demo` 仍被禁止，并包含两行总限制。
2. JSON 主图测试确认最终提示词末尾包含 `FINAL EDIT DIRECTIVE`，并且不存在“副标题 + 一到两行主标题”的旧冲突表述。
3. 对比图和多场景相关测试保持通过，证明范围没有外溢。
4. 运行 `pnpm lint`、`pnpm test`、`pnpm build`。

