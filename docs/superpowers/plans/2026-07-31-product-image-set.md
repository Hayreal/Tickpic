# Product Image Set Implementation Plan

> **Superseded implementation plan:** This is the initial implementation plan. The current control, comparison-layout, multi-scene prompt, UI-state, restore, and acceptance contract is updated by `2026-07-31-product-image-set-controls-enhancement.md` and `2026-07-31-product-image-set-controls-enhancement-design.md`. Historical snippets below are not current implementation targets unless explicitly reconciled with those follow-up documents.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the initial 套图处理 workspace. Current behavior is superseded by the controls enhancement: comparison outputs one scene and one Before/After pair with auto/horizontal/vertical layout; multi-scene prompt is optional and supports single/collage/grid modes.

**Architecture:** Add three independent `ImageFeature` contracts, then keep request construction and task restoration in focused `src/features/product-image-set/` modules. A new `ProductImageSet` React page reuses the existing workspace, upload, ratio, count, task status, and result components; `App` and `featureRoutes` only select and restore the page.

**Tech Stack:** React 19, TypeScript 5.8, Electron 37, Tailwind CSS 4, Vitest, Testing Library

---

## File Map

**Create:**

- `src/features/product-image-set/productImageSetRequests.ts`: validate form input and build one `count: 1` request per requested image.
- `src/features/product-image-set/applyProductImageSetRestore.ts`: convert a persisted task into the new page's form state.
- `src/features/product-image-set/__tests__/productImageSetRequests.test.ts`: request count, image roles, prompt, and variant metadata tests.
- `src/features/product-image-set/__tests__/applyProductImageSetRestore.test.ts`: route-specific restoration and fallback tests.
- `src/components/ProductImageSet.tsx`: the three-tab page and existing task/result UI integration.
- `src/components/__tests__/ProductImageSet.test.tsx`: form validation, tab state, request submission, and restoration tests.

**Modify:**

- `src/shared/domain/imageFeatureApi.ts`: add features, `variantIndex`/`variantTotal`, definitions, and validation.
- `src/shared/domain/__tests__/imageFeatureApi.test.ts`: lock feature roles, prompts, and variant validation.
- `src/shared/domain/imageFeatureLabels.ts`: task list labels for the three new features.
- `src/shared/view/ui.ts`: add the page and sub-tab types.
- `src/shared/view/featureRoutes.ts`: restore route mapping.
- `src/shared/domain/images.ts`: allow the uploader batch to identify `productSet` as its page.
- `electron/main/services/image-tasks/instructionPrompt.ts`: append variant guidance to the final prompt.
- `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`: verify variant and feature prompt assembly.
- `src/components/Sidebar.tsx`: add 套图处理 navigation.
- `src/components/__tests__/Sidebar.test.tsx`: assert navigation label and callback.
- `src/App.tsx`: mount the page and route restored tasks to it.
- `src/__tests__/App.test.tsx`: verify navigation and restore routing.
- `README.md`: document the new workspace.
- `docs/ai-image-system-prompts.md`: document the new feature prompts and variant metadata.

Do not add a generic schema library, global form store, or reusable abstraction around all existing image pages. The page is new, while the task engine and shared UI already provide the required reusable boundaries.

### Task 1: Add Feature Contracts and Routing

**Files:**

- Modify: `src/shared/domain/imageFeatureApi.ts`
- Modify: `src/shared/domain/imageFeatureLabels.ts`
- Modify: `src/shared/view/ui.ts`
- Modify: `src/shared/view/featureRoutes.ts`
- Modify: `src/shared/domain/images.ts`
- Test: `src/shared/domain/__tests__/imageFeatureApi.test.ts`
- Test: `src/shared/view/__tests__/featureRoutes.test.ts`

- [ ] **Step 1: Write failing domain tests for the three feature definitions**

Append tests that assert all SKU images reach the edit model and the prompt contracts contain their distinguishing rules:

