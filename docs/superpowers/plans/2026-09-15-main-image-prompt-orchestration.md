# Main Image Prompt Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify `product_main_image` prompt orchestration so generated cards resemble varied ecommerce use-case references while enforcing concise copy and selective handheld use.

**Architecture:** Keep the existing Vision planner → JSON spec → natural-language execution prompt pipeline. Change only main-image prompt rules and the existing presentation-mode normalization; append one short final compliance directive after the rendered prompt. Comparison and multi-scene prompts remain unchanged.

**Tech Stack:** TypeScript, Vitest, pnpm, Vite.

---

### Task 1: Lock the new main-image prompt contract in tests

**Files:**
- Modify: `electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts`
- Modify: `electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts`

- [ ] **Step 1: Add failing assertions**

Assert that the main-image Vision prompt allows `handheld_use` while still forbidding `effect_demo`, and that the execution prompt contains the exact final directive requirements: use the suggested headline, at most two total text rows, no third row or information modules. Assert the old “subtitle plus one or two main lines” wording is absent.

- [ ] **Step 2: Run the focused tests and verify the expected failure**

Run:

```powershell
pnpm vitest run electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts
```

Expected: FAIL because the current planner forbids `handheld_use`, the renderer normalizes handheld plans away, and no final directive is appended.

### Task 2: Simplify main-image planning and execution prompts

**Files:**
- Modify: `electron/main/services/image-tasks/productSetVisionPrompt.ts`
- Modify: `electron/main/services/image-tasks/productSetJsonPrompt.ts`

- [ ] **Step 1: Allow selective handheld main-image cards**

Update the main-image Vision rules so `carousel_hero`, `before_after`, `handheld_use`, and `lifestyle_scene` are valid modes; keep `effect_demo` forbidden. Set handheld-required behavior from the selected mode instead of forcing every mode to non-handheld. Keep no spray/mist/foam product effects.

- [ ] **Step 2: Remove conflicting and repeated copy guidance**

Replace phrases that allow “optional subtitle plus one or two main lines” with one unambiguous rule: one/two main-title rows, or one subtitle row plus one main-title row. Require the planner’s suggested headline to be used exactly. Keep the reference-style constraints limited to realistic problem scenes, natural product use, short headline treatment, and no icon/badge/information-card walls.

- [ ] **Step 3: Append the final compliance directive**

Append this block after the natural-language execution prompt for main images only:

```text
FINAL EDIT DIRECTIVE — obey this last:
Create one clean US ecommerce image in a realistic product-use scene.
Use the exact Suggested headline without rewriting or adding copy.
The entire headline block must contain at most 2 horizontal text rows total.
A subtitle/kicker counts as one row; if used, the main title must be one row.
Never add a third text row, extra slogan, icon row, badge, or information panel.
Keep the selected composition, SKU placement, and hand-use decision unchanged.
```

- [ ] **Step 4: Run focused tests and verify they pass**

Run the Task 1 command. Expected: both prompt test files pass.

### Task 3: Verify scope and build

**Files:**
- No additional files.

- [ ] **Step 1: Check prompt diff for stale conflicts**

Run:

```powershell
rg -n "optional small kicker|optional kicker|one or two main lines|禁止 handheld_use|禁止手持握瓶|FINAL EDIT DIRECTIVE" electron/main/services/image-tasks/productSetJsonPrompt.ts electron/main/services/image-tasks/productSetVisionPrompt.ts
```

Expected: no old three-line-enabling wording in main-image rules; the final directive is present; comparison and multi-scene files are unchanged.

- [ ] **Step 2: Run the full verification suite**

Run:

```powershell
pnpm lint
pnpm test
pnpm build
git diff --check
```

Expected: all commands exit 0; Vitest reports 82 test files and 500 tests passing; Vite reports a successful production build.

- [ ] **Step 3: Commit the implementation**

```powershell
git add -- electron/main/services/image-tasks/productSetVisionPrompt.ts electron/main/services/image-tasks/productSetJsonPrompt.ts electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts
git commit -m "fix: simplify main image prompt orchestration"
```

