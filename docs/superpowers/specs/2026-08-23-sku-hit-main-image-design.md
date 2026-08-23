# SKU 爆款主图设计

**日期：** 2026-08-23
**状态：** 已完成方案讨论，等待书面设计复核
**范围：** 在 SKU 作图导航下新增「爆款主图」子 Tab，用一张爆款主图参考 + 一张新 SKU 产品图，裂变生成欧美电商主图

## 1. 背景

SKU 作图目前有三个子 Tab：复刻、裂变、原创。它们的输出都是整瓶 SKU 产品图——改标签、锁包材、白底或棚拍，不生成生活方式广告主图。

套图处理的「主图」可以从 SKU 直接策划电商主图，但不接受「已有爆款主图」作为营销主题来源，也不能把「继承卖点、替换 SKU、大差异化重构图」收成一条任务。

本次在 SKU 导航增加第四个 Tab「爆款主图」：图 1 提供营销主题、文案和用途，图 2 提供必须完整替换进去的新 SKU。输出是重新创作的电商主图，不是换产品贴图，也不是整瓶 SKU 产品图。

## 2. 目标与非目标

### 2.1 目标

1. `SkuSubTab` 增加 `hitMain`，界面文案为「爆款主图」，排在原创之后。
2. `IMAGE_FEATURES` 增加 `sku_hit_main_image`，`executionModel` 为 `'edit'`。
3. 必填恰好两张图：`source` = 新 SKU 产品图，`reference` = 爆款主图参考。
4. 控件集合与现有 SKU Tab 对齐：图片比例、生成数量、品牌、产品名、容量、附加提示词、负向提示词。
5. 本 Tab 默认比例 `1:1`，默认数量 `3`。
6. 用户填写的品牌 / 产品名 / 容量覆盖图 1 中对应可见文案（含标题）；未填写的从图 1 继承。
7. 执行提示词独立于 `buildSkuExecutionPrompt`，按角色标注图 1 / 图 2，不依赖上传顺序。
8. 任务还原回到 `hitMain`，并回填两张图与全部字段。

### 2.2 非目标

- 不把该功能放进套图处理或产品处理。
- 不复用 `replace_product`、`main_image_asset_variation`、`product_main_image`。
- 不允许多张爆款主图参考，不允许多 SKU 一次提交。
- 不增加手持、对比布局、多场景宫格等套图控件。
- 不增加模板库、爆款主图素材库或画布编辑。
- 不在应用层做画面质量评分或自动重试。
- 不改变复刻 / 裂变 / 原创的包材锁与整瓶出图行为。

## 3. 方案选择

采用新 Feature + SKU 第四 Tab + 独立执行提示词。

| 项 | 选择 | 未采用 |
|---|---|---|
| 入口 | SKU 导航第四 Tab | 套图第四 Tab（与「SKU 导航栏」不符） |
| Feature | 新的 `sku_hit_main_image` | 复用 `replace_product` / `main_image_asset_variation`（路由与输出语义都不对） |
| 图片角色 | `source` + `reference` | `product` + `reference`（会把 SKU 请求组装从现有 source 惯例里拆出去） |
| 提示词 | 独立 `buildSkuHitMainImagePrompt` | 并入 `buildSkuExecutionPrompt`（该函数输出整瓶产品图，会污染本任务） |

`isSkuFeature` 继续只包含 `sku_replica`、`sku_variation`、`sku_original`。新增 `isSkuHitMainImageFeature`。`buildExecutionPrompt` 在 `isSkuFeature` 分支之前识别本 Feature，互不吞掉。

## 4. Feature 契约

在 `FEATURE_DEFINITIONS` 中新增：

```ts
sku_hit_main_image: {
  feature: 'sku_hit_main_image',
  mainPrompt: '基于爆款主图参考的营销主题与文案，把新 SKU 完整替换进去，重新创作一张大差异化欧美电商主图。继承卖点，不继承原画面。',
  acceptedImageRoles: ['source', 'reference'],
  requiredImageRoles: ['source', 'reference'],
  executionModel: 'edit',
  executionImageRoles: ['source', 'reference'],
}
```

