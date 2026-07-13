# Sticker Output Mainline Replan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan in four mainline milestones. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the approved sticker-output overhaul through one working renderer-to-model-to-artifact path, while avoiding repeated review loops for non-blocking edge cases.

**Architecture:** Keep the completed shared sizing, capacity, and UI-control modules as foundations. Finish the renderer request path first, then the Electron/model output contract, then the mode/variation prompt engine, and finally run one integrated verification gate. Each milestone must leave a demonstrably more complete mainline and receives one specification/quality review at its end; only Critical or Important mainline defects block the next milestone.

**Tech Stack:** React 19, TypeScript, Vitest, Electron, OpenAI Images API, `@google/genai`, pnpm 10.

---

## Current baseline — complete, do not reopen without a regression

- [x] Deterministic sticker sizing: `1K`/`2K`, custom ratios, 16-pixel alignment, finite decimal round-tripping.
- [x] Capacity normalization: ML/FL.OZ, G/OZ, pieces, explicit dual units, warnings for unsupported values.
- [x] Product-ratio control: only `auto`, `21:5`, `21:10`, `9:12`, and custom; quality control defaults to `1K`.
- [x] Focused foundation tests and reviews pass. The known four pre-existing English-visible-text prompt tests remain baseline failures until Milestone 3 replaces the sticker prompt path.

Non-blocking items such as complete listbox arrow-key navigation are recorded for final polish and must not stop the mainline unless they break keyboard submission or data correctness.

## Milestone 1: Complete the renderer request and restore path

**Outcome:** Replica, variation, and original each render one product-ratio control, one quality control, and one count control; they submit a canonical request and restore both new and legacy tasks.

**Files:**
- Modify: `src/lib/aspectRatioFromImage.ts`
- Modify: `src/lib/__tests__/aspectRatioFromImage.test.ts`
- Modify: `src/components/FeatureWorkspaceLayout.tsx`
- Modify: `src/components/StickerParameterFields.tsx`
- Modify: `src/components/StickerGen.tsx`
- Modify: `src/components/__tests__/StickerGen.test.tsx`
- Modify: `src/features/tasks/applyStickerRestore.ts`
- Create: `src/features/tasks/__tests__/applyStickerRestore.test.ts`

- [ ] **Step 1: Write renderer request-shape tests**

Add table-driven tests for all three modes. The replica assertion is the canonical shape:

```ts
expect(request).toMatchObject({
  feature: 'sticker_replica',
  aspectRatio: '21:5',
  outputQuality: '1K',
  brand: 'wkau',
});
expect(request).not.toHaveProperty('productRatio');
expect(request).not.toHaveProperty('logoText');
```

Also assert `2K`, capacity preview, warning-only unsupported capacity, invalid-ratio submit disabling, and empty-brand fallback to `wkau`.

- [ ] **Step 2: Write exact automatic-ratio tests**

```ts
expect(formatAspectRatio(700, 500)).toBe('7:5');
expect(formatAspectRatio(1000, 333)).toBe('1000:333');
```

Test request precedence as `region -> source/style image -> 1:1` and prove original mode reads the style image rather than an unrelated source image.

- [ ] **Step 3: Write restore/migration tests**

```ts
expect(applyStickerRestore(task({
  feature: 'sticker_original',
  aspectRatio: '7:10',
  outputQuality: '2K',
  brand: 'WKUA',
}))).toMatchObject({
  subTab: 'original',
  originalAspectRatio: '7:10',
  originalOutputQuality: '2K',
  originalBrand: 'WKUA',
});

expect(applyStickerRestore(task({
  feature: 'sticker_replica',
  aspectRatio: 'auto',
  productRatio: '21:10',
  logoText: 'LEGACY',
}))).toMatchObject({
  copyAspectRatio: '21:10',
  copyOutputQuality: '1K',
  copyBrand: 'LEGACY',
});
```

- [ ] **Step 4: Run the red gate**

Run:

```powershell
npx -y pnpm@10 exec vitest run src/lib/__tests__/aspectRatioFromImage.test.ts src/components/__tests__/StickerOutputControls.test.tsx src/components/__tests__/StickerGen.test.tsx src/features/tasks/__tests__/applyStickerRestore.test.ts
```

