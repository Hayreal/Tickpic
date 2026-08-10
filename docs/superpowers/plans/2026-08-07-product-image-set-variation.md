# Product Image Set Variation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every product-set batch item a concrete, feature-specific variation direction and make multi-scene outputs contain only target environments, without products or people.

**Architecture:** Keep the current per-variant request split and derive deterministic prompt directions from `feature`, `variantIndex`, and `variantTotal` during execution-prompt assembly. Strengthen the multi-scene feature contract at its definition and add prompt-level tests that exercise real feature prompts, control ordering, scene scoping, and all supported layouts.

**Tech Stack:** TypeScript, Electron main process, shared domain contracts, Vitest

---

## File Structure

- Modify `src/shared/domain/imageFeatureApi.ts`: make the multi-scene base contract explicitly prohibit products and people.
- Modify `src/shared/domain/__tests__/imageFeatureApi.test.ts`: lock down the updated multi-scene feature definition.
- Modify `electron/main/services/image-tasks/instructionPrompt.ts`: build feature-specific variation directions from batch position and strengthen multi-scene layout rules.
- Modify `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`: verify distinct variation directions, scene scoping, multi-scene exclusions, layout behavior, and prompt ordering.
- Reference `docs/superpowers/specs/2026-08-07-product-image-set-variation-design.md`: approved behavior.

### Task 1: Make Multi-Scene Output Product-Free And People-Free

**Files:**
- Modify: `src/shared/domain/imageFeatureApi.ts:257-264`
- Test: `src/shared/domain/__tests__/imageFeatureApi.test.ts`
- Test: `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`

- [ ] **Step 1: Write failing feature-definition tests**

Update the existing `product_multi_scene` definition expectation to require all of these phrases:

```ts
[
  '真实适用场景',
  '单场景、拼图或宫格',
  '只用于识别产品品类、用途和适用环境',
  '不得出现 SKU、输入产品、产品包装、品牌瓶罐或其他可识别商品实例',
  '不得出现人物、人体、面部、手部、手持动作或人物使用动作',
  '只展示具体目标场景、目标对象、表面、空间或环境状态',
  '默认不添加标题、卖点或营销文字',
]
```

- [ ] **Step 2: Write failing real-prompt tests**

Add a test that passes `getImageFeatureDefinition('product_multi_scene').mainPrompt` into `buildExecutionPrompt()` and asserts the final prompt contains the product and people exclusions. Add a conflicting user prompt such as `加入人物手持产品演示` and verify the hard rules occur before `PRODUCT_SET_CONFLICT_PRIORITY_GUARD` and the user text.

```ts
it('keeps multi-scene product and people exclusions ahead of conflicting user text', () => {
  const mainPrompt = getImageFeatureDefinition('product_multi_scene').mainPrompt;
  const text = buildExecutionPrompt({
    feature: 'product_multi_scene',
    multiSceneLayout: 'single',
    prompt: '加入人物手持产品演示',
  }, mainPrompt);

  expect(text).toContain('不得出现 SKU、输入产品、产品包装、品牌瓶罐或其他可识别商品实例');
  expect(text).toContain('不得出现人物、人体、面部、手部、手持动作或人物使用动作');
  expect(text.indexOf('不得出现人物')).toBeLessThan(text.indexOf(PRODUCT_SET_CONFLICT_PRIORITY_GUARD));
  expect(text.indexOf(PRODUCT_SET_CONFLICT_PRIORITY_GUARD)).toBeLessThan(text.indexOf('补充要求：加入人物手持产品演示'));
});
```

- [ ] **Step 3: Run focused tests and verify failure**

Run:

```bash
pnpm vitest run src/shared/domain/__tests__/imageFeatureApi.test.ts electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts
```

Expected: failures because the current main prompt says the SKU may appear and does not prohibit people.

- [ ] **Step 4: Replace the multi-scene main prompt**

Set `product_multi_scene.mainPrompt` to:

```ts
'依据输入 SKU 发散真实适用场景，画面模式由结构化选项控制为单场景、拼图或宫格。输入 SKU 只用于识别产品品类、用途和适用环境；输出画面不得出现 SKU、输入产品、产品包装、品牌瓶罐或其他可识别商品实例。不得出现人物、人体、面部、手部、手持动作或人物使用动作。只展示具体目标场景、目标对象、表面、空间或环境状态。默认不添加标题、卖点或营销文字，除非用户明确要求且不违反前述硬规则。'
```

- [ ] **Step 5: Strengthen multi-scene layout lines**

Replace the layout lines with:

```ts
const multiSceneLayoutLines = {
  single: '每张只展示一个完整目标场景；同一批次的不同输出必须使用不同子场景和构图。',
  collage: '一张图组合一组不同目标场景，允许不规则拼贴且各区域边界清晰；同一批次的不同输出不得复用同一组场景。',
  grid: '一张图使用规则网格展示一组不同目标场景；同一批次的不同输出不得复用同一组场景。',
} as const;
```