```ts
it.each([
  ['product_main_image', ['英文大标题', '核心使用场景']],
   ['product_comparison_image', ['一个场景', 'BEFORE', 'AFTER']],
   ['product_multi_scene', ['单场景', '拼图', '宫格']],
] as const)('defines %s as a product-image edit feature', (feature, promptFragments) => {
  const definition = getImageFeatureDefinition(feature);

  expect(definition.executionModel).toBe('edit');
  expect(definition.requiredImageRoles).toEqual(['product']);
  for (const fragment of promptFragments) {
    expect(definition.mainPrompt).toContain(fragment);
  }

  expect(getExecutionImageRoles({
    feature,
    images: [
      { role: 'product', path: '/sku/front.png' },
      { role: 'product', path: '/sku/side.png' },
    ],
  })).toEqual(['product']);
});
```

- [ ] **Step 2: Write failing validation tests for variant metadata**

```ts
it('validates image-set variant metadata as a complete positive range', () => {
  const base = {
    feature: 'product_main_image' as const,
    images: [{ role: 'product' as const, path: '/sku/front.png' }],
  };

  expect(() => validateImageTaskRequest({ ...base, variantIndex: 1 }))
    .toThrow('variantIndex and variantTotal must be provided together');
  expect(() => validateImageTaskRequest({ ...base, variantIndex: 0, variantTotal: 2 }))
    .toThrow('variantIndex must be a positive integer');
  expect(() => validateImageTaskRequest({ ...base, variantIndex: 3, variantTotal: 2 }))
    .toThrow('variantIndex must be less than or equal to variantTotal');
  expect(validateImageTaskRequest({ ...base, variantIndex: 2, variantTotal: 2 }))
    .toMatchObject({ variantIndex: 2, variantTotal: 2 });
});
```

- [ ] **Step 3: Add a focused route test file and verify it fails**

Create `src/shared/view/__tests__/featureRoutes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getFeatureRoute } from '../featureRoutes';

describe('product image set routes', () => {
  it.each([
    ['product_main_image', 'main'],
    ['product_comparison_image', 'comparison'],
    ['product_multi_scene', 'multiScene'],
  ] as const)('routes %s to %s', (feature, productSetSubTab) => {
    expect(getFeatureRoute(feature)).toEqual({ tab: 'productSet', productSetSubTab });
  });
});
```

Run: `pnpm test -- src/shared/domain/__tests__/imageFeatureApi.test.ts src/shared/view/__tests__/featureRoutes.test.ts`

Expected: FAIL because the new feature literals, definitions, fields, and routes do not exist.

- [ ] **Step 4: Implement the feature and view types**

Add these feature IDs to `IMAGE_FEATURES`:

```ts
'product_main_image',
'product_comparison_image',
'product_multi_scene',
```

Add request fields:

```ts
variantIndex?: number;
variantTotal?: number;
```

Add definitions with exact product identity, output, and text constraints. Use these prompt bodies as the minimum contract:

```ts
product_main_image: {
  feature: 'product_main_image',
  mainPrompt: '基于全部 SKU 产品参考图生成一张跨境电商主图。输出中必须展示对应产品、AI 自动生成的一条清晰英文大标题，以及一个表达核心用途或核心卖点的明确核心使用场景。产品是主视觉；严格保持产品形状、包装、品牌、标签、颜色和关键文字，不得重新设计 SKU。标题必须清晰可读且只使用英文；场景元素服务于卖点，不堆叠无关装饰。',
  acceptedImageRoles: ['product'],
  requiredImageRoles: ['product'],
  executionModel: 'edit',
  executionImageRoles: ['product'],
  defaultShowProduct: true,
},
product_comparison_image: {
  feature: 'product_comparison_image',
   mainPrompt: '每张只包含一个场景的一组 Before/After；布局由 auto/horizontal/vertical 结构化选项控制。Before 不展示 SKU；After 产品展示由结构化选项控制。',
  acceptedImageRoles: ['product'],
  requiredImageRoles: ['product'],
  executionModel: 'edit',
  executionImageRoles: ['product'],
  defaultShowProduct: true,
},
product_multi_scene: {
  feature: 'product_multi_scene',
   mainPrompt: '用户提示词可选，画面模式由 single/collage/grid 结构化选项控制。SKU 可以不出现；若出现，严格保持产品形状、包装、品牌、标签、颜色和关键文字。默认不添加标题、卖点或营销文字，除非用户明确要求。',
  acceptedImageRoles: ['product'],
  requiredImageRoles: ['product'],
  executionModel: 'edit',
  executionImageRoles: ['product'],
  defaultShowProduct: false,
},
```

