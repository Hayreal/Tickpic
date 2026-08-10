# Product Comparison Contrast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make comparison images show clearly differentiated Before/After states and place one SKU as a foreground layer across the center divider when product display is enabled.

**Architecture:** Keep the existing request schema, UI controls, task pipeline, and model routing unchanged. Strengthen only the structured comparison prompt lines in `instructionPrompt.ts`, with prompt-level regression tests in the existing test suite.

**Tech Stack:** TypeScript, Electron main process, Vitest

---

## File Structure

- Modify `electron/main/services/image-tasks/instructionPrompt.ts`: define observable comparison-intensity rules and divider-centered product composition rules.
- Modify `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`: lock down intensity, layout, product placement, non-duplication, occlusion, and conflict-priority behavior.
- Reference `docs/superpowers/specs/2026-08-07-product-comparison-contrast-design.md`: approved behavior and acceptance criteria.

### Task 1: Add Failing Prompt Contract Tests

**Files:**
- Test: `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`

- [ ] **Step 1: Replace the comparison intensity expectations with observable state rules**

Update the `maps comparison intensity` table so it expects these exact lines:

```ts
it.each([
  ['light', '轻度对比：Before 与 After 必须存在可辨认但自然克制的小范围状态改善，不能几乎一致。'],
  ['medium', '中度对比：Before 的核心问题区域必须清晰可见，After 必须在同一区域呈现直接、明确且可信的改善，无需仔细观察即可理解变化。'],
  ['heavy', '重度对比：Before 的核心问题必须大面积、显著且一眼可见，After 必须在同一对象、同一区域呈现强烈、明确且可信的改善；不得更换或改变场景、对象、机位、材质或结构，也不得仅靠压暗 Before、提高 After 饱和度或增加效果光制造反差。'],
] as const)('maps comparison intensity %s', (comparisonIntensity, line) => {
  expect(buildExecutionPrompt({ feature: 'product_comparison_image', comparisonIntensity }, 'main')).toContain(line);
});
```

- [ ] **Step 2: Replace the product visibility expectations with foreground composition rules**

Use this table:

```ts
it.each([
  [true, '展示 SKU 时，只展示一个产品实例，并将其作为独立于 Before 和 After 面板的前景商品层；两个面板内部不得重复出现 SKU，产品不得遮挡核心问题区域或 BEFORE、AFTER 标签。选择布局后，产品必须按对应方向跨在分界线中央。'],
  [false, '整张图不展示 SKU，只使用 Before 与 After 的场景状态表达改善效果。'],
] as const)('maps comparison product visibility %s', (showProduct, line) => {
  const text = buildExecutionPrompt({ feature: 'product_comparison_image', showProduct }, 'main');

  expect(text).toContain(line);
});
```

- [ ] **Step 3: Strengthen layout expectations with divider orientation**

Keep the layout table limited to panel order:

```ts
it.each([
  ['auto', '根据比例和构图选择左右或上下布局。'],
  ['horizontal', 'Before 左、After 右。'],
  ['vertical', 'Before 上、After 下。'],
] as const)('maps comparison layout %s', (comparisonLayout, line) => {
  expect(buildExecutionPrompt({ feature: 'product_comparison_image', comparisonLayout }, 'main')).toContain(line);
});
```

- [ ] **Step 4: Add a focused heavy-comparison composition test**

Add this test after the comparison mapping tests:

```ts
it('requires a strong state change and one divider-centered SKU for heavy comparison', () => {
  const text = buildExecutionPrompt({
    feature: 'product_comparison_image',
    comparisonLayout: 'horizontal',
    comparisonIntensity: 'heavy',
    showProduct: true,
  }, 'main');

  expect(text).toContain('Before 的核心问题必须大面积、显著且一眼可见');
  expect(text).toContain('After 必须在同一对象、同一区域呈现强烈、明确且可信的改善');
  expect(text).toContain('不得更换或改变场景、对象、机位、材质或结构');
  expect(text).toContain('不得仅靠压暗 Before、提高 After 饱和度或增加效果光制造反差');
  expect(text).toContain('只展示一个产品实例');
  expect(text).toContain('两个面板内部不得重复出现 SKU');
  expect(text).toContain('产品不得遮挡核心问题区域或 BEFORE、AFTER 标签');
});
```

