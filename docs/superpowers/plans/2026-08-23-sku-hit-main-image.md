# SKU 爆款主图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 SKU 作图下新增第四个 Tab「爆款主图」，用一张 SKU 图 + 一张爆款主图参考，裂变生成欧美电商主图。

**Architecture:** 新增独立 Feature `sku_hit_main_image`。`source` = 新 SKU，`reference` = 爆款主图参考，各恰好 1 张。请求组装沿用现有 SKU 任务拆分。执行提示词走独立 builder，**不要**交给 `buildSkuExecutionPrompt`（那条链路输出整瓶 SKU 产品图）。`isSkuFeature` 继续只包含复刻/裂变/原创。

**Tech Stack:** TypeScript 5.8, React 19, Electron 37, Vitest, Testing Library

## Global Constraints

- 包管理只用 `pnpm` / `pnpm dlx`。
- 测试命令：`pnpm vitest run <file>`。
- Feature ID 固定为 `sku_hit_main_image`；子 Tab ID 固定为 `hitMain`；界面文案固定为「爆款主图」。
- 图片角色：`source` = 新 SKU，`reference` = 爆款主图参考；各恰好 1 张。
- `isSkuFeature()` 不得包含 `sku_hit_main_image`。
- 默认比例 `1:1`，默认数量 `3`；数量选项仍是 `1, 2, 3, 6`。
- 用户填写的 `brand` / `productName` / `capacity` 覆盖图 1 对应文案（含标题）；未填写则从图 1 继承。
- 不修改贴纸、产品处理、套图处理的 Feature 行为。
- 规格来源：`docs/superpowers/specs/2026-08-23-sku-hit-main-image-design.md`。

---

## File Map

**Create:**

- `electron/main/services/image-tasks/skuHitMainImagePrompt.ts` — 爆款主图执行提示词。
- `electron/main/services/image-tasks/__tests__/skuHitMainImagePrompt.test.ts` — 角色标注、包材锁、字段覆盖、边界测试。
- `src/components/__tests__/SkuGen.test.tsx` — 第四 Tab、参考区文案、提交校验。
- `src/features/sku-image-gen/__tests__/applySkuImageGenRestore.test.ts` — 还原到 `hitMain`。

**Modify:**

- `src/shared/domain/imageFeatureApi.ts` — 注册 Feature，校验 source/reference 各 1 张。
- `src/shared/domain/__tests__/imageFeatureApi.test.ts` — 定义与校验。
- `src/shared/domain/imageFeatureLabels.ts` — 任务列表文案。
- `src/shared/view/ui.ts` — `SkuSubTab` 增加 `hitMain`。
- `src/shared/view/featureRoutes.ts` — 路由到 SKU `hitMain`。
- `src/shared/view/__tests__/featureRoutes.test.ts` — 路由断言。
- `src/shared/view/skuCountOptions.ts` — `DEFAULT_SKU_HIT_MAIN_COUNT = 3`。
- `src/features/sku-image-gen/skuImageGenRequests.ts` — 组装 `sku_hit_main_image`。
- `src/features/sku-image-gen/__tests__/skuImageGenRequests.test.ts` — 组装与校验。
- `src/features/sku-image-gen/applySkuImageGenRestore.ts` — 还原 `hitMain`。
- `electron/main/services/image-tasks/instructionPrompt.ts` — 独立分支 + edit 动词。
- `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts` — 不走整瓶 SKU 提示词。
- `src/components/SkuGen.tsx` — 第四 Tab 与上传文案。
- `src/components/SkuParameterFields.tsx` — `prefix` 改为 `SkuSubTab`。
- `src/components/SkuNegativePromptField.tsx` — `prefix` 改为 `SkuSubTab`。

---

### Task 1: Domain contract

**Files:**
- Modify: `src/shared/domain/imageFeatureApi.ts`
- Modify: `src/shared/domain/__tests__/imageFeatureApi.test.ts`
- Modify: `src/shared/domain/imageFeatureLabels.ts`
- Modify: `src/shared/view/ui.ts`
- Modify: `src/shared/view/featureRoutes.ts`
- Modify: `src/shared/view/__tests__/featureRoutes.test.ts`
- Modify: `src/shared/view/skuCountOptions.ts`

**Interfaces:**
- Consumes: existing `ImageFeature`, `ImageFeatureDefinition`, `validateImageTaskRequest`, `IMAGE_FEATURE_LABELS`, `FEATURE_ROUTES`
- Produces: `sku_hit_main_image` in `IMAGE_FEATURES`; `SkuSubTab` includes `'hitMain'`; `DEFAULT_SKU_HIT_MAIN_COUNT = 3`; route `{ tab: 'sku', skuSubTab: 'hitMain' }`; labels `{ category: 'SKU', feature: 'SKU 爆款主图' }`

- [ ] **Step 1: Write the failing tests**

Append to `src/shared/domain/__tests__/imageFeatureApi.test.ts`:

