# Product Image Set Controls Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add positive/negative prompts and mode-specific scene, handheld, effect, comparison, and multi-scene layout controls to the existing product image set workspace.

**Architecture:** Extend `ImageTaskRequest` with validated structured controls, map them deterministically into execution-prompt lines, and keep page request construction/restoration as pure feature modules. Preserve the existing task batching, max-count, partial-failure, and async restore mechanisms.

**Tech Stack:** React 19, TypeScript 5.8, Electron 37, Vitest, Testing Library

---

### Task 1: Extend and Validate the Request Contract

**Files:**
- Modify: `src/shared/domain/imageFeatureApi.ts`
- Modify: `src/shared/domain/__tests__/imageFeatureApi.test.ts`
- Modify: `src/shared/domain/imageTaskPlan.ts`
- Modify: `src/shared/domain/__tests__/imageTaskPlan.test.ts`

- [ ] **Step 1: Add failing tests for legal defaults and illegal enum values**

Test all enum values and exact Feature ownership:

```ts
expect(validateImageTaskRequest({
  feature: 'product_main_image',
  images: [{ role: 'product', path: '/sku.png' }],
  productHandheldMode: 'not_handheld',
  productEffectMode: 'auto',
})).toMatchObject({ productHandheldMode: 'not_handheld', productEffectMode: 'auto' });

expect(() => validateImageTaskRequest({
  feature: 'product_comparison_image',
  images: [{ role: 'product', path: '/sku.png' }],
  productHandheldMode: 'handheld',
})).toThrow('productHandheldMode is not supported by product_comparison_image');
```

Use runtime casts in tests to verify unknown values are rejected.

- [ ] **Step 2: Run domain tests and verify failure**

Run: `pnpm test -- src/shared/domain/__tests__/imageFeatureApi.test.ts`

Expected: FAIL because the fields and validation do not exist.

- [ ] **Step 3: Add request types and validation**

Add and export:

```ts
export type ProductHandheldMode = 'handheld' | 'not_handheld';
export type ProductEffectMode = 'auto' | 'show' | 'hide';
export type ComparisonLayout = 'auto' | 'horizontal' | 'vertical';
export type ComparisonIntensity = 'light' | 'medium' | 'heavy';
export type MultiSceneLayout = 'single' | 'collage' | 'grid';
```

Add `negativePrompt`, `scenePrompt`, and the five mode fields to `ImageTaskRequest`. Validate allowed values and reject fields attached to the wrong Feature. Remove the `product_multi_scene requires a prompt` rule. Keep product-image role, variant, count, and max-count rules unchanged.

- [ ] **Step 4: Update prompts to the revised output contracts**

Change comparison main prompt from fixed 2 x 2 to one scene and one Before/After pair with auto/horizontal/vertical structure supplied by structured options. Change multi-scene main prompt so single/collage/grid is supplied by structured options and user prompt is optional.

- [ ] **Step 5: Run domain and plan tests**

Run: `pnpm test -- src/shared/domain/__tests__/imageFeatureApi.test.ts src/shared/domain/__tests__/imageTaskPlan.test.ts`

Expected: PASS.

### Task 2: Assemble Structured and Negative Prompts

**Files:**
- Modify: `electron/main/services/image-tasks/instructionPrompt.ts`
- Modify: `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`

- [ ] **Step 1: Add failing ordering and mapping tests**

Build one request for each Feature and assert exact ordering:

```text
mainPrompt
structured option lines
具体场景：...
补充要求：...
反向要求：避免出现以下内容：...
batch variant line
```

Cover every enum value with `it.each`, including comparison `showProduct` true/false. Assert empty optional strings do not create empty lines.

- [ ] **Step 2: Run prompt tests and verify failure**

Run: `pnpm test -- electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`

Expected: FAIL because structured controls and negative prompt are not rendered.

- [ ] **Step 3: Implement deterministic line builders**

Keep `buildExecutionPrompt()` ordering explicit. Add mode-specific line builders keyed by Feature, append `scenePrompt` after structured lines, then regular `prompt`, then `negativePrompt`, then variant guidance. Do not let generic `showProduct` rendering duplicate comparison-specific After wording.