- [ ] **Step 5: Update exact prompt-order snapshots**

In all exact `toBe(withEnglishOnlyRule(...))` expectations for `product_comparison_image`, replace old layout, intensity, and product visibility strings with the exact new strings from Steps 1-3. Keep ordering unchanged: layout, shared scene/object/camera/scale/material/structure invariant, intensity, product visibility, structured metadata, conflict guard, user fields, variant, English-only rule. Add a regression through `getImageFeatureDefinition('product_comparison_image').mainPrompt` and `buildExecutionPrompt` to verify the composed prompt excludes SKU from both panels, permits exactly one independent foreground SKU when enabled, and retains scale, composition, and lighting invariants.

- [ ] **Step 6: Run the focused tests and verify they fail**

Run:

```bash
pnpm vitest run electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts
```

Expected: FAIL because `instructionPrompt.ts` still emits the old abstract intensity/product placement lines and its composed real main prompt contains the obsolete After-panel SKU clause.

### Task 2: Implement the Structured Comparison Prompt

**Files:**
- Modify: `electron/main/services/image-tasks/instructionPrompt.ts:253-287`
- Test: `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`

- [ ] **Step 1: Replace comparison layout lines**

Keep `comparisonLayoutLines` limited to panel order:

```ts
const comparisonLayoutLines = {
  auto: '根据比例和构图选择左右或上下布局。',
  horizontal: 'Before 左、After 右。',
  vertical: 'Before 上、After 下。',
} as const;
```

- [ ] **Step 2: Replace comparison intensity lines**

Replace `comparisonIntensityLines` with:

```ts
const comparisonIntensityLines = {
  light: '轻度对比：Before 与 After 必须存在可辨认但自然克制的小范围状态改善，不能几乎一致。',
  medium: '中度对比：Before 的核心问题区域必须清晰可见，After 必须在同一区域呈现直接、明确且可信的改善，无需仔细观察即可理解变化。',
  heavy: '重度对比：Before 的核心问题必须大面积、显著且一眼可见，After 必须在同一对象、同一区域呈现强烈、明确且可信的改善；不得更换或改变场景、对象、机位、材质或结构，也不得仅靠压暗 Before、提高 After 饱和度或增加效果光制造反差。',
} as const;
```

- [ ] **Step 3: Add shared invariants and layout-aware product visibility**

Add `Before 与 After 必须保持同一场景、对象、机位、尺度、材质与结构。` after the layout line. Move product visibility into a layout-aware helper so the sole foreground SKU directive is emitted only when `showProduct !== false`:

```ts
function buildComparisonProductVisibilityLine(request: ImageTaskRequest) {
  if (request.showProduct === false) {
    return '整张图不展示 SKU，只使用 Before 与 After 的场景状态表达改善效果。';
  }

  // Select the center-divider crossing direction from the chosen layout.
  return '展示 SKU 时，只展示一个产品实例，并将其作为独立于 Before 和 After 面板的前景商品层；两个面板内部不得重复出现 SKU，产品不得遮挡核心问题区域或 BEFORE、AFTER 标签。';
}
```

Normalize the comparison feature main prompt at assembly time so the composed prompt replaces the legacy panel-specific SKU visibility clause with the neutral `Before 与 After 两个面板内部均不得展示 SKU。` sentence. Keep all enabled and disabled SKU behavior exclusively in this helper.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run:

```bash
pnpm vitest run electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts
```

Expected: the instruction prompt test file passes.

### Task 3: Verify the Complete Application

**Files:**
- Verify only

- [ ] **Step 1: Run all tests**

Run:

```bash
pnpm test
```

Expected: all Vitest files and tests pass.

- [ ] **Step 2: Run TypeScript validation**

Run:

```bash
pnpm lint
```

Expected: `tsc --noEmit` exits successfully.

- [ ] **Step 3: Build the renderer**

Run:

```bash
pnpm build
```

Expected: Vite production build succeeds.

- [ ] **Step 4: Build Electron**

Run:

```bash
pnpm build:electron
```

Expected: Electron TypeScript and preload bundle build successfully.

- [ ] **Step 5: Check patch whitespace**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.