`validateImageTaskRequest` 对本 Feature 追加数量约束（`requiredImageRoles` 只保证至少一张）：

- `source` 必须恰好 1 张。
- `reference` 必须恰好 1 张。
- 不接受 `product` / `logo` / `style`（`acceptedImageRoles` 已排除）。
- 套图专属字段仍由现有 `validateControlOwnership` 拒绝：`productHandheldMode`、`productEffectMode`、`comparisonLayout`、`comparisonIntensity`、`multiSceneLayout`、`scenePrompt`、`showProduct`。

请求组装与现有 SKU 任务相同，图片顺序为 source 在前：

```ts
images: [
  { role: 'source', path: skuPath },
  { role: 'reference', path: hitMainReferencePath },
]
```

`count > 1` 时拆成多条任务，带 `variantIndex` / `variantTotal`，每条 `count: 1`。

品牌、产品名、容量、附加提示词、负向提示词仍通过现有可选字符串字段传递；trim 后为空则不写入请求。

`FEATURE_ROUTES`：

```ts
sku_hit_main_image: { tab: 'sku', skuSubTab: 'hitMain' }
```

`IMAGE_FEATURE_LABELS`：

```ts
sku_hit_main_image: { category: 'SKU', feature: 'SKU 爆款主图' }
```

## 5. 页面与交互

### 5.1 导航

`SkuGen` 子 Tab 顺序：复刻、裂变、原创、爆款主图。默认仍进入复刻。切换 Tab 时保留各 Tab 自己的 `SkuTabState`。

`tabStates` 增加 `hitMain`。新增 `DEFAULT_SKU_HIT_MAIN_COUNT = 3`，写入 `DEFAULT_COUNT_BY_SUBTAB.hitMain`。数量选项仍来自 `SKU_IMAGE_COUNT_OPTIONS`（`1, 2, 3, 6`）。

`defaultTabState('hitMain')` 的 `aspectRatio` 为 `'1:1'`。其它三个 Tab 继续用 `DEFAULT_IMAGE_ASPECT_RATIO`（`'auto'`）。

### 5.2 上传顺序

与其它 SKU Tab 一致，先 SKU 后参考：

| 顺序 | 标签 | 角色 | 必填 | 数量 |
|---|---|---|---|---|
| 1 | SKU 图 | `source` | 是 | 提交时取第一张 |
| 2 | 爆款主图参考 | `reference` | 是 | 恰好 1 张 |

第二个上传区的 placeholder 写明「上传一张爆款电商主图作卖点与场景参考」，避免和复刻的「包装设计参考图，可多张」混淆。该区 `optional={false}`。

现有 `ImageUploader` 仍允许一次选多张。`buildSkuImageGenRequests` 对本 Tab：

- `skuPath` 为空：抛「请上传 SKU 图」（与复刻同一句）。
- `referencePaths.length === 0`：抛「请上传爆款主图参考」。
- `referencePaths.length > 1`：抛「爆款主图参考只能上传 1 张」。

SKU 有多张时只把第一张写入 `skuPath`，与现有 Tab 一致。

### 5.3 其它控件

与复刻 / 裂变共用 `SkuParameterFields`、`SkuNegativePromptField`、`AspectRatioSelect`、`ImageCountSelector`。

| 控件 | 默认 | 说明 |
|---|---|---|
| 图片比例 | `1:1` | 可选其它现有预设，不锁死 |
| 生成数量 | `3` | 选项仍为 `1, 2, 3, 6` |
| 品牌 / 产品名 / 容量 | 空 | 非必填 |
| 附加提示词 | 空 | 有边界的补充要求 |
| 负向提示词 | 空 | 现有 `MAX_NEGATIVE_PROMPT_LENGTH` 不变 |

产品名对本 Tab 不强制必填（与复刻相同，与原创不同）。

附加提示词 placeholder：「例如：标题改成 WHITE RADIATOR REPAIR，对比更强，产品再大一点」。

提交失败继续 `alert`；进行中与结果继续走现有任务抽屉、复制图片、打开目录。`SkuGen` 仍调用 `submitMany`。

### 5.4 还原

`applySkuImageGenRestore` 增加 `sku_hit_main_image` 分支：