- [ ] **Step 4: Run prompt and domain tests**

Run: `pnpm test -- electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts src/shared/domain/__tests__/imageFeatureApi.test.ts`

Expected: PASS.

### Task 3: Build Requests and Restore New Controls

**Files:**
- Modify: `src/features/product-image-set/productImageSetRequests.ts`
- Modify: `src/features/product-image-set/__tests__/productImageSetRequests.test.ts`
- Modify: `src/features/product-image-set/applyProductImageSetRestore.ts`
- Modify: `src/features/product-image-set/__tests__/applyProductImageSetRestore.test.ts`

- [ ] **Step 1: Add failing request-builder tests**

Extend input with all shared and mode-specific values. Assert every variant request receives `prompt`, `negativePrompt`, and only fields valid for its Feature. Assert multi-scene succeeds with an empty prompt.

- [ ] **Step 2: Add failing restore tests**

Assert new requests restore every field. Assert old-shaped tasks use:

```text
prompt/negativePrompt/scenePrompt = ''
productHandheldMode = not_handheld
productEffectMode = auto
comparisonLayout = auto
comparisonIntensity = medium
showProduct = true
multiSceneLayout = single
```

- [ ] **Step 3: Run focused tests and verify failure**

Run: `pnpm test -- src/features/product-image-set/__tests__/productImageSetRequests.test.ts src/features/product-image-set/__tests__/applyProductImageSetRestore.test.ts`

Expected: FAIL due to missing input and restore fields.

- [ ] **Step 4: Implement request and restore mappings**

Use a discriminated input shape or clear Feature branches so wrong fields cannot leak into requests. Preserve N requests, `count: 1`, product multi-image inputs, ratio, and variant metadata.

- [ ] **Step 5: Run focused tests**

Run: `pnpm test -- src/features/product-image-set/__tests__/productImageSetRequests.test.ts src/features/product-image-set/__tests__/applyProductImageSetRestore.test.ts`

Expected: PASS.

### Task 4: Add Page Controls and Complete Regression Verification

**Files:**
- Modify: `src/components/ProductImageSet.tsx`
- Modify: `src/components/__tests__/ProductImageSet.test.tsx`
- Modify: `src/components/TaskDetailDrawer.tsx`
- Modify: `README.md`
- Modify: `docs/ai-image-feature-api.md`
- Modify: `docs/ai-image-system-prompts.md`

- [ ] **Step 1: Add failing page tests for defaults and submission**

Assert shared prompt and negative-prompt textareas appear in every Tab. Assert main defaults to not-handheld/auto-effect, comparison to auto-layout/show-product/medium, and multi-scene to single. Change every control and assert submitted requests carry the selected values.

- [ ] **Step 2: Add state-isolation and restoration tests**

Set different prompts in all three Tabs, switch between them, and assert values persist independently. Restore new and old tasks and assert exact values/defaults.

- [ ] **Step 3: Run page tests and verify failure**

Run: `pnpm test -- src/components/__tests__/ProductImageSet.test.tsx`

Expected: FAIL because controls are absent.

- [ ] **Step 4: Implement controls using existing visual patterns**

Expand `TabState`, defaults, submission, and restore assignment. Use existing `ui-input-compact`, `ui-textarea`, `ui-segment-active`, and `ui-segment-inactive` classes. Keep basic parameters as ratio/count and place prompts and mode controls in advanced parameters.

- [ ] **Step 5: Update task details and documentation**

Display new request parameters in `TaskDetailDrawer`. Update README and both image API/prompt docs to replace four-grid and required multi-scene-prompt language with the enhanced contracts.

- [ ] **Step 6: Run complete verification**

Run: `pnpm test`

Expected: all tests pass.

Run: `pnpm lint`

Expected: no TypeScript errors.

Run: `pnpm build`

Expected: Vite build succeeds.

Run: `pnpm build:electron`

Expected: Electron and preload builds succeed.

Run: `git diff --check`

Expected: no whitespace errors.

Do not run credential-gated model smoke tests unless credentials are explicitly authorized. Do not commit without explicit authorization.
