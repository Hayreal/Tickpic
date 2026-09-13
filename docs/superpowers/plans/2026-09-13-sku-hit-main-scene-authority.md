# SKU 爆款主图场景权威优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make SKU hit-main prompts consistently use the page order—Image 1 SKU, Image 2 reference—while preserving the reference image's marketing copy, target object, use case, and before/after logic.

**Architecture:** Keep the existing 8/30-31 Vision → Constraint → Assembler pipeline. Add one explicit authority policy to the hit-main constraint spec and mirror it in the Vision planner and assembler. Remove post-8/31 rules that rewrite reference headlines, force SKU-category scenes, or suppress a useful secondary product display.

**Tech Stack:** TypeScript, Vitest, Electron image-task prompt builders.

---

### Task 1: Lock the desired authority split with regression tests

**Files:**
- Modify: `electron/main/services/image-tasks/__tests__/skuHitMainConstraintSpec.test.ts`
- Modify: `electron/main/services/image-tasks/__tests__/skuHitMainVisionPrompt.test.ts`
- Modify: `electron/main/services/image-tasks/__tests__/skuHitMainImagePrompt.test.ts`
- Modify: `electron/main/services/image-tasks/__tests__/skuPromptAssembler.test.ts`

- [x] **Step 1: Replace tests that require SKU-category authority**

Assert that generated hit-main constraints explicitly preserve Image 2 headline/use-case/target-object authority, do not contain the old Image 1 SKU-category scene override, and allow a useful secondary product display when needed for exposure.

- [x] **Step 2: Add Vision prompt assertions**

Assert that the planner says Image 2 controls marketing copy, target object, usage scene, and before/after intent, while Image 1 controls packaging identity only. Assert that it does not require rewriting Image 2 headlines or exactly one SKU instance.

- [x] **Step 3: Add assembler validation assertions**

Assert that a prompt preserving Image 2's headline and use case is accepted, while a prompt that makes Image 1 the headline or scene authority is rejected.

- [x] **Step 4: Run the focused tests and verify RED**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/skuHitMainConstraintSpec.test.ts electron/main/services/image-tasks/__tests__/skuHitMainVisionPrompt.test.ts electron/main/services/image-tasks/__tests__/skuHitMainImagePrompt.test.ts electron/main/services/image-tasks/__tests__/skuPromptAssembler.test.ts`

Expected: FAIL because the current prompts still assert Image 2 category authority, forced headline rewriting, and exactly one SKU.

### Task 2: Implement the shared authority policy

**Files:**
- Modify: `electron/main/services/image-tasks/skuHitMainConstraintSpec.ts`
- Modify: `electron/main/services/image-tasks/skuHitMainVisionPrompt.ts`
- Modify: `electron/main/services/image-tasks/skuHitMainImagePrompt.ts`

- [x] **Step 1: Add explicit authority sections**

Define reference authority for Image 2 marketing theme, core English copy, target object, use case, scene type, selling logic, and before/after promise. Define SKU authority for Image 1 container, packaging, label, brand, product name, capacity, and product identity. State that the reference authority wins any scene or headline conflict; SKU authority does not redefine the advertised problem.

- [x] **Step 2: Restore reference-driven scene and copy rules**

Change usage-scene and copy lines to preserve Image 2's target object and core wording. Keep user-filled fields as explicit overrides and derive palette from Image 1 SKU label colors.

- [x] **Step 3: Relax display suppression**

Remove the exact-one SKU and no-countertop-display hard rules. Require one primary SKU with sufficient exposure; allow a secondary product display only when it is compositionally useful and not accidental duplication. Keep physical support, lighting, and scale rules.

- [x] **Step 4: Run the focused tests and verify GREEN**

Run the same `pnpm vitest run ...` command from Task 1.

Expected: PASS with all new authority assertions satisfied.

### Task 3: Prevent the Assembler from reintroducing the regression

**Files:**
- Modify: `electron/main/services/image-tasks/skuPromptAssembler.ts`
- Modify: `electron/main/services/image-tasks/__tests__/skuPromptAssembler.test.ts`

- [x] **Step 1: Update hit-main assembler instructions**

Tell the assembler to preserve Image 2 headline/use-case/target-object authority, use Image 1 only for exact SKU packaging identity, and never rewrite reference copy solely because the SKU label names another category.

- [x] **Step 2: Replace brittle bad-rule detection**

Reject assembled prompts that explicitly elevate Image 1 SKU category to headline or usage-scene authority. Do not reject prompts merely because they show both a hand-use scene and a secondary product display.

- [x] **Step 3: Run the focused tests**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/skuPromptAssembler.test.ts`

Expected: PASS.

### Task 4: Verify the complete prompt surface

**Files:**
- No additional files.

- [x] **Step 1: Run the full test suite**

Run: `pnpm test`

Expected: exit code 0 with no failed tests.

- [x] **Step 2: Run the TypeScript check**

Run: `pnpm lint`

Expected: exit code 0 with no TypeScript errors.

- [x] **Step 3: Review the final diff**

Run: `git diff --check` and `git diff -- electron/main/services/image-tasks/skuHitMainConstraintSpec.ts electron/main/services/image-tasks/skuHitMainVisionPrompt.ts electron/main/services/image-tasks/skuHitMainImagePrompt.ts electron/main/services/image-tasks/skuPromptAssembler.ts`

Expected: only the authority split, scene/copy rules, display policy, assembler validation, and their tests changed.