Expected: failures showing the legacy request/state shape, duplicate ratio state, and missing restore quality fields.

- [ ] **Step 5: Implement one canonical state per mode**

Use these state pairs, defaulting quality to `1K`:

```ts
const [copyAspectRatio, setCopyAspectRatio] = useState('auto');
const [copyOutputQuality, setCopyOutputQuality] = useState<StickerOutputQuality>('1K');
```

Repeat for variation and original. Remove `*ProductRatio` state and `copyLogoText`. Resolve `auto` before submission:

```ts
async function resolveStickerRatio(selected: string, path?: string, region?: RegionInput | null) {
  if (selected !== 'auto') return normalizeStickerAspectRatio(selected);
  if (region && region.width > 0 && region.height > 0) {
    return formatAspectRatio(region.width, region.height);
  }
  if (path) return inferStickerSourceAspectRatio(path);
  return '1:1';
}
```

Every request sends only `aspectRatio` and `outputQuality`. Replica resolves `brand` as `copyBrand.trim() || DEFAULT_STICKER_BRAND`.

- [ ] **Step 6: Complete visible renderer behavior**

Add `submitDisabled?: boolean` to `FeatureWorkspaceLayout`; combine it with existing busy/disabled rules. Show normalized capacity copy and amber warnings below the capacity input. Remove the replica Logo-text input but keep Logo-image upload. Keep variation direction in a full `sm:col-span-3` row above its output controls.

- [ ] **Step 7: Implement restore compatibility once**

```ts
function restoredRatio(request: ImageTaskRequest) {
  const explicit = request.aspectRatio?.trim();
  if (explicit && explicit !== 'auto') return explicit;
  if (request.productRatio && isStickerProductRatioPreset(request.productRatio)) {
    return request.productRatio;
  }
  return explicit || 'auto';
}

function restoredQuality(request: ImageTaskRequest): StickerOutputQuality {
  return isStickerOutputQuality(request.outputQuality) ? request.outputQuality : '1K';
}
```

Remove restore-only UI fields (`copyProductRatio`, `variationProductRatio`, `originalProductRatio`, `copyLogoText`) while retaining deprecated request fields for input migration.

- [ ] **Step 8: Run the green gate and commit**

Run the Step 4 command, then `npx -y pnpm@10 run lint`. At this point the three old `StickerGen` signature errors must be gone; only the known `imageTaskPlan` legacy sizing import may remain until Milestone 2.

```powershell
git add src/lib/aspectRatioFromImage.ts src/lib/__tests__/aspectRatioFromImage.test.ts src/components/FeatureWorkspaceLayout.tsx src/components/StickerParameterFields.tsx src/components/StickerGen.tsx src/components/__tests__/StickerGen.test.tsx src/features/tasks/applyStickerRestore.ts src/features/tasks/__tests__/applyStickerRestore.test.ts
git commit -m "feat: complete sticker renderer output flow"
```

## Milestone 2: Carry exact output specs through Electron and inspect results

**Outcome:** The resolved target is sent correctly to OpenAI/Gemini, recorded in request artifacts, and compared with the actual returned bitmap dimensions without silently resizing it.

**Files:**
- Modify: `src/shared/domain/imageTaskPlan.ts`
- Modify: `src/shared/domain/__tests__/imageTaskPlan.test.ts`
- Modify: `electron/main/services/image-tasks/modelGateway.ts`
- Modify: `electron/main/services/image-tasks/protocolClients.ts`
- Modify: `electron/main/services/image-tasks/__tests__/modelGateway.test.ts`
- Modify: `electron/main/services/image-tasks/__tests__/protocolClients.test.ts`
- Create: `electron/main/services/image-tasks/generatedImageDimensions.ts`
- Create: `electron/main/services/image-tasks/__tests__/generatedImageDimensions.test.ts`
- Modify: `electron/main/services/image-tasks/imageTaskExecutor.ts`
- Modify: `electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts`
- Modify: `electron/main/services/image-tasks/imageTaskArtifactStore.ts`
- Modify: `electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts`

- [ ] **Step 1: Write plan and provider red tests**

