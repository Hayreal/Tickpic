# Dynamic Product Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Vision dynamically plan each Temu carousel main image from the SKU, count, user expectation, and optional hand reference, while keeping physical and text constraints hard.

**Architecture:** The existing single Vision batch call remains the planner. It returns an AI-selected `presentation_mode`, `handheld_required`, and `show_effect` for every image; the existing prompt renderer consumes those values instead of assigning roles from `variantIndex`. The renderer adds universal SKU, English-only, hand, package-state, and category-appropriate-use rules to every English execution prompt.

**Tech Stack:** TypeScript, Vitest, existing Electron image-task services; no new dependencies, API calls, UI fields, classifiers, or post-generation review.

---

## File Structure

- Modify: `src/shared/domain/productSetVisionInstructions.ts` — permit `before_after` as an AI-selected main-image mode.
- Modify: `electron/main/services/image-tasks/productSetVisionPrompt.ts` — remove fixed `batch_presentation_plan`; ask Vision to choose a distinct role and physical use state for each item.
- Modify: `electron/main/services/image-tasks/productSetJsonPrompt.ts` — merge Vision’s selected mode and booleans, remove fixed role allocation, and render category-appropriate use constraints.
- Modify: `electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts` — cover dynamic batch instructions.
- Modify: `electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts` — cover dynamic mode merge, diversity, cap state, and non-spray execution text.

### Task 1: Lock the dynamic Vision batch contract

**Files:**
- Modify: `electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts`
- Modify: `src/shared/domain/productSetVisionInstructions.ts`

- [ ] **Step 1: Write the failing dynamic-contract test**

```ts
it('asks Vision to choose a distinct carousel role for each main image', () => {
  const prompt = buildProductSetVisionSystemPrompt('product_main_image');
  const text = buildProductSetVisionUserText({
    feature: 'product_main_image', count: 3,
    scenePrompt: 'show an expected Before/After outcome',
  }, 3);

  expect(prompt).toContain('由你决定每张的 presentation_mode');
  expect(prompt).toContain('至少 3 项明显不同');
  expect(text).not.toContain('batch_presentation_plan');
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts`

Expected: FAIL because the system prompt still requires a fixed `batch_presentation_plan` and user text still contains it.

- [ ] **Step 3: Implement the minimum dynamic contract**

Allow `before_after` in `ProductSetVisionInstructionItem.presentation_mode`. Replace index-specific system-prompt clauses with one rule: Vision chooses a valid role for every image and any pair differs in at least three of scene, use stage, composition, camera, product position, and headline treatment. Remove the `batch_presentation_plan` property from main-image Vision user text. Do not add a replacement planner field.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domain/productSetVisionInstructions.ts electron/main/services/image-tasks/productSetVisionPrompt.ts electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts
git commit -m "feat: let vision plan dynamic product carousel roles"
```

### Task 2: Use Vision’s dynamic role in the final English prompt

**Files:**
- Modify: `electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts`
- Modify: `electron/main/services/image-tasks/productSetJsonPrompt.ts`

- [ ] **Step 1: Write the failing merge test**

```ts
it('uses Vision-selected carousel roles instead of variant order', () => {
  const prompts = buildProductSetExecutionPromptsFromVision({
    feature: 'product_main_image', count: 3,
  }, {
    instructions: [
      { index: 1, presentation_mode: 'lifestyle_scene', handheld_required: false, show_effect: false },
      { index: 2, presentation_mode: 'before_after', handheld_required: false, show_effect: false },
      { index: 3, presentation_mode: 'handheld_use', handheld_required: true, show_effect: false },
    ],
  });

  expect(prompts[0]).toContain('lifestyle-use image');
  expect(prompts[1]).toContain('BEFORE and AFTER');
  expect(prompts[2]).toContain('handheld-use image');
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts`

Expected: FAIL because `resolveMainImageVariantPresentation` assigns by `variantIndex` and `mergeProductSetVisionInstruction` ignores `vision.presentation_mode`.

- [ ] **Step 3: Implement the minimum merge**

Delete the fixed role branches and `buildMainImagePresentationPlan` path. Keep `variantIndex` only for output ordering and diversity bookkeeping. In `applyVisionMainImageHandheldEffect`, set `merged.presentation` from `vision.presentation_mode`, with `carousel_ready: true` and `batch_role: 'AI-selected carousel role'`. Resolve `handheld_required` and `show_effect` from Vision with `false` defaults, and preserve the hand reference only when Vision chooses hand-held.

Keep `before_after` as the only presentation that permits a divided comparison; all other modes remain one coherent scene.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/main/services/image-tasks/productSetJsonPrompt.ts electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts
git commit -m "feat: render vision-selected carousel roles"
```

### Task 3: Make use effects physically category-appropriate

**Files:**
- Modify: `electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts`
- Modify: `electron/main/services/image-tasks/productSetJsonPrompt.ts`

- [ ] **Step 1: Keep the failing non-spray regression test**

```ts
expect(prompt).toContain('real category-appropriate use action or visible after-use result');
expect(prompt).toContain('Never invent spray, mist, or a nozzle for a non-spray product');
expect(prompt).toContain('Only if the SKU truly has a spray nozzle, pump, trigger, or dispensing orifice');
expect(prompt).not.toContain('Spray mechanics:');
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts`

Expected: FAIL because every `show_effect` execution prompt emits unconditional `Spray mechanics` text.

- [ ] **Step 3: Render a conditional use contract**

Replace unconditional spray text with:

```ts
'Show the SKU’s real category-appropriate use action or visible after-use result on the actual use target. Never invent spray, mist, or a nozzle for a non-spray product.'
'Only if the SKU truly has a spray nozzle, pump, trigger, or dispensing orifice: remove any removable protective cap before active use, use the real actuator, and make emission originate from the real opening in its facing direction.'
```

Keep the existing nozzle/cap forbidden rules as this conditional spray clause. Do not create per-container enums; SKU images let Vision choose squeezing, pouring, dropping, rubbing, wiping, dissolving, coating, or an after-use result.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts`

Expected: PASS, including the existing spray cap/nozzle test.

- [ ] **Step 5: Commit**

```bash
git add electron/main/services/image-tasks/productSetJsonPrompt.ts electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts
git commit -m "fix: make product effects follow real package use"
```

### Task 4: Verify the complete image-task path

**Files:**
- Test: `electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts`

- [ ] **Step 1: Run all relevant image-task tests**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts`

Expected: PASS with no test failures.

- [ ] **Step 2: Run TypeScript validation and Electron build**

Run: `pnpm lint && pnpm build:electron`

Expected: both commands exit 0.

- [ ] **Step 3: Inspect the working tree**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only implementation changes and known user-owned files remain.
