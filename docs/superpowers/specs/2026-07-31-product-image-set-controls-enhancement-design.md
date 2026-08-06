# 套图处理控制项增强设计

**日期：** 2026-07-31
**状态：** 已完成方案讨论，等待书面设计复核
**依赖：** `2026-07-31-product-image-set-design.md`

## 1. 背景

现有套图处理已经提供主图、对比图和多场景图三个功能，支持 SKU 多图、比例、数量、批次任务和任务恢复。本次在不改变现有任务与批次架构的前提下，增加提示词、反向提示词、具体场景和各模式专属控制项。

本设计同时调整两项旧规则：

- 对比图从固定 2 × 2 四宫格改为每张一个场景、一组 Before/After，允许左右或上下布局。
- 多场景图的场景提示词从必填改为可选，并允许单场景、拼图和宫格三种模式。

## 2. 目标与非目标

### 2.1 目标

1. 三个 Tab 均支持可选正向提示词和反向提示词。
2. 主图支持具体场景、手持方式和具体效果展示控制。
3. 对比图支持具体场景、布局方向、After 产品展示和效果程度控制。
4. 多场景图支持单场景、拼图和宫格模式，提示词可选。
5. 所有控制项使用结构化请求字段，并可从任务记录准确恢复。
6. Renderer 与 Main Process 均校验字段枚举及 Feature 适用范围。
7. 现有比例、数量、批次、部分失败、任务恢复和并发防护保持不变。

### 2.2 非目标

- 不增加敏感反向提示词识别或过滤。
- 不按模型能力动态隐藏控制项。
- 不在生成后自动判断手持、布局或效果程度是否达标。
- 不自动重试不符合控制项要求的结果。
- 不新增分屏模式；分屏需求归入拼图模式。

## 3. 页面字段

三个 Tab 继续复用现有参考图、基础参数、进阶参数布局。切换 Tab 时保留每个 Tab 的全部独立状态。

### 3.1 共享字段

- SKU 产品图：必填，支持同一 SKU 多图。
- 图片比例：使用现有比例选择器。
- 生成数量：使用现有数量选择器，并受系统 `maxCount` 限制。
- 提示词：可选，补充场景、风格、构图、光线和文案要求。
- 反向提示词：可选，描述不希望出现的元素、文字、效果或画面问题。

### 3.2 主图字段

- 具体场景词：可选；为空时 AI 根据 SKU 自动选择核心场景。
- 手持方式：`手持展示`、`不手持`，默认 `不手持`。
- 具体效果：`AI 自动判断`、`展示具体效果`、`不展示具体效果`，默认 `AI 自动判断`。

主图仍必须展示 SKU，并自动生成英文大标题。

### 3.3 对比图字段

- 具体场景词：可选；每张只使用一个场景。
- 对比布局：`AI 自动`、`左右对比`、`上下对比`，默认 `AI 自动`。
- After 产品展示：`展示产品`、`不展示产品`，默认 `展示产品`。
- 对比效果程度：`轻度`、`中度`、`重度`，默认 `中度`。

Before 始终不展示 SKU。After 是否展示 SKU 由结构化选项控制。

### 3.4 多场景图字段

- 提示词：可选；为空时 AI 根据 SKU 自动发散真实适用场景。
- 画面模式：`单场景`、`拼图`、`宫格`，默认 `单场景`。

不提供独立分屏模式。

## 4. 请求字段

新增以下领域类型与请求字段：

```ts
type ProductHandheldMode = 'handheld' | 'not_handheld';
type ProductEffectMode = 'auto' | 'show' | 'hide';
type ComparisonLayout = 'auto' | 'horizontal' | 'vertical';
type ComparisonIntensity = 'light' | 'medium' | 'heavy';
type MultiSceneLayout = 'single' | 'collage' | 'grid';

interface ImageTaskRequest {
  prompt?: string;
  negativePrompt?: string;
  scenePrompt?: string;
  productHandheldMode?: ProductHandheldMode;
  productEffectMode?: ProductEffectMode;
  comparisonLayout?: ComparisonLayout;
  comparisonIntensity?: ComparisonIntensity;
  showProduct?: boolean;
  multiSceneLayout?: MultiSceneLayout;
}
```

字段适用范围：

| 字段 | 主图 | 对比图 | 多场景图 |
|---|---|---|---|
| `prompt` | 可选 | 可选 | 可选 |
| `negativePrompt` | 可选 | 可选 | 可选 |
| `scenePrompt` | 可选 | 可选 | 不使用 |
| `productHandheldMode` | 必须 | 不使用 | 不使用 |
| `productEffectMode` | 必须 | 不使用 | 不使用 |
| `comparisonLayout` | 不使用 | 必须 | 不使用 |
| `comparisonIntensity` | 不使用 | 必须 | 不使用 |
| `showProduct` | 不使用 | 必须，控制 After | 不使用 |
| `multiSceneLayout` | 不使用 | 不使用 | 必须 |

页面提交的每个套图变体请求都携带当前模式的结构化默认值，保证任务恢复无需猜测。

## 5. 校验规则

共享请求校验必须执行：

- 枚举字段只能取定义值。
- 套图专属字段只能出现在对应 Feature 中。
- 三个 Feature 仍必须包含至少一张 `product` 图片。
- `prompt`、`negativePrompt` 和 `scenePrompt` 可以为空或缺失。
- 删除 `product_multi_scene` 的 `prompt` 必填校验。
- `variantIndex`、`variantTotal`、`count` 和 `maxCount` 规则保持不变。

非法 Feature/字段组合示例：

- `product_comparison_image` 携带 `productHandheldMode`：拒绝。
- `product_main_image` 携带 `comparisonLayout`：拒绝。
- `product_multi_scene` 携带 `scenePrompt`：拒绝。
- 任意 Feature 携带未知枚举值：拒绝。