```ts
expect(plan.outputSpec).toEqual({
  aspectRatio: '3:2', outputQuality: '2K', width: 2048, height: 1360, size: '2048x1360',
});
expect(plan.openaiImageSize).toBe('2048x1360');
```

Assert OpenAI receives the exact `size`, while Gemini receives:

```ts
config: expect.objectContaining({
  imageConfig: { aspectRatio: '3:2', imageSize: '2K' },
})
```

Keep a non-sticker `replace_logo + auto` regression test.

- [ ] **Step 2: Write actual-dimension red tests**

Mock `nativeImage.createFromBuffer()` and assert matching, mismatching, and unreadable buffers. The mismatch message must be:

```ts
`模型返回尺寸 ${actual.width}x${actual.height}，与目标尺寸 ${expected.width}x${expected.height} 不一致`
```

- [ ] **Step 3: Run the red gate**

```powershell
npx -y pnpm@10 exec vitest run src/shared/domain/__tests__/imageTaskPlan.test.ts electron/main/services/image-tasks/__tests__/modelGateway.test.ts electron/main/services/image-tasks/__tests__/protocolClients.test.ts electron/main/services/image-tasks/__tests__/generatedImageDimensions.test.ts electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts
```

- [ ] **Step 4: Resolve output specification exactly once**

Add `outputSpec?: ResolvedStickerOutputSpec` to `ImageTaskPlan` and compute it only in `buildImageTaskPlan` using `resolveStickerOutputSpec(effectiveAspectRatio, outputQuality ?? '1K')`. Delete product-ratio priority and legacy hard-coded size imports. Non-sticker normalization stays unchanged.

- [ ] **Step 5: Map protocol-specific fields**

OpenAI uses `outputSpec.size`. Gemini uses `GenerateContentConfig.imageConfig` with uppercase `1K`/`2K`. Enrich sticker-only gateway failures with protocol, ratio, quality, target size, and original error; keep non-sticker error text unchanged.

- [ ] **Step 6: Inspect and persist returned dimensions**

Create `inspectGeneratedImage(buffer)` with `nativeImage`, attach optional `width`/`height` to generated outputs, append the warning on mismatch, and persist both `outputSpec` and actual dimensions in artifacts. Do not resample or silently rewrite the returned image.

- [ ] **Step 7: Run the green gate and commit**

Run the Step 3 command and `npx -y pnpm@10 run lint`; both must pass except the separately tracked baseline prompt assertions, which are not part of lint.

```powershell
git add src/shared/domain/imageTaskPlan.ts src/shared/domain/__tests__/imageTaskPlan.test.ts electron/main/services/image-tasks/modelGateway.ts electron/main/services/image-tasks/protocolClients.ts electron/main/services/image-tasks/__tests__/modelGateway.test.ts electron/main/services/image-tasks/__tests__/protocolClients.test.ts electron/main/services/image-tasks/generatedImageDimensions.ts electron/main/services/image-tasks/__tests__/generatedImageDimensions.test.ts electron/main/services/image-tasks/imageTaskExecutor.ts electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts electron/main/services/image-tasks/imageTaskArtifactStore.ts electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts
git commit -m "feat: enforce sticker output contracts end to end"
```

## Milestone 3: Replace patchwork prompts with mode and variation contracts

**Outcome:** Sticker prompts have one deterministic structure, mode-specific behavior, and auditable variation directions; color preserves layout while layout variation changes it.

**Files:**
- Modify: `src/shared/domain/stickerPrompts.ts`
- Create: `src/shared/domain/__tests__/stickerPrompts.test.ts`
- Modify: `src/shared/domain/imageFeatureApi.ts`
- Modify: `src/shared/domain/__tests__/imageFeatureApi.test.ts`
- Modify: `src/shared/domain/imageTaskPlan.ts`
- Modify: `src/shared/domain/__tests__/imageTaskPlan.test.ts`
- Create: `electron/main/services/image-tasks/stickerInstructionPrompt.ts`
- Create: `electron/main/services/image-tasks/__tests__/stickerInstructionPrompt.test.ts`
- Modify: `electron/main/services/image-tasks/instructionPrompt.ts`
- Modify: `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`
- Modify: `electron/main/services/image-tasks/protocolClients.ts`
- Modify: `electron/main/services/image-tasks/__tests__/protocolClients.test.ts`
- Modify: `electron/main/services/image-tasks/imageTaskArtifactStore.ts`
- Modify: `electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts`