```ts
it('defines sku hit main image as a two-image edit that is not a bottle SKU shot', () => {
  const definition = getImageFeatureDefinition('sku_hit_main_image');

  expect(definition.acceptedImageRoles).toEqual(['source', 'reference']);
  expect(definition.requiredImageRoles).toEqual(['source', 'reference']);
  expect(definition.executionModel).toBe('edit');
  expect(definition.executionImageRoles).toEqual(['source', 'reference']);
  expect(definition.mainPrompt).toContain('爆款主图');
  expect(definition.mainPrompt).toContain('不继承原画面');
  expect(definition.mainPrompt).not.toContain('输出整瓶 SKU 产品图');
});

it('requires exactly one source and one reference for sku hit main image', () => {
  const valid = {
    feature: 'sku_hit_main_image' as const,
    images: [
      { role: 'source' as const, path: '/authorized/input/sku.png' },
      { role: 'reference' as const, path: '/authorized/input/hit-main.png' },
    ],
  };

  expect(validateImageTaskRequest(valid).feature).toBe('sku_hit_main_image');

  expect(() => validateImageTaskRequest({
    ...valid,
    images: [{ role: 'source', path: '/authorized/input/sku.png' }],
  })).toThrow('sku_hit_main_image requires image role reference');

  expect(() => validateImageTaskRequest({
    ...valid,
    images: [{ role: 'reference', path: '/authorized/input/hit-main.png' }],
  })).toThrow('sku_hit_main_image requires image role source');

  expect(() => validateImageTaskRequest({
    ...valid,
    images: [
      { role: 'source', path: '/authorized/input/sku.png' },
      { role: 'source', path: '/authorized/input/sku-2.png' },
      { role: 'reference', path: '/authorized/input/hit-main.png' },
    ],
  })).toThrow('sku_hit_main_image requires exactly one source image');

  expect(() => validateImageTaskRequest({
    ...valid,
    images: [
      { role: 'source', path: '/authorized/input/sku.png' },
      { role: 'reference', path: '/authorized/input/hit-main.png' },
      { role: 'reference', path: '/authorized/input/hit-main-2.png' },
    ],
  })).toThrow('sku_hit_main_image requires exactly one reference image');
});

it('rejects product-set controls on sku hit main image', () => {
  const request = {
    feature: 'sku_hit_main_image' as const,
    images: [
      { role: 'source' as const, path: '/authorized/input/sku.png' },
      { role: 'reference' as const, path: '/authorized/input/hit-main.png' },
    ],
  };

  expect(() => validateImageTaskRequest({ ...request, productHandheldMode: 'handheld' })).toThrow(
    'productHandheldMode is not supported by sku_hit_main_image',
  );
  expect(() => validateImageTaskRequest({ ...request, showProduct: true })).toThrow(
    'showProduct is not supported by sku_hit_main_image',
  );
});
```

Append to `src/shared/view/__tests__/featureRoutes.test.ts` inside the existing SKU test:

```ts
expect(getFeatureRoute('sku_hit_main_image')).toEqual({
  tab: 'sku',
  skuSubTab: 'hitMain',
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/shared/domain/__tests__/imageFeatureApi.test.ts src/shared/view/__tests__/featureRoutes.test.ts`

Expected: FAIL because `'sku_hit_main_image'` is not in `IMAGE_FEATURES`.

- [ ] **Step 3: Implement the contract**

In `src/shared/view/ui.ts`, change:

```ts
export type SkuSubTab = 'replica' | 'variation' | 'original' | 'hitMain';
```

In `src/shared/view/skuCountOptions.ts`, add:

```ts
export const DEFAULT_SKU_HIT_MAIN_COUNT: SkuImageCountValue = 3;
```

In `src/shared/domain/imageFeatureApi.ts`:

1. Append `'sku_hit_main_image'` to `IMAGE_FEATURES` after `'sku_original'`.
2. Add definition after `sku_original`:

```ts
sku_hit_main_image: {
  feature: 'sku_hit_main_image',
  mainPrompt: '基于爆款主图参考的营销主题与文案，把新 SKU 完整替换进去，重新创作一张大差异化欧美电商主图。继承卖点，不继承原画面。',
  acceptedImageRoles: ['source', 'reference'],
  requiredImageRoles: ['source', 'reference'],
  executionModel: 'edit',
  executionImageRoles: ['source', 'reference'],
},
```

3. Inside `validateImageTaskRequest`, after the `requiredImageRoles` loop and before `validateProductSetControls(input)`, add:

```ts
if (input.feature === 'sku_hit_main_image') {
  const sourceCount = images.filter((image) => image.role === 'source').length;
  const referenceCount = images.filter((image) => image.role === 'reference').length;
  if (sourceCount !== 1) {
    throw new Error('sku_hit_main_image requires exactly one source image');
  }
  if (referenceCount !== 1) {
    throw new Error('sku_hit_main_image requires exactly one reference image');
  }
}
```