- `subTab` 设为 `hitMain`
- 回填 `hitMain` 的 SKU 图、爆款主图参考、比例、数量、品牌、产品名、容量、正负向提示词
- 其它三个 Tab 保持各自默认空状态

`SkuImageGenRestoreState` 增加 `hitMain: SkuTabState`。`emptyTabState` 对 `hitMain` 使用比例 `'1:1'`、数量 `3`；其它 Tab 仍为比例 `'auto'` 与各自默认数量。

## 6. 执行提示词

新建 `electron/main/services/image-tasks/skuHitMainImagePrompt.ts`，导出 `isSkuHitMainImageFeature` 与 `buildSkuHitMainImagePrompt`。

`buildExecutionPrompt` 在 `isSkuFeature` 分支之前调用本 builder。禁止把 `sku_hit_main_image` 交给 `buildSkuExecutionPrompt`。

`EDIT_VERB_REPLACEMENTS` 增加：

```ts
sku_hit_main_image: 'Edit the SKU and viral main-image reference to produce',
```

不得套用「Edit the SKU package image to apply」。

提示词按角色写死，不按数组下标猜图：

- `reference` = 图 1：爆款主图参考。继承营销主题、核心英文文案、产品用途 / 使用场景类型、卖点逻辑。不是包装贴标参考。
- `source` = 图 2：新 SKU 产品图。产品本体唯一标准。必须完整替换图 1 原产品。

即使页面上传顺序是 SKU 在前、请求数组里 `source` 也在前，模型指令仍把 `reference` 叫作图 1、`source` 叫作图 2。

### 6.1 必须保留

- 图 1 的核心英文标题、副标题和明确营销文案，原则上原文字保留。
- 图 1 的产品用途和使用场景类型，不改要解决的问题。
- 图 1 若限定具体对象（如 WHITE RADIATOR REPAIR、STAINLESS STEEL、CAR SCRATCH REPAIR），裂变后仍围绕该对象。

### 6.2 产品替换（最高优先级）

删除图 1 原产品，换成图 2 SKU。锁：包材结构、高宽比、瓶型 / 罐型 / 软管、瓶盖 / 开口、材质、颜色、透明度、标签视觉、品牌、产品名称、容量、整体识别特征。禁止拉长、压扁、变细、变宽或重设计图 2。

整体广告配色优先从图 2 标签提取主色、辅助色和气质。

本任务不是「只改标签、输出整瓶白底 SKU 图」。包材锁只作用于画面里的 SKU 本体，不阻止重做场景和版式。

### 6.3 大差异化

禁止复制图 1 构图。每次至少同时改变 3 个以上维度，维度包括：产品位置、产品大小比例、标题位置与分行、场景构图、场景物体款式、拍摄角度、远近景、Before/After 表现、对比区域形状、信息区布局、背景空间结构、产品与场景的视觉关系。

禁止只做：换色、左右翻转、产品左右互换、只移动标题、原场景复刻、原图换 SKU。

同批多张（`variantTotal > 1`）之间也必须构图互异，不得只换色。

### 6.4 场景重做

保持图 1 的「使用场景类型」，但重新生成具体素材、角度和构图。新场景不得与图 1 使用完全相同的物体、角度和构图。

### 6.5 构图与 Before/After

版式不固定模板，由模型按转化选择。产品必须有足够曝光，不得过小。

若图 1 含修复前后，必须保留该营销逻辑，但重做表现形式。BEFORE 问题真实明显，AFTER 改善清晰，同一物体同一区域对比，不过度夸张，不制造不真实材质变化。

### 6.6 文字与字段覆盖

- 图 1 核心文案优先原样保留。
- 允许改字号、分行、位置、层级、字重，以及按图 2 视觉体系改文字颜色和底衬。
- 禁止擅自改写核心标题、添加大量新卖点、乱码、假英文、重复文字、无意义小字、大量功能小图标。
- 用户填写了 `brand` / `productName` / `capacity` 时：覆盖图 1 中对应文案，包括标题区里出现的对应词。
- 用户未填写的字段：从图 1 继承；无法识别时省略，不得编造。
- `prompt`：有边界补充（语气、对比强度、产品大小等），不得推翻图 2 包材锁，也不得把任务改成整瓶白底图。
- 画面可见营销文字优先自然英文；中文来源译成对应英文。