- [ ] **Step 1: Write the variation-contract red table**

Define and test all eight directions with `change`, `preserve`, `forbid`, and `inputFidelity`:

```ts
expect(getStickerVariationDirection('color')).toMatchObject({
  inputFidelity: 'high',
  preserve: expect.arrayContaining(['layout', 'visible copy']),
  forbid: expect.arrayContaining(['rebuild the layout']),
});
expect(getStickerVariationDirection('layout')).toMatchObject({
  inputFidelity: 'low',
  change: expect.arrayContaining(['layout']),
});
```

Use the approved fidelity map: product low, color high, reverse low, geometry low, layout low, background high, fusion low, key-element high. Preserve brand in every direction. `key-element` changes exactly one dominant group.

- [ ] **Step 2: Write deterministic resolver and fidelity red tests**

Resolution priority is explicit direction, product fields, color, layout, then fusion. Persist `resolvedVariationStrategy` in the plan/artifact. Protocol tests prove color=high, layout=low, and original style reference=low. Set original execution image roles to `['style']`.

- [ ] **Step 3: Write strict prompt red tests**

Assert one occurrence of each common hard rule, exact mode rules, normalized capacity, and every direction contract. Required sections are:

```text
[NON-NEGOTIABLE OUTPUT CONTRACT]
[MODE CONTRACT]
[VARIATION STRATEGY]          # variation only
[STRUCTURED CONTENT — OVERRIDES THE REFERENCE]
[LOW-PRIORITY USER NOTES]     # only when present
[FINAL CHECK]
```

The shared rules require one flat front-facing rectangular 2D label; four square corners; no bottle/jar/box/container/scene/mockup/3D; pure-white centered brand with ® upper-right; natural English only; complete title/brand/selling points/subtitle/net/decor; English-adaptive typography with title about 20% smaller; centered information group and wide side margins.

- [ ] **Step 4: Run the red gate**

```powershell
npx -y pnpm@10 exec vitest run src/shared/domain/__tests__/stickerPrompts.test.ts src/shared/domain/__tests__/imageFeatureApi.test.ts src/shared/domain/__tests__/imageTaskPlan.test.ts electron/main/services/image-tasks/__tests__/stickerInstructionPrompt.test.ts electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts electron/main/services/image-tasks/__tests__/protocolClients.test.ts electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts
```

- [ ] **Step 5: Implement strategy records and resolver**

Use `StickerVariationStrategy` records, not loose prompt strings. The resolver is auditable:

```ts
if (explicit) return explicit;
if (hasProductFields) return getStickerVariationDirection('product')!;
if (colorScheme?.trim()) return getStickerVariationDirection('color')!;
if (colorBlockLayout?.trim()) return getStickerVariationDirection('layout')!;
return getStickerVariationDirection('fusion')!;
```

- [ ] **Step 6: Implement the dedicated prompt builder**

`buildExecutionPrompt()` must dispatch `sticker_*` to `buildStickerInstructionPrompt()` before the generic path. Delete sticker-only suffix/finalizer patchwork from `instructionPrompt.ts`, while leaving non-sticker behavior unchanged.

Mode contracts:

- Replica: de-perspective/unwrap the source; preserve any field the user did not override.
- Variation: obey exactly the explicit or resolved strategy; no universal layout-change sentence.
- Original: create a new hierarchy; use style images only for visual language; do not copy wording/layout or invent certifications/claims.

Structured content resolves brand as `brand || legacy logoText || wkau`, appends `®`, and uses `normalizeStickerCapacity()`.

- [ ] **Step 7: Run the green gate and commit**

Run the Step 4 command. All prior four English-visible-text baseline failures must now pass because the sticker path has been replaced rather than patched.

