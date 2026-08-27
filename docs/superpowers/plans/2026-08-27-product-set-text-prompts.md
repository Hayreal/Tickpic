# Product Set Text Prompts Implementation Plan

> For agentic workers: use executing-plans task-by-task. Steps use checkbox syntax.

Goal: Replace JSON execution prompts for product-set images with compact natural-language prompts and add two comparison-grid layouts.

Architecture: Retain the existing product-set spec as internal data. Render feature-specific text from it and return a prompt plus handheld-reference metadata to the executor. Vision output remains internal JSON but no longer embeds the execution JSON template.

Tech stack: TypeScript, React, Electron, Vitest, pnpm.

---

### Task 1: Extend comparison layout controls

Files:

- Modify: F:/PycharmProjects/Tickpic/src/shared/domain/imageFeatureApi.ts
- Modify: F:/PycharmProjects/Tickpic/src/components/ProductImageSet.tsx
- Test: F:/PycharmProjects/Tickpic/src/shared/domain/__tests__/imageFeatureApi.test.ts
- Test: F:/PycharmProjects/Tickpic/src/components/__tests__/ProductImageSet.test.tsx

- [ ] Write failing tests that request grid_2x2 and grid_3x2 and expect valid requests plus controls labelled 四宫格对比 and 六宫格对比.
- [ ] Run: pnpm vitest run src/shared/domain/__tests__/imageFeatureApi.test.ts src/components/__tests__/ProductImageSet.test.tsx
- [ ] Extend ComparisonLayout to auto, horizontal, vertical, grid_2x2, grid_3x2. Extend validation with the same values. Add the two options to the comparison segmented control.
- [ ] Re-run the focused tests. Expected: PASS.
- [ ] Commit only changed files with message: feat: add grid comparison layouts.

### Task 2: Render final prompts as natural language

Files:

- Modify: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/productSetJsonPrompt.ts
- Modify: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/instructionPrompt.ts
- Test: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts
- Test: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts

- [ ] Write failing tests asserting final prompts do not begin with a left brace, do not contain sku_lock or VARIANT DIRECTIVE, and include a single SKU-lock sentence plus feature-relevant scene text.
- [ ] Run: pnpm vitest run electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts
- [ ] Keep buildProductSetSpec and vision merging internal. Replace JSON formatting with a renderer that joins non-empty output target, SKU lock, one feature contract, scene/variant data, and copy/user-requirement paragraphs.
- [ ] Main-image renderer must state a general product–actual-target–observable-state relationship, add real-actuator direction only for an effect variant, and add hand/reference instructions only for a handheld variant.
- [ ] Comparison renderer must state matched evidence and a foreground SKU layer only if enabled. Multi-scene renderer must state only the selected single/collage/grid contract.
- [ ] Route generic product-set prompt assembly through the text renderer, remove final-prompt JSON parsing expectations, and re-run the focused tests. Expected: PASS.
- [ ] Commit only renderer files with message: refactor: render product set prompts as text.

### Task 3: Implement comparison layout resolution and concise vision planning

Files:

- Modify: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/productSetJsonPrompt.ts
- Modify: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/productSetVisionPrompt.ts
- Test: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts
- Test: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts

- [ ] Write failing tests for auto variants 1..4 resolving to horizontal, vertical, grid_2x2 and grid_3x2, plus a comparison layout plan sent to the vision model.
- [ ] Run: pnpm vitest run electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts
- [ ] Implement a stable resolver: manual layouts are returned unchanged; auto uses variant index modulo the four layouts.
- [ ] Render grid_2x2 as two rows of Before-left/After-right evidence pairs and grid_3x2 as three rows of such pairs.
- [ ] Render the product-placement rule generally: one readable foreground packaging layer, never covering evidence or causing unrelated display surfaces or filler props.
- [ ] Add comparison_layout_plan to vision user text. Remove the large embedded final execution-template example from vision instructions.
- [ ] Re-run focused tests. Expected: PASS.
- [ ] Commit only comparison files with message: feat: diversify product comparison layouts.

### Task 4: Decouple executor image filtering from prompt text

Files:

- Modify: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/productSetJsonPrompt.ts
- Modify: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/visionInstructionClient.ts
- Modify: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/imageTaskExecutor.ts
- Test: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts

- [ ] Write a failing test with two variants, proving only the handheld variant receives the reference image while both prompts are plain text.
- [ ] Run: pnpm vitest run electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts
- [ ] Return ProductSetExecutionVariant objects containing prompt and requiresHandheldReference from the merged internal spec.
- [ ] Add optional executionHandheldReferenceRequired metadata to the vision result. Keep executionPrompts for debug artifacts.
- [ ] Filter execution images from the boolean metadata rather than parsing a final prompt.
- [ ] Re-run executor tests. Expected: PASS.
- [ ] Commit only executor files with message: refactor: decouple product set metadata from prompts.

### Task 5: Update docs and verify

Files:

- Modify: F:/PycharmProjects/Tickpic/docs/ai-image-system-prompts.md
- Test: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/__tests__/productSetDebugArtifacts.test.ts
- Test: F:/PycharmProjects/Tickpic/electron/main/services/image-tasks/__tests__/requestSecurity.test.ts

- [ ] Update diagnostic tests: execution prompt files are text while vision-batch.json remains internal JSON.
- [ ] Rewrite product-set documentation to describe text execution prompts, internal vision JSON, and four comparison layouts.
- [ ] Run focused tests:
  pnpm vitest run electron/main/services/image-tasks/__tests__/productSetJsonPrompt.test.ts electron/main/services/image-tasks/__tests__/productSetVisionPrompt.test.ts electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts electron/main/services/image-tasks/__tests__/productSetDebugArtifacts.test.ts src/shared/domain/__tests__/imageFeatureApi.test.ts src/components/__tests__/ProductImageSet.test.tsx
- [ ] Run: pnpm lint
- [ ] Run: pnpm test
- [ ] Run: git diff --check
- [ ] Stage only files changed by this plan; do not stage pre-existing user changes.
