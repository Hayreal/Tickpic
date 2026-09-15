# Product Main Image Layout Constraints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Constrain only product-set main-image prompts so headlines stay in the top area within two lines, SKU overlays stay in a bottom corner, and comparison content may remain centered.

**Architecture:** Keep the existing Vision-planner-to-execution-prompt flow. Restrict the planner's placement vocabulary and add one final-renderer hard rule so free-form planner text cannot authorize a middle headline or product overlay. Independent comparison and multi-scene prompt paths remain unchanged.

**Tech Stack:** TypeScript, Vitest, pnpm.

---

### Task 1: Lock the requested behavior with failing prompt tests

**Files:**
- Modify: `electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts`
- Modify: `electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts`

- [ ] **Step 1: Add Vision-planner assertions**

In the existing `plans one carousel set with a distinct layout and SKU placement per main image` test, assert that the product-main-image system prompt contains the allowed placement vocabulary and the two-line limit:

```ts
expect(prompt).toContain('标题只能放在左上、右上或顶部横幅');
expect(prompt).toContain('标题最多两行');
expect(prompt).toContain('SKU 只能放在左下或右下');
expect(prompt).toContain('对比内容可以位于画面中间');
```

- [ ] **Step 2: Add final-renderer assertions**

In the existing `renders a compact natural-language main-image execution prompt` test, replace the obsolete `Headline length is unconstrained` assertion with:

```ts
expect(prompt).toContain('headline is limited to at most two lines');
expect(prompt).toContain('headline only in the upper-left, upper-right, or a top banner');
expect(prompt).toContain('SKU cutout only in the lower-left or lower-right');
expect(prompt).toContain('comparison content may occupy the middle');
```

Add one independent comparison prompt assertion to prove the main-image-only rule does not leak:

```ts
const comparisonPrompt = renderer!({
  feature: 'product_comparison_image',
  aspectRatio: '1:1',
  comparisonLayout: 'horizontal',
});

expect(comparisonPrompt).not.toContain('headline only in the upper-left, upper-right, or a top banner');
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
pnpm vitest run electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts
```

Expected: FAIL because the new placement and line-limit phrases are not present yet; no TypeScript or test-discovery error should occur.

### Task 2: Add the minimum main-image-only prompt constraints

**Files:**
- Modify: `electron/main/services/image-tasks/productSetVisionPrompt.ts:41-51, 162-166`
- Modify: `electron/main/services/image-tasks/productSetJsonPrompt.ts:245-258, 480-519, 646-686, 739-744`

- [ ] **Step 1: Restrict Vision planning positions**

Update the product-main-image-only Vision rules and schema examples so they explicitly require:

```ts
'主图标题只能放在左上、右上或顶部横幅，禁止放在画面中部；标题最多两行，保持水平基线。SKU 只能放在左下或右下，禁止放在中部或上部。before_after 的对比内容可以位于画面中间，但标题与 SKU 仍必须遵守各自区域。'
```

Change the template descriptions for `sku_placement` and `headline_placement` to name those same allowed zones, and remove menu wording that permits headline-space overlap or arbitrary corner/diagonal placement for the SKU.

- [ ] **Step 2: Make the final main-image renderer authoritative**

Add one main-image hard-rule sentence to `renderMainImageFeatureContract` before its `showProduct` early return:

```ts
'Hard layout rules for this main-image card: keep the headline only in the upper-left, upper-right, or a top banner, never in the middle, and limit it to at most two lines. If the SKU is shown, place the single SKU cutout only in the lower-left or lower-right, never in the middle or upper area. In before_after mode, comparison content may occupy the middle, but it must not move the headline or SKU outside these zones.'
```

Update the main-image copy sentence so it no longer says headline length is unconstrained or tells the renderer not to lock titles to the top-left. It must instead require at most two lines and the three top zones.

- [ ] **Step 3: Align shared main-image style/menu text**

Change `MAIN_IMAGE_SET_STYLE.sku_treatment` and `MAIN_IMAGE_SKU_INTEGRATION_MENU` so their SKU guidance only permits upright lower-left/lower-right placement, with optional lower-corner edge bleed and no headline overlap. Leave comparison placement helpers untouched.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the same Vitest command from Task 1. Expected: all tests in both files pass, including the comparison non-leak assertion.

### Task 3: Verify the repository state and commit the implementation

**Files:**
- Verify: `electron/main/services/image-tasks/productSetJsonPrompt.ts`
- Verify: `electron/main/services/image-tasks/productSetVisionPrompt.ts`
- Verify: their two test files

- [ ] **Step 1: Run type-check and the full test suite**

Run:

```bash
pnpm lint
pnpm test
```

Expected: both commands exit with code 0 and report no failures.

- [ ] **Step 2: Check the diff and worktree**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors; only the two prompt files and their two tests are modified after the already-committed design document.

- [ ] **Step 3: Commit the implementation**

```bash
git add -- electron/main/services/image-tasks/productSetVisionPrompt.ts electron/main/services/image-tasks/productSetJsonPrompt.ts electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts
git commit -m "fix: constrain product main image layout"
```

