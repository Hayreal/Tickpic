# SKU Prompt Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep SKU source geometry and batch copy stable while making variation/original outputs use their references and differ by design.

**Architecture:** Keep the existing renderer-created single-image tasks, but coalesce their vision planning by `outputBatchId` inside the shared main-process executor. Wrap every planner-produced instruction with deterministic source-lock, image-role, input-shape, mode, and copy-lock text before OpenAI image editing.

**Tech Stack:** TypeScript, Electron main process, OpenAI-compatible image editing, Vitest.

---

### Task 1: Lock final SKU execution prompts

**Files:**
- Modify: `electron/main/services/image-tasks/skuVisionPrompt.ts`
- Modify: `electron/main/services/image-tasks/visionInstructionClient.ts`
- Test: `electron/main/services/image-tasks/__tests__/skuVisionPrompt.test.ts`

- [ ] Add a failing test that parses one shared `locked_copy` and verifies the final prompt contains the immutable Image 1 rules, conditional source-image rules, Image 2+ role, exact product-name lock, and original-mode source-label exclusion.
- [ ] Run `pnpm test -- electron/main/services/image-tasks/__tests__/skuVisionPrompt.test.ts` and confirm it fails because `locked_copy` and prompt finalization do not exist.
- [ ] Extend the existing JSON schema with `locked_copy`, resolve user fields over planner values, and append the deterministic English guard to every planner instruction.
- [ ] Re-run the test and confirm it passes.

### Task 2: Share one planner result across split SKU tasks

**Files:**
- Modify: `electron/main/services/image-tasks/imageTaskExecutor.ts`
- Test: `electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts`

- [ ] Add a failing executor test with two tasks in one output batch; assert the vision client is called once with the full batch count and each task receives its indexed prompt.
- [ ] Run `pnpm test -- electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts` and confirm the planner is currently called twice with count one.
- [ ] Add the smallest executor-local promise cache keyed by `outputBatchId`, select prompts by `variantIndex`, and remove entries after all planned variants consume them.
- [ ] Re-run the executor test and confirm it passes.

### Task 3: Forward SKU references to final editing

**Files:**
- Modify: `electron/main/services/image-tasks/imageTaskExecutor.ts`
- Test: `electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts`

- [ ] Add a failing test asserting variation and original plans retain source and reference images at final execution.
- [ ] Run the executor test and confirm only the source image is currently forwarded.
- [ ] Delete the non-replica SKU reference filter so all SKU modes use the request's ordered execution images.
- [ ] Re-run the executor test and confirm it passes.

### Task 4: Verify the repair

**Files:**
- Verify only.

- [ ] Run `pnpm test -- electron/main/services/image-tasks/__tests__/skuVisionPrompt.test.ts electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts src/features/sku-image-gen/__tests__/skuImageGenRequests.test.ts`.
- [ ] Run `pnpm lint`.
- [ ] Run `git diff --check` and inspect `git diff` to ensure the existing product-set changes are untouched.