In `src/shared/domain/imageFeatureLabels.ts` add:

```ts
sku_hit_main_image: { category: 'SKU', feature: 'SKU 爆款主图' },
```

In `src/shared/view/featureRoutes.ts` add:

```ts
sku_hit_main_image: { tab: 'sku', skuSubTab: 'hitMain' },
```

Because `FEATURE_DEFINITIONS`, `IMAGE_FEATURE_LABELS`, and `FEATURE_ROUTES` are `Record<ImageFeature, ...>`, TypeScript will not compile until all three maps include the new key. Update them in this same step.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/shared/domain/__tests__/imageFeatureApi.test.ts src/shared/view/__tests__/featureRoutes.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/domain/imageFeatureApi.ts src/shared/domain/__tests__/imageFeatureApi.test.ts src/shared/domain/imageFeatureLabels.ts src/shared/view/ui.ts src/shared/view/featureRoutes.ts src/shared/view/__tests__/featureRoutes.test.ts src/shared/view/skuCountOptions.ts
git commit -m "feat: register sku hit main image feature contract"
```

---

### Task 2: Request builder

**Files:**
- Modify: `src/features/sku-image-gen/skuImageGenRequests.ts`
- Modify: `src/features/sku-image-gen/__tests__/skuImageGenRequests.test.ts`

**Interfaces:**
- Consumes: `SkuSubTab` now includes `'hitMain'`; `sku_hit_main_image`
- Produces: `FEATURE_BY_SUB_TAB.hitMain === 'sku_hit_main_image'`; `buildSkuImageGenRequests` requires exactly one reference path for `hitMain`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/sku-image-gen/__tests__/skuImageGenRequests.test.ts`:

```ts
it('builds hit-main requests with source then a single reference', () => {
  const requests = buildSkuImageGenRequests({
    subTab: 'hitMain',
    skuPath: '/tmp/sku.png',
    referencePaths: ['/tmp/hit-main.png'],
    aspectRatio: '1:1',
    count: 3,
    brand: 'wkau',
    productName: 'Radiator Repair',
    capacity: '100ml',
    prompt: '对比更强',
    negativePrompt: 'no fake english',
  });

  expect(requests).toHaveLength(3);
  expect(requests[0]).toMatchObject({
    feature: 'sku_hit_main_image',
    count: 1,
    aspectRatio: '1:1',
    brand: 'wkau',
    productName: 'Radiator Repair',
    capacity: '100ml',
    prompt: '对比更强',
    negativePrompt: 'no fake english',
    variantIndex: 1,
    variantTotal: 3,
    images: [
      { role: 'source', path: '/tmp/sku.png' },
      { role: 'reference', path: '/tmp/hit-main.png' },
    ],
  });
  expect(requests[2].variantIndex).toBe(3);
});

it('requires exactly one hit-main reference image', () => {
  const base = {
    subTab: 'hitMain' as const,
    skuPath: '/tmp/sku.png',
    aspectRatio: '1:1' as const,
    count: 1,
    brand: '',
    productName: '',
    capacity: '',
    prompt: '',
    negativePrompt: '',
  };

  expect(() => buildSkuImageGenRequests({ ...base, referencePaths: [] }))
    .toThrow('请上传爆款主图参考');
  expect(() => buildSkuImageGenRequests({
    ...base,
    referencePaths: ['/tmp/a.png', '/tmp/b.png'],
  })).toThrow('爆款主图参考只能上传 1 张');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/sku-image-gen/__tests__/skuImageGenRequests.test.ts`

Expected: FAIL because `FEATURE_BY_SUB_TAB` does not include `hitMain` (`Record<SkuSubTab, ...>` may already be a compile error after Task 1).

- [ ] **Step 3: Implement request assembly**

In `src/features/sku-image-gen/skuImageGenRequests.ts`:

1. Add to `FEATURE_BY_SUB_TAB`:

```ts
hitMain: 'sku_hit_main_image',
```

2. After the replica reference check, add:

```ts
if (input.subTab === 'hitMain' && input.referencePaths.length === 0) {
  throw new Error('请上传爆款主图参考');
}

if (input.subTab === 'hitMain' && input.referencePaths.length > 1) {
  throw new Error('爆款主图参考只能上传 1 张');
}
```