## 6. 提示词组装

最终执行提示词按固定顺序组装：

1. Feature 固定硬规则。
2. 结构化套图控制项。
3. 用户具体场景词。
4. 用户通用提示词。
5. 用户反向提示词。
6. 批次变体序号要求。

优先级为：

```text
Feature 硬规则
> 结构化控制项
> 具体场景词
> 通用提示词
> 反向提示词
```

低优先级内容与高优先级内容冲突时，忽略冲突部分。反向提示词使用独立行：

```text
反向要求：避免出现以下内容：{negativePrompt}
```

空反向提示词不写入最终提示词。

### 6.1 结构化提示词映射

主图：

| 字段值 | 提示词要求 |
|---|---|
| `handheld` | 必须出现自然的人手持有或操作 SKU |
| `not_handheld` | SKU 不得由手持有，可放置在场景主体位置 |
| `productEffectMode=auto` | 根据 SKU 类型决定是否展示具体作用效果 |
| `productEffectMode=show` | 必须明确表现与 SKU 对应的作用过程或效果 |
| `productEffectMode=hide` | 只展示产品和适用环境，不展示作用过程或效果演示 |

对比图：

| 字段值 | 提示词要求 |
|---|---|
| `comparisonLayout=auto` | 根据比例和构图选择左右或上下布局 |
| `comparisonLayout=horizontal` | Before 左、After 右 |
| `comparisonLayout=vertical` | Before 上、After 下 |
| `comparisonIntensity=light` | 前后差异自然克制 |
| `comparisonIntensity=medium` | 前后差异清晰且可信 |
| `comparisonIntensity=heavy` | 强化视觉反差，但不得虚构产品无法支持的效果 |
| `showProduct=true` | After 必须展示 SKU |
| `showProduct=false` | After 只展示改善效果，不展示 SKU |

多场景图：

| 字段值 | 提示词要求 |
|---|---|
| `single` | 每张只展示一个完整场景 |
| `collage` | 一张图组合多个适用场景，允许不规则拼贴，各区域边界清晰 |
| `grid` | 一张图使用规则网格展示多个适用场景 |

## 7. 出图契约

### 7.1 主图

- 产品始终出现并保持 SKU 视觉身份一致。
- AI 自动生成一条清晰英文大标题。
- 有具体场景词时优先使用；为空时自动选择核心场景。
- 手持和具体效果严格服从结构化选项。
- 多张生成继续通过变体序号改变场景或主视觉构图。

### 7.2 对比图

- 每张只包含一个场景、一组 Before/After。
- Before 始终不展示 SKU。
- After 是否展示 SKU 由 `showProduct` 控制。
- 布局可以自动、左右或上下；不再固定四宫格。
- 前后保持相同环境、对象、视角、构图和光线。
- 使用清晰英文 `BEFORE`、`AFTER` 标识。
- 效果程度控制视觉差异强度，但不得虚构不真实功效。

### 7.3 多场景图

- 单场景模式每张只展示一个完整场景。
- 拼图和宫格模式允许一张图展示多个不同适用场景。
- 提示词为空时，根据 SKU 自动发散真实适用场景。
- SKU 可以不出现；若出现则保持一致。
- 默认不添加营销文字，除非正向提示词明确要求。

## 8. 任务恢复

恢复任务时还原：

- 三个 Tab：SKU 多图、比例、数量、提示词、反向提示词。
- 主图：具体场景词、手持方式、具体效果模式。
- 对比图：具体场景词、布局方向、After 产品展示、效果程度。
- 多场景图：画面模式。

旧任务缺少字段时使用：

| 字段 | 默认值 |
|---|---|
| `prompt` | 空字符串 |
| `negativePrompt` | 空字符串 |
| `scenePrompt` | 空字符串 |
| `productHandheldMode` | `not_handheld` |
| `productEffectMode` | `auto` |
| `comparisonLayout` | `auto` |
| `comparisonIntensity` | `medium` |
| `showProduct` | `true` |
| `multiSceneLayout` | `single` |

批次恢复、实时任务覆盖和异步取消机制保持不变。

## 9. 测试与验收

### 9.1 请求与领域测试

- 三个 Tab 的新增字段进入每个变体请求。
- 枚举值合法时通过，未知值拒绝。
- 字段用于错误 Feature 时拒绝。
- 多场景图缺少 `prompt` 时仍可通过。

### 9.2 提示词测试

- 固定硬规则、结构化选项、场景词、正向提示词、反向提示词和变体要求按固定顺序出现。
- 空字段不输出空提示行。
- 每个枚举值映射到准确且不冲突的自然语言规则。

### 9.3 页面与恢复测试

- 默认值正确。
- 用户可以修改全部控制项。
- 切换 Tab 后各自状态不丢失。
- 提交请求包含全部当前值。
- 新任务完整恢复；旧任务使用默认值。

### 9.4 回归验证

- SKU 多图、比例、生成数量继续工作。
- 单张和多张任务继续共享正确批次语义。
- 部分提交失败保留已创建任务。
- `maxCount`、重复点击、个人中心批次恢复和异步取消测试继续通过。
- `pnpm test`、`pnpm lint`、`pnpm build`、`pnpm build:electron` 全部通过。

## 10. 完成标准

- 三个 Tab 均可输入正向和反向提示词。
- 主图可控制具体场景、手持方式和具体效果。
- 对比图每张只表达一个场景的一组 Before/After，并可控制布局、After 产品展示和效果程度。
- 多场景图可选择单场景、拼图或宫格，且提示词不再必填。
- 所有控制项可审计、可验证、可恢复，并在 Main Process 拒绝非法值或错误 Feature 组合。
- 现有批次、恢复和并发稳定性不发生回归。