### 6.7 输出目标

一张用户所选比例的欧美 Temu / Amazon 高点击电商主图。继承图 1 的卖点，不继承图 1 的画面。只输出最终图片，不输出分析过程。

`mainPrompt` 只保留短摘要。详细契约全部由 `buildSkuHitMainImagePrompt` 写入执行提示词。`buildExecutionPrompt` 命中本 Feature 后直接返回该 builder 结果，不要再把短 `mainPrompt` 拼进去。

## 7. 数据流

1. 用户在「爆款主图」填写表单并提交。
2. `buildSkuImageGenRequests` 校验两张图与数量，组装 `sku_hit_main_image` 请求。
3. 现有 `submitMany` / 任务队列 / 桌面 IPC 不变。
4. `buildExecutionPrompt` 识别本 Feature，调用 `buildSkuHitMainImagePrompt`。
5. 图片模型按 edit 协议收到 SKU 图、爆款主图参考、以及结构化执行提示词。
6. 结果写入现有任务记录与输出目录；SKU 页按 Feature 拉取任务并展示。

## 8. 错误处理

| 条件 | 表现 |
|---|---|
| 未上传 SKU | 提交前 `alert`「请上传 SKU 图」 |
| 未上传爆款主图参考 | 提交前 `alert`「请上传爆款主图参考」 |
| 爆款主图参考多于 1 张 | 提交前 `alert`「爆款主图参考只能上传 1 张」 |
| 请求越过 UI 直接打到 API 且 source/reference 数量不是各 1 张 | `validateImageTaskRequest` 抛错 |
| 模型或任务失败 | 现有任务错误条与日志，不新增重试策略 |

## 9. 测试

| 层 | 覆盖 |
|---|---|
| `src/shared/domain/__tests__/imageFeatureApi.test.ts` | 新 Feature 定义；缺 source / 缺 reference / 任一侧多于 1 张失败；套图字段被拒绝 |
| `src/features/sku-image-gen/__tests__/skuImageGenRequests.test.ts` | 组装 `sku_hit_main_image`；图片顺序为 source 后 reference；两张都必填；参考多于 1 张失败；`count=3` 拆 3 条任务 |
| `electron/main/services/image-tasks/__tests__/skuHitMainImagePrompt.test.ts` | 按角色把 reference 标成图 1、source 标成图 2；含大差异化与包材锁；填写的品牌覆盖标题语义；未填写则继承图 1；附加提示词有边界 |
| `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts` | 本 Feature 不走 `buildSkuExecutionPrompt`；结果不含「输出一张完整的 SKU 产品图」 |
| `src/shared/view/__tests__/featureRoutes.test.ts` 与 `imageFeatureLabels` 测试 | 路由到 SKU `hitMain`；标签为 SKU 爆款主图 |
| `src/features/sku-image-gen` 还原测试 | 还原到 `hitMain` 并回填两张图与字段 |
| `src/components/SkuGen.tsx` 对应测试（若尚无则新增） | 第四 Tab 文案为「爆款主图」；该 Tab 参考上传标签为「爆款主图参考」且必填 |

不把真实模型出图或截图回归列入本次范围。

## 10. 实现落点

- `src/shared/domain/imageFeatureApi.ts`
- `src/shared/domain/imageFeatureLabels.ts`
- `src/shared/view/ui.ts`
- `src/shared/view/featureRoutes.ts`
- `src/shared/view/skuCountOptions.ts`
- `src/features/sku-image-gen/skuImageGenRequests.ts`
- `src/features/sku-image-gen/applySkuImageGenRestore.ts`
- `src/components/SkuGen.tsx`
- `electron/main/services/image-tasks/instructionPrompt.ts`
- `electron/main/services/image-tasks/skuHitMainImagePrompt.ts`（新建）
- 对应现有测试文件；SkuGen 若尚无测试则新增

不修改贴纸、产品处理、套图处理的 Feature 行为。