Do not add a product-name requirement for `hitMain`. Keep replica's multi-reference behavior unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/sku-image-gen/__tests__/skuImageGenRequests.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/sku-image-gen/skuImageGenRequests.ts src/features/sku-image-gen/__tests__/skuImageGenRequests.test.ts
git commit -m "feat: assemble sku hit main image generation requests"
```

---

### Task 3: Execution prompt and instruction routing

**Files:**
- Create: `electron/main/services/image-tasks/skuHitMainImagePrompt.ts`
- Create: `electron/main/services/image-tasks/__tests__/skuHitMainImagePrompt.test.ts`
- Modify: `electron/main/services/image-tasks/instructionPrompt.ts`
- Modify: `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`

**Interfaces:**
- Consumes: `ImageFeature`, `ImageTaskRequest`
- Produces:
  - `isSkuHitMainImageFeature(feature: ImageFeature): boolean`
  - `buildSkuHitMainImagePrompt(request: ImageTaskRequest): string`
  - `buildExecutionPrompt` returns the hit-main builder result and never `buildSkuExecutionPrompt` for this feature
  - `EDIT_VERB_REPLACEMENTS.sku_hit_main_image = 'Edit the SKU and viral main-image reference to produce'`

- [ ] **Step 1: Write the failing tests**

Create `electron/main/services/image-tasks/__tests__/skuHitMainImagePrompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSkuHitMainImagePrompt, isSkuHitMainImageFeature } from '../skuHitMainImagePrompt';
import { isSkuFeature } from '../skuExecutionPrompt';

const baseRequest = {
  feature: 'sku_hit_main_image' as const,
  images: [
    { role: 'source' as const, path: '/tmp/sku.png' },
    { role: 'reference' as const, path: '/tmp/hit-main.png' },
  ],
};

describe('skuHitMainImagePrompt', () => {
  it('is not classified as a bottle SKU feature', () => {
    expect(isSkuHitMainImageFeature('sku_hit_main_image')).toBe(true);
    expect(isSkuFeature('sku_hit_main_image')).toBe(false);
  });

  it('labels reference as image 1 and source as image 2 regardless of array order', () => {
    const prompt = buildSkuHitMainImagePrompt(baseRequest);

    expect(prompt).toContain('图 1');
    expect(prompt).toContain('爆款主图参考');
    expect(prompt).toContain('图 2');
    expect(prompt).toContain('新 SKU');
    expect(prompt.indexOf('爆款主图参考')).toBeLessThan(prompt.indexOf('新 SKU 产品图') === -1
      ? prompt.indexOf('新 SKU')
      : prompt.indexOf('新 SKU 产品图'));
    expect(prompt).not.toContain('输出一张完整的 SKU 产品图');
    expect(prompt).toContain('至少同时改变 3 个以上维度');
    expect(prompt).toContain('禁止拉长、压扁、变细、变宽或重设计图 2');
  });

  it('overrides filled brand/product/capacity including titles, and inherits blank fields from image 1', () => {
    const filled = buildSkuHitMainImagePrompt({
      ...baseRequest,
      brand: 'wkau',
      productName: 'WHITE RADIATOR REPAIR',
      capacity: '100ml',
    });
    expect(filled).toContain('品牌: "wkau"');
    expect(filled).toContain('产品名称: "WHITE RADIATOR REPAIR"');
    expect(filled).toContain('容量: "100ml"');
    expect(filled).toContain('包括标题区里出现的对应词');

    const inherited = buildSkuHitMainImagePrompt(baseRequest);
    expect(inherited).toContain('未填写的品牌、产品名、容量从图 1 继承');
    expect(inherited).not.toContain('品牌: "');
  });

  it('bounds additional prompt and requires batch composition diversity', () => {
    const prompt = buildSkuHitMainImagePrompt({
      ...baseRequest,
      prompt: '对比更强，产品再大一点',
      variantIndex: 2,
      variantTotal: 3,
    });

    expect(prompt).toContain('对比更强，产品再大一点');
    expect(prompt).toContain('不得推翻图 2 包材锁');
    expect(prompt).toContain('同批多张之间构图必须互异');
  });
});
```

Append to `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`:

```ts
it('routes sku hit main image through its own prompt instead of bottle SKU prompt', () => {
  const prompt = buildExecutionPrompt({
    feature: 'sku_hit_main_image',
    images: [
      { role: 'source', path: '/tmp/sku.png' },
      { role: 'reference', path: '/tmp/hit-main.png' },
    ],
    brand: 'wkau',
  }, 'short main prompt that should not be concatenated');

  expect(prompt).toContain('图 1');
  expect(prompt).toContain('爆款主图参考');
  expect(prompt).toContain('品牌: "wkau"');
  expect(prompt).not.toContain('输出一张完整的 SKU 产品图');
  expect(prompt).not.toContain('short main prompt that should not be concatenated');
});
```

Import `buildExecutionPrompt` is already present in that file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/skuHitMainImagePrompt.test.ts electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`

Expected: FAIL because `skuHitMainImagePrompt.ts` does not exist.

- [ ] **Step 3: Implement the prompt builder**

Create `electron/main/services/image-tasks/skuHitMainImagePrompt.ts` with this exact implementation:

