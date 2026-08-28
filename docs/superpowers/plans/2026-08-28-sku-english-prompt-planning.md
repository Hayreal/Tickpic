# SKU English Prompt Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and persist an English vision-planned prompt before each SKU label image edit.

**Architecture:** Add a small SKU vision-prompt module that defines the JSON contract and validates English prompts. Reuse the existing vision client and sequential executor path used by product sets; do not add UI state, services, or task types.

**Tech Stack:** TypeScript, Electron main process, OpenAI-compatible vision client, Vitest.

---

### Task 1: Define the SKU vision prompt contract

**Files:**
- Create: `electron/main/services/image-tasks/skuVisionPrompt.ts`
- Create: `electron/main/services/image-tasks/__tests__/skuVisionPrompt.test.ts`

- [ ] **Step 1: Write the failing contract tests**

```ts
expect(buildSkuVisionSystemPrompt('sku_replica')).toContain('Return every execution prompt in English only.');
expect(buildSkuVisionSystemPrompt('sku_variation')).toContain('Never alter the SKU container');
expect(() => parseSkuVisionBatch('{"instructions":[{"index":1,"prompt":"中文"}]}', 1)).toThrow('English-only');
```

- [ ] **Step 2: Run the contract tests and verify they fail**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/skuVisionPrompt.test.ts`

Expected: FAIL because `skuVisionPrompt.ts` does not exist.

- [ ] **Step 3: Implement the minimal JSON planner contract**

```ts
export type SkuVisionBatch = { instructions: Array<{ index: number; prompt: string }> };

export function parseSkuVisionBatch(raw: string, expectedCount: number): SkuVisionBatch {
  // Strip a JSON fence, validate exact indexes and reject empty or Han-character prompts.
}
```

The English system prompt must lock the source SKU and explain replica, variation, and original reference behavior. Its user payload carries only the existing request fields and requested count.

- [ ] **Step 4: Run the contract tests and verify they pass**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/skuVisionPrompt.test.ts`

Expected: PASS.

### Task 2: Route SKU tasks through the existing vision client and executor

**Files:**
- Modify: `electron/main/services/image-tasks/visionInstructionClient.ts`
- Modify: `electron/main/services/image-tasks/imageTaskExecutor.ts`
- Modify: `electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts`

- [ ] **Step 1: Write the failing executor test**

```ts
await executor(createTask({ feature: 'sku_original', count: 1, images: [{ role: 'source', path: '/authorized/input/sku.png' }] }), signal);
expect(prompts).toEqual(['Edit the supplied SKU image; only redesign its label.']);
```

The fake vision client returns that one English prompt, and the test must prove that image execution receives it rather than the local SKU prompt.

- [ ] **Step 2: Run the executor test and verify it fails**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts`

Expected: FAIL because SKU tasks do not request vision instructions.

- [ ] **Step 3: Add the smallest shared route**

```ts
const isSku = isSkuFeature(task.feature);
const skuVisionResult = isSku ? await resolveSkuVisionResult(...) : undefined;
const executionPrompts = productSetVisionResult?.executionPrompts ?? skuVisionResult?.executionPrompts;
```

Add optional `generateSkuInstructions` to `VisionInstructionClient`, implement it with the existing OpenAI request/logging/image-content helpers, and use the existing per-prompt `executeSingleImage` loop for SKU tasks. Require the vision client and validate prompt count before artifact creation.

- [ ] **Step 4: Run the executor test and verify it passes**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts`

Expected: PASS.

### Task 3: Document the new execution boundary

**Files:**
- Modify: `docs/ai-image-system-prompts.md`

- [ ] **Step 1: Update the execution-prompt document**

State that the three SKU functions use the vision stage before image editing, write English execution prompts, translate Chinese user intent, and lock every source SKU property outside its label.

- [ ] **Step 2: Run focused tests and type checking**

Run: `pnpm vitest run electron/main/services/image-tasks/__tests__/skuVisionPrompt.test.ts electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts && pnpm lint`

Expected: all selected tests and TypeScript checks PASS.