Validate the variant pair after count validation:

```ts
const hasVariantIndex = input.variantIndex !== undefined;
const hasVariantTotal = input.variantTotal !== undefined;
if (hasVariantIndex !== hasVariantTotal) {
  throw new Error('variantIndex and variantTotal must be provided together');
}
if (hasVariantIndex && (!Number.isInteger(input.variantIndex) || input.variantIndex! <= 0)) {
  throw new Error('variantIndex must be a positive integer');
}
if (hasVariantTotal && (!Number.isInteger(input.variantTotal) || input.variantTotal! <= 0)) {
  throw new Error('variantTotal must be a positive integer');
}
if (hasVariantIndex && hasVariantTotal && input.variantIndex! > input.variantTotal!) {
  throw new Error('variantIndex must be less than or equal to variantTotal');
}
```

Extend view types and route metadata:

```ts
export type ActiveTab = 'sticker' | 'product' | 'productSet' | 'settings' | 'profile';
export type ProductSetSubTab = 'main' | 'comparison' | 'multiScene';

export interface FeatureRoute {
  // existing fields remain
  productSetSubTab?: ProductSetSubTab;
}
```

Add labels with category `套图` and feature labels `主图`, `对比图`, and `多场景图`. Extend `ImportBatch['page']` to `'sticker' | 'product' | 'productSet'` so the uploader records the actual workspace.

- [ ] **Step 5: Run the focused tests**

Run: `pnpm test -- src/shared/domain/__tests__/imageFeatureApi.test.ts src/shared/view/__tests__/featureRoutes.test.ts`

Expected: PASS.

- [ ] **Step 6: Review the diff and optionally commit**

Run: `git diff --check` and `git diff -- src/shared/domain src/shared/view`

If the user has explicitly authorized commits, run:

```bash
git add src/shared/domain/imageFeatureApi.ts src/shared/domain/imageFeatureLabels.ts src/shared/domain/images.ts src/shared/domain/__tests__/imageFeatureApi.test.ts src/shared/view/ui.ts src/shared/view/featureRoutes.ts src/shared/view/__tests__/featureRoutes.test.ts
```

### Task 2: Add Deterministic Request Construction

**Files:**

- Create: `src/features/product-image-set/productImageSetRequests.ts`
- Create: `src/features/product-image-set/__tests__/productImageSetRequests.test.ts`

- [ ] **Step 1: Write failing tests for N requests and SKU multi-image roles**