```ts
import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';

export function isSkuHitMainImageFeature(feature: ImageFeature): boolean {
  return feature === 'sku_hit_main_image';
}

export function buildSkuHitMainImagePrompt(request: ImageTaskRequest): string {
  return [
    buildRoleSection(),
    buildKeepSection(),
    buildProductReplaceSection(),
    buildDifferentiationSection(request),
    buildSceneSection(),
    buildLayoutSection(),
    buildCopySection(request),
    buildOutputSection(request),
  ].filter(Boolean).join('\n\n');
}

function quoted(value: string) {
  return `"${value.trim()}"`;
}

function buildRoleSection() {
  return [
    '图片角色（按角色识别，不要按下标猜）：',
    '图 1 = reference = 爆款主图参考。继承营销主题、核心英文文案、产品用途/使用场景类型、卖点逻辑。不是包装贴标参考。',
    '图 2 = source = 新 SKU 产品图。产品本体唯一标准。必须完整替换图 1 原产品。',
    '即使数组里 source 在前，也必须把 reference 叫作图 1、source 叫作图 2。',
  ].join('\n');
}

function buildKeepSection() {
  return [
    '必须保留：',
    '图 1 的核心英文标题、副标题和明确营销文案，原则上原文字保留。',
    '图 1 的产品用途和使用场景类型，不改要解决的问题。',
    '图 1 若限定具体对象（如 WHITE RADIATOR REPAIR、STAINLESS STEEL、CAR SCRATCH REPAIR），裂变后仍围绕该对象。',
  ].join('\n');
}

function buildProductReplaceSection() {
  return [
    '产品替换（最高优先级）：',
    '删除图 1 原产品，换成图 2 SKU。',
    '锁：包材结构、高宽比、瓶型/罐型/软管、瓶盖/开口、材质、颜色、透明度、标签视觉、品牌、产品名称、容量、整体识别特征。',
    '禁止拉长、压扁、变细、变宽或重设计图 2。',
    '整体广告配色优先从图 2 标签提取主色、辅助色和气质。',
    '本任务不是只改标签、输出整瓶白底 SKU 图。包材锁只作用于画面里的 SKU 本体，不阻止重做场景和版式。',
  ].join('\n');
}

function buildDifferentiationSection(request: ImageTaskRequest) {
  const lines = [
    '大差异化：',
    '禁止复制图 1 构图。每次至少同时改变 3 个以上维度。',
    '维度包括：产品位置、产品大小比例、标题位置与分行、场景构图、场景物体款式、拍摄角度、远近景、Before/After 表现、对比区域形状、信息区布局、背景空间结构、产品与场景的视觉关系。',
    '禁止只做：换色、左右翻转、产品左右互换、只移动标题、原场景复刻、原图换 SKU。',
  ];

  if ((request.variantTotal ?? 1) > 1) {
    lines.push('同批多张之间构图必须互异，不得只换色。');
  }

  return lines.join('\n');
}

function buildSceneSection() {
  return [
    '场景重做：',
    '保持图 1 的使用场景类型，但重新生成具体素材、角度和构图。',
    '新场景不得与图 1 使用完全相同的物体、角度和构图。',
    '若图 1 含修复前后，必须保留该营销逻辑，但重做表现形式。BEFORE 问题真实明显，AFTER 改善清晰，同一物体同一区域对比，不过度夸张，不制造不真实材质变化。',
  ].join('\n');
}

function buildLayoutSection() {
  return [
    '构图：',
    '版式不固定模板，由转化效果决定。产品必须有足够曝光，不得过小。',
    '输出欧美 Temu / Amazon 高点击电商主图。继承图 1 的卖点，不继承图 1 的画面。',
    '只输出最终图片，不输出分析过程。',
  ].join('\n');
}

function buildCopySection(request: ImageTaskRequest) {
  const brand = request.brand?.trim();
  const productName = request.productName?.trim();
  const capacity = request.capacity?.trim();
  const extra = request.prompt?.trim();
  const lines = [
    '文字规则：',
    '图 1 核心文案优先原样保留。',
    '允许改字号、分行、位置、层级、字重，以及按图 2 视觉体系改文字颜色和底衬。',
    '禁止擅自改写核心标题、添加大量新卖点、乱码、假英文、重复文字、无意义小字、大量功能小图标。',
    '画面可见营销文字优先自然英文；中文来源译成对应英文。',
  ];

  if (brand) {
    lines.push(`品牌: ${quoted(brand)}`);
  }
  if (productName) {
    lines.push(`产品名称: ${quoted(productName)}`);
  }
  if (capacity) {
    lines.push(`容量: ${quoted(capacity)}`);
  }
  if (brand || productName || capacity) {
    lines.push('以上已填写字段必须覆盖图 1 中对应文案，包括标题区里出现的对应词。');
  }
  if (!brand || !productName || !capacity) {
    lines.push('未填写的品牌、产品名、容量从图 1 继承；无法识别时省略，不得编造。');
  }
  if (extra) {
    lines.push(`附加要求: ${quoted(extra)}`);
    lines.push('附加要求只做有边界补充（语气、对比强度、产品大小等），不得推翻图 2 包材锁，也不得把任务改成整瓶白底图。');
  }

  return lines.join('\n');
}

function buildOutputSection(request: ImageTaskRequest) {
  const ratio = request.aspectRatio?.trim() || '1:1';
  return [
    '输出目标:',
    `目标画布比例: ${quoted(ratio)}；只调整内部构图，不得改变画布比例。`,
  ].join('\n');
}
```