```powershell
git add src/shared/domain/stickerPrompts.ts src/shared/domain/__tests__/stickerPrompts.test.ts src/shared/domain/imageFeatureApi.ts src/shared/domain/__tests__/imageFeatureApi.test.ts src/shared/domain/imageTaskPlan.ts src/shared/domain/__tests__/imageTaskPlan.test.ts electron/main/services/image-tasks/stickerInstructionPrompt.ts electron/main/services/image-tasks/__tests__/stickerInstructionPrompt.test.ts electron/main/services/image-tasks/instructionPrompt.ts electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts electron/main/services/image-tasks/protocolClients.ts electron/main/services/image-tasks/__tests__/protocolClients.test.ts electron/main/services/image-tasks/imageTaskArtifactStore.ts electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts
git commit -m "feat: rebuild sticker prompt and variation contracts"
```

## Milestone 4: Integrated verification, UI inspection, and documentation

**Outcome:** The full Electron workflow builds, the visible UI matches the approved control set, and artifacts prove the request/prompt/result contract.

**Files:**
- Modify: `docs/ai-image-feature-api.md`
- Modify: `docs/ai-image-system-prompts.md`
- Verify: all changed source and tests

- [ ] **Step 1: Update contract documentation**

Document `aspectRatio`, `outputQuality`, the three product presets plus auto/custom, 16-alignment formula, legacy restore migration, all common prompt rules, all eight direction contracts, provider mappings, and actual-dimension warnings. State explicitly: color variation preserves layout; layout variation changes it.

- [ ] **Step 2: Run one focused sticker suite**

```powershell
npx -y pnpm@10 exec vitest run src/shared/domain/__tests__/stickerOutputSpec.test.ts src/shared/domain/__tests__/stickerCapacity.test.ts src/shared/domain/__tests__/stickerPrompts.test.ts src/shared/domain/__tests__/imageFeatureApi.test.ts src/shared/domain/__tests__/imageTaskPlan.test.ts src/lib/__tests__/aspectRatioFromImage.test.ts src/components/__tests__/StickerOutputControls.test.tsx src/components/__tests__/StickerGen.test.tsx src/features/tasks/__tests__/applyStickerRestore.test.ts electron/main/services/image-tasks/__tests__/stickerInstructionPrompt.test.ts electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts electron/main/services/image-tasks/__tests__/modelGateway.test.ts electron/main/services/image-tasks/__tests__/protocolClients.test.ts electron/main/services/image-tasks/__tests__/generatedImageDimensions.test.ts electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts
```

Expected: every listed file passes.

- [ ] **Step 3: Run repository gates**

```powershell
npx -y pnpm@10 test
npx -y pnpm@10 run lint
npx -y pnpm@10 run build
npx -y pnpm@10 run build:electron
```

Expected: all commands exit 0. Any pre-existing baseline failure must be rechecked after Milestone 3; it cannot be waved through if the sticker prompt path still causes it.

- [ ] **Step 4: Inspect the Electron UI**

Run `npx -y pnpm@10 run dev:electron`. Verify each tab shows one product-ratio control, 1K/2K, and count; available ratios are only auto, 21:5, 21:10, 9:12, custom; `3:2 + 1K` previews `1024 × 688`; invalid input disables submit; replica has one `wkau` brand field; `100 ml` previews normalized NET copy; all eight variation directions remain visible. Verify by port/process state and stop only processes launched for this check.

- [ ] **Step 5: Run an optional real-model smoke**

When credentials exist, submit one replica request with `3:2 + 1K`; verify `request.json` records `1024x688`, the prompt contains each hard rule once, the output is a flat label, and result metadata contains actual dimensions. If credentials are absent, record the smoke as not run, never as passed.

- [ ] **Step 6: Commit docs and finish the branch**

```powershell
git add docs/ai-image-feature-api.md docs/ai-image-system-prompts.md
git commit -m "docs: document sticker output contracts"
```

Invoke `verification-before-completion`, then one final whole-change code review, then `finishing-a-development-branch`. Never stage `skills-lock.json`, `tests/package-scripts.test.ts`, credentials, smoke output, or unrelated user changes.

## Review policy for this replan

- Review once at the end of each milestone, not after every helper function.
- Block only on Critical issues or Important issues that affect request correctness, prompt correctness, persistence, model execution, or user-visible submit behavior.
- Record Minor issues for Milestone 4; do not reopen a completed milestone solely for polish.
- A failing focused test, lint, build, Electron startup, or mismatched request artifact remains blocking.