```ts
import { describe, expect, it } from 'vitest';
import { buildProductImageSetRequests } from '../productImageSetRequests';

const skuPaths = ['C:/sku/front.png', 'C:/sku/side.png'];

describe('buildProductImageSetRequests', () => {
  it('builds one main-image request per selected output', () => {
    const requests = buildProductImageSetRequests({
      subTab: 'main', skuPaths, aspectRatio: '4:5', count: 2, scenePrompt: '',
    });

    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      feature: 'product_main_image', count: 1, aspectRatio: '4:5',
      variantIndex: 1, variantTotal: 2,
      images: [
        { role: 'product', path: 'C:/sku/front.png' },
        { role: 'product', path: 'C:/sku/side.png' },
      ],
    });
    expect(requests[1]).toMatchObject({ variantIndex: 2, variantTotal: 2 });
  });

  it('allows an empty prompt for multi-scene output', () => {
    expect(buildProductImageSetRequests({
      subTab: 'multiScene', skuPaths, aspectRatio: '1:1', count: 1, prompt: '',
    })[0]).not.toHaveProperty('prompt');
    expect(buildProductImageSetRequests({
      subTab: 'multiScene', skuPaths, aspectRatio: '1:1', count: 1,
      prompt: ' modern kitchens and laundry rooms ',
    })[0]).toMatchObject({
      feature: 'product_multi_scene',
      prompt: 'modern kitchens and laundry rooms',
    });
  });

  it('requires at least one SKU image', () => {
    expect(() => buildProductImageSetRequests({
      subTab: 'comparison', skuPaths: [], aspectRatio: '1:1', count: 1, scenePrompt: '',
    })).toThrow('请上传 SKU 产品图');
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `pnpm test -- src/features/product-image-set/__tests__/productImageSetRequests.test.ts`

Expected: FAIL because `productImageSetRequests.ts` does not exist.

- [ ] **Step 3: Implement the pure builder**

```ts
import type { ImageTaskRequest, ImageFeature } from '../../shared/domain/imageFeatureApi';
import type { ImageAspectRatioValue } from '../../shared/view/imageAspectRatioOptions';
import type { ProductSetSubTab } from '../../shared/view/ui';

const FEATURE_MAP: Record<ProductSetSubTab, ImageFeature> = {
  main: 'product_main_image',
  comparison: 'product_comparison_image',
  multiScene: 'product_multi_scene',
};

interface ProductImageSetRequestInput {
  subTab: ProductSetSubTab;
  skuPaths: string[];
  aspectRatio: ImageAspectRatioValue;
  count: number;
  prompt: string;
}