In `electron/main/services/image-tasks/instructionPrompt.ts`:

1. Import:

```ts
import { buildSkuHitMainImagePrompt, isSkuHitMainImageFeature } from './skuHitMainImagePrompt.js';
```

2. In `buildExecutionPrompt`, **before** the `isSkuFeature` branch:

```ts
if (isSkuHitMainImageFeature(request.feature)) {
  return buildSkuHitMainImagePrompt(request);
}
```

3. Add to `EDIT_VERB_REPLACEMENTS`:

```ts
sku_hit_main_image: 'Edit the SKU and viral main-image reference to produce',
```

Do not add `sku_hit_main_image` to `SKU_FEATURES` in `skuExecutionPrompt.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/skuHitMainImagePrompt.test.ts electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts electron/main/services/image-tasks/__tests__/skuExecutionPrompt.test.ts`

Expected: PASS. Existing bottle SKU prompt tests still pass.

- [ ] **Step 5: Commit**

```bash
git add electron/main/services/image-tasks/skuHitMainImagePrompt.ts electron/main/services/image-tasks/__tests__/skuHitMainImagePrompt.test.ts electron/main/services/image-tasks/instructionPrompt.ts electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts
git commit -m "feat: add sku hit main image execution prompt"
```

---

### Task 4: Task restore

**Files:**
- Modify: `src/features/sku-image-gen/applySkuImageGenRestore.ts`
- Create: `src/features/sku-image-gen/__tests__/applySkuImageGenRestore.test.ts`

**Interfaces:**
- Consumes: `sku_hit_main_image`, `DEFAULT_SKU_HIT_MAIN_COUNT`, `SkuTabState`
- Produces: `SkuImageGenRestoreState.hitMain: SkuTabState`; `applySkuImageGenRestore` returns `subTab: 'hitMain'` for this feature

- [ ] **Step 1: Write the failing test**

Create `src/features/sku-image-gen/__tests__/applySkuImageGenRestore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { TaskRecord } from '../../../shared/domain/tasks';
import { applySkuImageGenRestore } from '../applySkuImageGenRestore';

function createTask(request: NonNullable<TaskRecord['request']>): TaskRecord {
  return {
    taskId: 'task-1',
    batchId: 'batch-1',
    category: 'SKU',
    feature: 'SKU 爆款主图',
    status: 'Pending',
    imports: [],
    outputs: [],
    request,
    createdAt: '2026-08-23T00:00:00.000Z',
    updatedAt: '2026-08-23T00:00:00.000Z',
  };
}

describe('applySkuImageGenRestore', () => {
  it('restores hit-main tab with both images and form fields', () => {
    const restored = applySkuImageGenRestore(createTask({
      feature: 'sku_hit_main_image',
      images: [
        { role: 'source', path: 'C:/sku/new.png' },
        { role: 'reference', path: 'C:/refs/hit-main.png' },
      ],
      aspectRatio: '1:1',
      brand: 'wkau',
      productName: 'WHITE RADIATOR REPAIR',
      capacity: '100ml',
      prompt: '对比更强',
      negativePrompt: 'no fake english',
      variantIndex: 1,
      variantTotal: 3,
    }));

    expect(restored?.subTab).toBe('hitMain');
    expect(restored?.hitMain).toMatchObject({
      aspectRatio: '1:1',
      count: 3,
      brand: 'wkau',
      productName: 'WHITE RADIATOR REPAIR',
      capacity: '100ml',
      prompt: '对比更强',
      negativePrompt: 'no fake english',
    });
    expect(restored?.hitMain.skuBatch?.images[0]?.filePath).toBe('C:/sku/new.png');
    expect(restored?.hitMain.referenceBatch?.images[0]?.filePath).toBe('C:/refs/hit-main.png');
    expect(restored?.replica.skuBatch).toBeNull();
    expect(restored?.replica.aspectRatio).toBe('auto');
  });

  it('keeps empty hit-main defaults when restoring replica', () => {
    const restored = applySkuImageGenRestore(createTask({
      feature: 'sku_replica',
      images: [
        { role: 'source', path: 'C:/sku/a.png' },
        { role: 'reference', path: 'C:/refs/label.png' },
      ],
    }));

    expect(restored?.subTab).toBe('replica');
    expect(restored?.hitMain.aspectRatio).toBe('1:1');
    expect(restored?.hitMain.count).toBe(3);
    expect(restored?.hitMain.skuBatch).toBeNull();
  });
});
```