- [ ] **Step 6: Run focused tests and verify they pass**

Run the command from Step 3.

Expected: both test files pass.

### Task 2: Add Feature-Specific Batch Variation Directions

**Files:**
- Modify: `electron/main/services/image-tasks/instructionPrompt.ts:237-241`
- Test: `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`

- [ ] **Step 1: Write failing direction-matrix tests**

Add a matrix covering `product_main_image`, `product_comparison_image`, and `product_multi_scene` at variant indexes 1, 2, and 3. Assert each feature receives three distinct direction strings and each includes at least three concrete dimensions such as sub-scene, composition, camera, lighting, or visual expression.

Also assert:

```ts
expect(mainVariant1).toContain('核心方向');
expect(mainVariant2).toContain('环境方向');
expect(mainVariant3).toContain('视觉方向');
expect(comparisonVariant2).toContain('不得破坏当前图片内部 Before 与 After 的一致性');
expect(multiSceneVariant1).toContain('不得出现产品或人物');
```

- [ ] **Step 2: Add scene-scope tests**

For main and comparison requests with `scenePrompt: '浴室瓷砖'`, assert the final prompt says:

```text
所有变体必须保持在“浴室瓷砖”的同类目标场景范围内，只能通过不同子场景、对象、空间位置、构图、机位和光线形成差异，不得扩展到无关场景。
```

For main and comparison requests without `scenePrompt`, assert the prompt says the model may choose a different but real applicable target scene. Multi-scene has no `scenePrompt`; it must instead append a conditional rule: when the supplemental prompt specifies a target scene, variants remain within that scene type, otherwise the model selects a different real applicable target scene.

- [ ] **Step 3: Preserve incomplete-variant behavior**

Extend the existing incomplete-variant test so requests with only `variantIndex` or only `variantTotal` contain none of `核心方向`, `环境方向`, or `视觉方向`.

- [ ] **Step 4: Run focused tests and verify failure**

Run:

```bash
pnpm vitest run electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts
```

Expected: failures because `buildVariantLine()` still emits one generic line.

- [ ] **Step 5: Implement stable direction selection**

Replace the generic helper with a feature-aware helper. Use `(variantIndex - 1) % 3` to select a stable direction:

```ts
const PRODUCT_SET_VARIATION_DIRECTIONS = [
  {
    name: '核心方向',
    instruction: '使用最典型的目标场景，采用平衡构图、清晰商业光线和直接表达核心用途的视觉方式。',
  },
  {
    name: '环境方向',
    instruction: '使用同类目标场景中的不同子空间或使用位置，并明显改变主体对象、机位、景别和光线方向。',
  },
  {
    name: '视觉方向',
    instruction: '使用同类目标场景中的另一种环境表达，并明显改变构图重心、背景层次、观察角度和视觉风格。',
  },
] as const;
```

The final helper must append feature-specific constraints:

```ts
product_main_image:
'主图必须继续展示并准确保持 SKU；不得把只换色、只换标题、轻微移动产品或只更换装饰物视为有效差异。'

product_comparison_image:
'不同图片之间改变目标子区域、问题对象、整体构图和视觉表达，但不得破坏当前图片内部 Before 与 After 的一致性。'

product_multi_scene:
'仅输出不同的具体目标场景、对象、表面、空间或环境状态，不得出现产品或人物。'
```

For main and comparison, if `scenePrompt` exists, append the exact scoped-scene sentence from Step 2. Otherwise append:

```text
未指定具体场景时，根据 SKU 品类选择与本批其他方向不同但真实适用的目标场景。
```

For multi-scene, append this conditional hard rule regardless of supplemental prompt content:

```text
若用户补充要求指定了目标场景，所有变体必须保持在该同类目标场景范围内，只能通过不同子场景、对象、空间位置、构图、机位和光线形成差异，不得扩展到无关场景；若未指定目标场景，则根据 SKU 品类选择与本批其他方向不同但真实适用的目标场景。
```

- [ ] **Step 6: Keep variant metadata explicit**

The line must retain:

```text
这是本批次第 X/Y 张。
```

This preserves traceability in `image-instruction.txt` and existing task diagnostics.

- [ ] **Step 7: Run focused tests and verify they pass**

Run the command from Step 4.

Expected: the instruction prompt suite passes.

### Task 3: Verify The Integrated Change

**Files:**
- Verify only

- [ ] **Step 1: Run the full test suite**

```bash
pnpm test
```

Expected: all Vitest files and tests pass.

- [ ] **Step 2: Run TypeScript validation**

```bash
pnpm lint
```

Expected: `tsc --noEmit` exits successfully.

- [ ] **Step 3: Build renderer and Electron**

```bash
pnpm build
pnpm build:electron
```

Expected: both production builds succeed.

- [ ] **Step 4: Check patch whitespace**

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Inspect generated prompts manually**

Use the prompt unit-test fixtures or task logs to compare variants 1, 2, and 3 for each Feature. Confirm each line names a different direction and that multi-scene prompts contain no-product and no-people hard rules.