export function buildProductImageSetRequests(input: ProductImageSetRequestInput): ImageTaskRequest[] {
  if (input.skuPaths.length === 0) throw new Error('请上传 SKU 产品图');
  const prompt = input.prompt.trim();

  return Array.from({ length: input.count }, (_, index) => ({
    feature: FEATURE_MAP[input.subTab],
    images: input.skuPaths.map((path) => ({ role: 'product' as const, path })),
    count: 1,
    aspectRatio: input.aspectRatio,
    variantIndex: index + 1,
    variantTotal: input.count,
    ...(prompt ? { prompt } : {}),
  }));
}
```

- [ ] **Step 4: Run the focused test**

Run: `pnpm test -- src/features/product-image-set/__tests__/productImageSetRequests.test.ts`

Expected: PASS.

- [ ] **Step 5: Review and optionally commit**

Run: `git diff --check`

If commit authorization exists:

```bash
git add src/features/product-image-set/productImageSetRequests.ts src/features/product-image-set/__tests__/productImageSetRequests.test.ts
```

### Task 3: Add Variant Prompt Guidance

**Files:**

- Modify: `electron/main/services/image-tasks/instructionPrompt.ts`
- Test: `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`

- [ ] **Step 1: Write the failing prompt test**

```ts
it('adds image-set variant position to the execution prompt', () => {
  const text = buildExecutionPrompt({
    feature: 'product_multi_scene',
    images: [{ role: 'product', path: '/tmp/sku.png' }],
    prompt: 'kitchen and laundry use',
    variantIndex: 2,
    variantTotal: 4,
  }, getImageFeatureDefinition('product_multi_scene').mainPrompt);

  expect(text).toContain('补充要求：kitchen and laundry use');
  expect(text).toContain('本批次第 2/4 张');
  expect(text).toContain('明显不同的场景或构图');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm test -- electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`

Expected: FAIL because no variant line is emitted.

- [ ] **Step 3: Append the validated variant line**

In `buildStructuredParameterLines()` append:

```ts
if (request.variantIndex !== undefined && request.variantTotal !== undefined) {
  lines.push(
    `这是本批次第 ${request.variantIndex}/${request.variantTotal} 张。生成与同批其他图片明显不同的场景或构图，同时遵守当前功能的全部固定规则。`,
  );
}
```

Also add the three new Feature IDs to `EDIT_VERB_REPLACEMENTS` so any future English generated instruction starts with an edit verb:

```ts
product_main_image: 'Edit the SKU reference images to produce',
product_comparison_image: 'Edit the SKU reference images to produce',
product_multi_scene: 'Edit the SKU reference images to produce',
```

- [ ] **Step 4: Run prompt and domain tests**

Run: `pnpm test -- electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts src/shared/domain/__tests__/imageFeatureApi.test.ts`

Expected: PASS.

- [ ] **Step 5: Review and optionally commit**

Run: `git diff --check`

If commit authorization exists:

```bash
git add electron/main/services/image-tasks/instructionPrompt.ts electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts
```

### Task 4: Restore Product Image Set Form State

**Files:**

- Create: `src/features/product-image-set/applyProductImageSetRestore.ts`
- Create: `src/features/product-image-set/__tests__/applyProductImageSetRestore.test.ts`

- [ ] **Step 1: Write failing restoration tests**

Build a minimal `TaskRecord` factory in the test and assert all product images are retained:

```ts
it('restores a multi-scene task including every SKU image', () => {
  const restored = applyProductImageSetRestore(createTask({
    feature: 'product_multi_scene',
    images: [
      { role: 'product', path: 'C:/sku/front.png' },
      { role: 'product', path: 'C:/sku/side.png' },
    ],
    prompt: 'bathroom and travel scenes',
    aspectRatio: '4:5',
    count: 1,
    variantIndex: 2,
    variantTotal: 2,
  }));

  expect(restored).toMatchObject({
    subTab: 'multiScene',
    scenePrompt: 'bathroom and travel scenes',
    aspectRatio: '4:5',
    count: 2,
  });
  expect(restored?.skuBatch?.images.map((image) => image.filePath))
    .toEqual(['C:/sku/front.png', 'C:/sku/side.png']);
});

it('falls back to auto ratio and count one for old-shaped tasks', () => {
  const restored = applyProductImageSetRestore(createTask({
    feature: 'product_main_image',
    images: [{ role: 'product', path: 'C:/sku/front.png' }],
  }));
  expect(restored).toMatchObject({ subTab: 'main', aspectRatio: 'auto', count: 1 });
});
```

- [ ] **Step 2: Run and verify the missing module failure**

Run: `pnpm test -- src/features/product-image-set/__tests__/applyProductImageSetRestore.test.ts`

Expected: FAIL because the restore module does not exist.

- [ ] **Step 3: Implement restoration without changing global helpers**

Export this shape:

```ts
export interface ProductImageSetRestoreState {
  subTab: ProductSetSubTab;
  skuBatch: ImportBatch | null;
  scenePrompt: string;
  aspectRatio: ImageAspectRatioValue;
  count: number;
}
```

Use `getFeatureRoute(request.feature).productSetSubTab`; return `null` for non-product-set routes. Convert every `request.images` entry whose role is `product` to `StoredImageRecord`, then call `createImportBatch(images, 'productSet', request.feature)`. Set count with `resolveImageCount(request.variantTotal ?? request.count ?? 1)` so persisted values outside the current selector safely fall back to the existing default.

- [ ] **Step 4: Run the restore tests**

Run: `pnpm test -- src/features/product-image-set/__tests__/applyProductImageSetRestore.test.ts`

Expected: PASS.

- [ ] **Step 5: Review and optionally commit**

Run: `git diff --check`

If commit authorization exists:

```bash
git add src/features/product-image-set/applyProductImageSetRestore.ts src/features/product-image-set/__tests__/applyProductImageSetRestore.test.ts
```

### Task 5: Build the Product Image Set Page

**Files:**

- Create: `src/components/ProductImageSet.tsx`
- Create: `src/components/__tests__/ProductImageSet.test.tsx`

- [ ] **Step 1: Create page test mocks and a failing render test**

Mock `useImageTask`, `useDesktopClient`, `useAppLogs`, `useOpenOutputDirectory`, and `ImageUploader`. The uploader mock should expose a button that calls `onBatchChange()` with two stored SKU images, avoiding browser file APIs in this page-level test.

```tsx
it('renders three tabs and shared controls', () => {
  render(<ProductImageSet />);
  expect(document.getElementById('product-set-subtab-main')).toHaveTextContent('主图');
  expect(document.getElementById('product-set-subtab-comparison')).toHaveTextContent('对比图');
  expect(document.getElementById('product-set-subtab-multi-scene')).toHaveTextContent('多场景图');
  expect(screen.getByText('SKU 产品图')).toBeInTheDocument();
  expect(screen.getByText('图片比例')).toBeInTheDocument();
  expect(screen.getByText('生成数量')).toBeInTheDocument();
  expect(screen.queryByLabelText(/场景提示词/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Add failing interaction tests**

```tsx
it('submits two complete comparison requests', async () => {
  render(<ProductImageSet />);
  fireEvent.click(screen.getByRole('button', { name: 'mock upload sku' }));
  fireEvent.click(document.getElementById('product-set-subtab-comparison')!);
  // Open the existing count selector and choose 2 张.
  fireEvent.click(document.getElementById('product-set-comparison-count')!);
  fireEvent.click(screen.getByRole('option', { name: '2 张' }));
  fireEvent.click(document.getElementById('submit-product-set-comparison')!);

  await waitFor(() => expect(submitMany).toHaveBeenCalledTimes(1));
  expect(submitMany.mock.calls[0][0]).toEqual([
    expect.objectContaining({ feature: 'product_comparison_image', count: 1, variantIndex: 1, variantTotal: 2 }),
    expect.objectContaining({ feature: 'product_comparison_image', count: 1, variantIndex: 2, variantTotal: 2 }),
  ]);
});

  it('allows an empty multi-scene prompt and submits a supplied trimmed value', async () => {
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  render(<ProductImageSet />);
  fireEvent.click(screen.getByRole('button', { name: 'mock upload sku' }));
  fireEvent.click(document.getElementById('product-set-subtab-multi-scene')!);
  fireEvent.click(document.getElementById('submit-product-set-multiScene')!);
   fireEvent.change(screen.getByLabelText('提示词'), { target: { value: ' modern kitchen ' } });
  fireEvent.click(document.getElementById('submit-product-set-multiScene')!);
  await waitFor(() => expect(submitMany).toHaveBeenCalled());
  expect(submitMany.mock.calls.at(-1)?.[0][0]).toMatchObject({
    feature: 'product_multi_scene', prompt: 'modern kitchen',
  });
});
```

Add a restore test that passes a `product_multi_scene` `TaskRecord`, then verifies the multi-scene tab is active, the prompt value is restored, and the count selector announces `2 张`.

- [ ] **Step 3: Run and verify the page is missing**

Run: `pnpm test -- src/components/__tests__/ProductImageSet.test.tsx`

Expected: FAIL because `ProductImageSet.tsx` does not exist.

- [ ] **Step 4: Implement page state and submission**

Implement `ProductImageSet` with this public API:

```ts
interface ProductImageSetProps {
  restoredTask?: TaskRecord | null;
  onRestoreConsumed?: () => void;
}
```

Maintain a small state object per sub-tab rather than sharing values across modes:

```ts
interface TabState {
  skuBatch: ImportBatch | null;
  aspectRatio: ImageAspectRatioValue;
  count: number;
  scenePrompt: string;
}
```

Use the existing default ratio and count. On submit:

```ts
try {
  const requests = buildProductImageSetRequests({
    subTab,
    skuPaths: activeState.skuBatch?.images.map((image) => image.filePath) ?? [],
    aspectRatio: activeState.aspectRatio,
    count: activeState.count,
    scenePrompt: activeState.scenePrompt,
  });
  reset(FEATURE_MAP[subTab]);
  await submitMany(requests);
  setIsTaskDrawerOpen(true);
} catch (error) {
  alert(error instanceof Error ? error.message : '提交失败');
}
```

Use IDs exactly as tested:

```text
product-set-subtab-main
product-set-subtab-comparison
product-set-subtab-multi-scene
product-set-main-aspect-ratio
product-set-main-count
product-set-comparison-aspect-ratio
product-set-comparison-count
product-set-multiScene-aspect-ratio
product-set-multiScene-count
product-set-scene-prompt
submit-product-set-main
submit-product-set-comparison
submit-product-set-multiScene
```

Render one `FeatureParameterPanels` tree at a time. All tabs render `ImageUploader` with `page="productSet"`, the active Feature ID, and label `SKU 产品图`. The controls enhancement supersedes the initial “only multi-scene advanced prompt” design: all tabs render optional prompt and negative-prompt fields plus their applicable controls.

Copy the established task/result composition from `ProductProcessing`: derive active tasks, expected count from `activeState.count`, progress, logs, result items, open-directory behavior, copy-image behavior, and drawer contents using existing helpers and components. Do not copy any product-processing-only region or model state.

In the restore effect, call `applyProductImageSetRestore()`, update only the restored sub-tab state, restore/bind the image task using `imageTaskRecordFromTaskRecord()`, and call `onRestoreConsumed?.()`.

- [ ] **Step 5: Run page and shared component tests**

Run: `pnpm test -- src/components/__tests__/ProductImageSet.test.tsx src/components/__tests__/ImageCountSelector.test.tsx src/components/__tests__/AspectRatioSelect.test.tsx`

Expected: PASS.

- [ ] **Step 6: Review and optionally commit**

Run: `git diff --check`

If commit authorization exists:

```bash
git add src/components/ProductImageSet.tsx src/components/__tests__/ProductImageSet.test.tsx
```

### Task 6: Integrate Navigation and Task Restore Routing

**Files:**

- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/__tests__/Sidebar.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/__tests__/App.test.tsx`

- [ ] **Step 1: Write the failing sidebar interaction test**

Render with an `onTabChange` spy and add:

```tsx
it('opens the product image set workspace', () => {
  const onTabChange = vi.fn();
  render(
    <AppearanceProvider>
      <Sidebar activeTab="sticker" onTabChange={onTabChange} />
    </AppearanceProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /套图处理/ }));
  expect(onTabChange).toHaveBeenCalledWith('productSet');
});
```

- [ ] **Step 2: Extend App mocks and write failing shell tests**

Mock the new component:

```tsx
vi.mock('../components/ProductImageSet', () => ({
  default: ({ restoredTask }: { restoredTask?: { taskId: string } | null }) => (
    <div data-testid="product-image-set">{restoredTask?.taskId ?? 'empty'}</div>
  ),
}));
```

Add navigation and restore assertions:

```tsx
it('opens the product image set from the sidebar', () => {
  render(<App />);
  fireEvent.click(document.getElementById('sidebar-tab-productSet')!);
  expect(screen.getByTestId('product-image-set')).toBeVisible();
});
```

For restoration, set `currentTasks` to a `TaskRecord` whose request feature is `product_multi_scene`, open profile, invoke the profile mock's `onRestoreTask`, and expect `product-image-set` to contain that task ID. Update the existing profile mock to retain and expose `onRestoreTask` rather than discarding it.

- [ ] **Step 3: Run and verify failures**

Run: `pnpm test -- src/components/__tests__/Sidebar.test.tsx src/__tests__/App.test.tsx`

Expected: FAIL because the navigation item and page mount do not exist.

- [ ] **Step 4: Implement navigation and App mounting**

Import a suitable Lucide icon such as `Images` and insert after Product Processing:

```tsx
{ id: 'productSet', label: '套图处理', icon: <Images className="h-4 w-4" /> },
```

Import and mount `ProductImageSet` in `App.tsx` using the same always-mounted/hidden pattern as image-generation pages so tab-local form state survives navigation:

```tsx
<div className={activeTab === 'productSet' ? 'flex flex-1 overflow-hidden' : 'hidden'}>
  <ProductImageSet
    restoredTask={
      restoredTask?.request?.feature
      && getFeatureRoute(restoredTask.request.feature).tab === 'productSet'
        ? restoredTask
        : null
    }
    onRestoreConsumed={handleRestoreConsumed}
  />
</div>
```

- [ ] **Step 5: Run shell tests**

Run: `pnpm test -- src/components/__tests__/Sidebar.test.tsx src/__tests__/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Review and optionally commit**

Run: `git diff --check`

If commit authorization exists:

```bash
git add src/components/Sidebar.tsx src/components/__tests__/Sidebar.test.tsx src/App.tsx src/__tests__/App.test.tsx
```

### Task 7: Update Documentation and Run Full Verification

**Files:**

- Modify: `README.md`
- Modify: `docs/ai-image-system-prompts.md`
- Verify: all files changed by Tasks 1-6

- [ ] **Step 1: Update the README feature overview**

Add a section after 产品处理:

```md
### 套图处理

| 功能 | 说明 |
|------|------|
| 主图 | 根据同一 SKU 的多张参考图生成包含产品、英文大标题和核心场景的电商主图 |
| 对比图 | 每张生成一个场景的一组 Before/After 对比图，布局可自动、左右或上下 |
| 多场景图 | 根据 SKU 生成多张适用图；提示词可选，可选择单场景、拼图或宫格 |
```

- [ ] **Step 2: Update prompt documentation**

Add all three new Feature IDs and their `mainPrompt` summaries to `docs/ai-image-system-prompts.md`. Add `variantIndex` and `variantTotal` to the structured parameter list, noting that they produce a batch-position diversity instruction and are not sent as image size parameters.

- [ ] **Step 3: Run all automated tests**

Run: `pnpm test`

Expected: all Vitest suites pass with zero failed tests.

- [ ] **Step 4: Run TypeScript validation**

Run: `pnpm lint`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 5: Build Renderer and Electron**

Run: `pnpm build`

Expected: Vite production build succeeds.

Run: `pnpm build:electron`

Expected: Electron TypeScript and both preload bundles build successfully.

- [ ] **Step 6: Inspect the final diff**

Run: `git status --short`, `git diff --check`, and `git diff --stat`.

Expected: only the design doc, plan doc, three feature modules/tests, new page/tests, and intended shared/shell/docs files are changed; `git diff --check` has no output.

- [ ] **Step 7: Perform credential-gated smoke checks when available**

With a configured local API key and model, generate one output from each new tab. Verify:

```text
product_main_image: output contains SKU + English headline + core scene
product_comparison_image: one output file contains one Before/After pair using its selected layout
product_multi_scene: requested batch creates distinct single/collage/grid outputs using its selected layout
request.json: contains all product image paths, aspect ratio, variantIndex, variantTotal
image-instruction.txt: contains the correct feature contract and variant line
```

If credentials are unavailable, record the smoke checks as not run; do not report them as passing.

- [ ] **Step 8: Optionally commit the verified implementation**

Only if the user has explicitly authorized commits, inspect `git status`, `git diff`, and `git log --oneline -10`, stage only intended files, then run:

```bash
git add README.md docs/ai-image-system-prompts.md docs/superpowers/specs/2026-07-31-product-image-set-design.md docs/superpowers/plans/2026-07-31-product-image-set.md src electron
```

Do not stage unrelated concurrent changes.