If `TaskRecord` field names in this repo differ, copy the helper from `src/features/product-image-set/__tests__/applyProductImageSetRestore.test.ts` and keep the same shape. Image path on restored batches is `filePath` via `createImportBatch`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/sku-image-gen/__tests__/applySkuImageGenRestore.test.ts`

Expected: FAIL because `SkuImageGenRestoreState` has no `hitMain`.

- [ ] **Step 3: Implement restore**

In `src/features/sku-image-gen/applySkuImageGenRestore.ts`:

1. Import `DEFAULT_SKU_HIT_MAIN_COUNT`.
2. Extend the restore state:

```ts
export interface SkuImageGenRestoreState {
  subTab: SkuSubTab;
  replica: SkuTabState;
  variation: SkuTabState;
  original: SkuTabState;
  hitMain: SkuTabState;
}
```

3. Change `emptyTabState` to accept aspect ratio:

```ts
function emptyTabState(
  defaultCount: number,
  aspectRatio: ImageAspectRatioValue = 'auto',
): SkuTabState {
  return {
    skuBatch: null,
    referenceBatch: null,
    aspectRatio,
    count: defaultCount,
    brand: '',
    productName: '',
    capacity: '',
    prompt: '',
    negativePrompt: '',
  };
}
```

4. In `applySkuImageGenRestore`, include hit-main in `base` and add the case:

```ts
const base = {
  replica: emptyTabState(DEFAULT_SKU_REPLICA_COUNT),
  variation: emptyTabState(DEFAULT_SKU_VARIATION_COUNT),
  original: emptyTabState(DEFAULT_SKU_ORIGINAL_COUNT),
  hitMain: emptyTabState(DEFAULT_SKU_HIT_MAIN_COUNT, '1:1'),
};

// inside switch:
case 'sku_hit_main_image':
  return {
    ...base,
    subTab: 'hitMain',
    hitMain: tabStateFromRequest(request, DEFAULT_SKU_HIT_MAIN_COUNT, 'sku_hit_main_image'),
  };
```

Keep replica/variation/original cases spreading `...base` so they also get empty `hitMain`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/sku-image-gen/__tests__/applySkuImageGenRestore.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/sku-image-gen/applySkuImageGenRestore.ts src/features/sku-image-gen/__tests__/applySkuImageGenRestore.test.ts
git commit -m "feat: restore sku hit main image tab state"
```

---

### Task 5: SKU page UI

**Files:**
- Modify: `src/components/SkuGen.tsx`
- Modify: `src/components/SkuParameterFields.tsx`
- Modify: `src/components/SkuNegativePromptField.tsx`
- Create: `src/components/__tests__/SkuGen.test.tsx`

**Interfaces:**
- Consumes: `SkuSubTab` including `'hitMain'`; `buildSkuImageGenRequests`; `applySkuImageGenRestore`; `DEFAULT_SKU_HIT_MAIN_COUNT`
- Produces: fourth tab labeled 「爆款主图」; hit-main reference uploader labeled 「爆款主图参考」 and required; default ratio `1:1` and count `3`

- [ ] **Step 1: Write the failing UI tests**

Create `src/components/__tests__/SkuGen.test.tsx`. Follow the mock style in `src/components/__tests__/StickerGen.test.tsx` (mock `useImageTask`, `useOpenOutputDirectory`, `useDesktopClient`, `useAppLogs`). Then:

```ts
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SkuGen from '../SkuGen';

const submitMany = vi.fn();

vi.mock('../../hooks/useImageTask', () => ({
  useImageTask: () => ({
    submitMany,
    bindTask: vi.fn(() => Promise.resolve(null)),
    restoreTask: vi.fn(),
    getTask: vi.fn(() => null),
    getTasks: vi.fn(() => []),
    getError: vi.fn(() => null),
    isSubmitting: false,
    reset: vi.fn(),
  }),
}));

vi.mock('../../hooks/useOpenOutputDirectory', () => ({
  useOpenOutputDirectory: () => ({ openActiveTaskDirectory: vi.fn() }),
}));

vi.mock('../../hooks/useDesktopClient', () => ({
  useDesktopClient: () => null,
}));

vi.mock('../../hooks/useAppLogs', () => ({
  useAppLogs: () => ({ logs: [], isLoading: false }),
}));

afterEach(() => {
  cleanup();
  submitMany.mockReset();
});

describe('SkuGen hit main tab', () => {
  it('renders the fourth tab and required hit-main reference uploader', () => {
    render(<SkuGen />);

    fireEvent.click(screen.getByRole('button', { name: '爆款主图' }));

    expect(screen.getByText('爆款主图参考')).toBeTruthy();
    expect(screen.getByText('上传一张爆款电商主图作卖点与场景参考')).toBeTruthy();
    expect(screen.queryByText('可选')).toBeNull();
  });

  it('alerts when generating hit-main without the reference image', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    render(<SkuGen />);

    fireEvent.click(screen.getByRole('button', { name: '爆款主图' }));
    fireEvent.click(document.getElementById('submit-sku-hitMain')!);

    expect(alertSpy).toHaveBeenCalledWith('请上传 SKU 图');
    expect(submitMany).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
```

If `useOpenOutputDirectory` / `useDesktopClient` / `useAppLogs` export different names in this repo, copy the exact mocks from `StickerGen.test.tsx`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/__tests__/SkuGen.test.tsx`

Expected: FAIL because there is no 「爆款主图」 tab.

- [ ] **Step 3: Implement the UI**

In `src/components/SkuParameterFields.tsx` and `src/components/SkuNegativePromptField.tsx`, change `prefix` type from `'replica' | 'variation' | 'original'` to `SkuSubTab` imported from `../shared/view/ui`.

In `src/components/SkuGen.tsx`:

1. Import `DEFAULT_SKU_HIT_MAIN_COUNT`.
2. Extend `TAB_LABELS`:

```ts
const TAB_LABELS: Record<SkuSubTab, string> = {
  replica: '复刻',
  variation: '裂变',
  original: '原创',
  hitMain: '爆款主图',
};
```

3. Extend `DEFAULT_COUNT_BY_SUBTAB`:

```ts
hitMain: DEFAULT_SKU_HIT_MAIN_COUNT,
```

4. In `defaultTabState`:

```ts
aspectRatio: subTab === 'hitMain' ? '1:1' : DEFAULT_IMAGE_ASPECT_RATIO,
```

5. Initialize `tabStates` with `hitMain: defaultTabState('hitMain')`.

6. In restore effect, also assign `hitMain: restored.hitMain`.

7. In `renderParameterPanels`:

```ts
const referenceRequired = subTab === 'replica' || subTab === 'hitMain';
const referenceLabel = subTab === 'hitMain' ? '爆款主图参考' : '参考图';
const referencePlaceholder = subTab === 'hitMain'
  ? '上传一张爆款电商主图作卖点与场景参考'
  : '上传包装设计参考图，可多张';
const promptPlaceholder = subTab === 'replica'
  ? '例如：品牌改为 wkau，容量 45ml，排版更协调'
  : subTab === 'variation'
    ? '例如：差异化再大一点，不要太像参考图'
    : subTab === 'hitMain'
      ? '例如：标题改成 WHITE RADIATOR REPAIR，对比更强，产品再大一点'
      : '例如：墙面修补膏，自由发挥，适合贴瓶的高级感';
```

Pass `label={referenceLabel}`, `placeholder={referencePlaceholder}`, `optional={!referenceRequired}` to the second `ImageUploader`. Keep upload order: SKU first, reference second.

`productNameRequired` stays `subTab === 'original'` (not hitMain).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/__tests__/SkuGen.test.tsx src/features/sku-image-gen/__tests__/applySkuImageGenRestore.test.ts src/features/sku-image-gen/__tests__/skuImageGenRequests.test.ts src/shared/domain/__tests__/imageFeatureApi.test.ts`

Expected: PASS

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm lint`

Expected: PASS (`tsc --noEmit`). If `SkuSubTab` exhaustive `Record`s elsewhere fail, add `hitMain` there too — do not widen with optional keys.

```bash
git add src/components/SkuGen.tsx src/components/SkuParameterFields.tsx src/components/SkuNegativePromptField.tsx src/components/__tests__/SkuGen.test.tsx
git commit -m "feat: add sku hit main image workspace tab"
```

---

## Spec coverage

| Spec section | Task |
|---|---|
| 2.1/4 Feature `sku_hit_main_image`, roles, edit | Task 1 |
| 4 exact 1+1 validation, reject product-set controls | Task 1 |
| 4 labels + route `hitMain` | Task 1 |
| 5.1 fourth tab, default 1:1 / count 3 | Task 1 + Task 5 |
| 5.2 SKU then reference, hit-main copy, 0/2 reference errors | Task 2 + Task 5 |
| 5.3 shared SKU controls, product name not required | Task 5 |
| 5.4 restore | Task 4 |
| 6 independent prompt, role-based 图1/图2, copy override | Task 3 |
| 6 `isSkuFeature` excludes this feature | Task 3 |
| 7 request split `count: 1` + variants | Task 2 |
| 8 UI alerts | Task 2 + Task 5 |
| 9 tests | Tasks 1–5 |
| 10 do not change sticker/product/product-set features | all tasks |

## Placeholder scan

No TBD / “similar to Task N” / “add tests later”. Prompt builder, validation messages, labels, and UI copy are written out.

## Type consistency

- Feature ID: `sku_hit_main_image`
- Sub tab: `hitMain`
- Functions: `isSkuHitMainImageFeature`, `buildSkuHitMainImagePrompt`
- Restore field: `hitMain: SkuTabState`
- Errors: `请上传爆款主图参考` / `爆款主图参考只能上传 1 张`
- Image fields: `path` on requests, `filePath` on import batches
- Variant fields: `variantIndex` / `variantTotal`
