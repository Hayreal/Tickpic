# Sticker Output and Prompt Engineering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild all three sticker workflows around one product-ratio selector, deterministic 1K/2K sizing, strict shared sticker rules, and direction-specific variation prompts.

**Architecture:** Add pure shared-domain modules for sizing and capacity normalization, then make the React UI, task restore path, execution plan, and protocol clients consume them. Move sticker prompts into a dedicated deterministic builder with data-driven mode and variation contracts; non-sticker image flows stay on the existing generic path.

**Tech Stack:** React 19, TypeScript 5.8, Electron 37, Vitest, Testing Library, OpenAI-compatible Images API, `@google/genai`, Tailwind CSS.

---

## File map

**Create:**

- `src/shared/domain/stickerOutputSpec.ts` — ratio parsing and 16-aligned 1K/2K output sizes.
- `src/shared/domain/stickerCapacity.ts` — NET copy normalization and unit conversion.
- `src/components/StickerOutputQualitySelect.tsx` — 1K/2K selector.
- `electron/main/services/image-tasks/stickerInstructionPrompt.ts` — deterministic sticker prompt builder.
- `electron/main/services/image-tasks/generatedImageDimensions.ts` — actual output dimension inspection.
- Focused tests beside each new unit.

**Modify:**

- `src/components/StickerProductRatioSelect.tsx`, `StickerGen.tsx`, `StickerParameterFields.tsx`, `FeatureWorkspaceLayout.tsx` — UI and request wiring.
- `src/features/tasks/applyStickerRestore.ts` — new fields and legacy migration.
- `src/shared/domain/imageFeatureApi.ts`, `imageTaskPlan.ts`, `stickerPrompts.ts` — request, plan, and strategy contracts.
- `electron/main/services/image-tasks/modelGateway.ts`, `protocolClients.ts`, `instructionPrompt.ts`, `imageTaskExecutor.ts`, `imageTaskArtifactStore.ts` — protocol, prompt, and result handling.
- `docs/ai-image-feature-api.md`, `docs/ai-image-system-prompts.md` — public behavior.

## Task 1: Canonical sticker output specification

**Files:**
- Create: `src/shared/domain/stickerOutputSpec.ts`
- Create: `src/shared/domain/__tests__/stickerOutputSpec.test.ts`
- Modify: `src/shared/domain/imageFeatureApi.ts`
- Test: `src/shared/domain/__tests__/imageFeatureApi.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeStickerAspectRatio, resolveStickerOutputSpec } from '../stickerOutputSpec';

describe('stickerOutputSpec', () => {
  it.each([
    ['1:1', '1K', 1024, 1024],
    ['3:2', '1K', 1024, 688],
    ['9:12', '1K', 768, 1024],
    ['21:5', '1K', 1024, 240],
    ['3:2', '2K', 2048, 1360],
  ] as const)('resolves %s at %s', (aspectRatio, outputQuality, width, height) => {
    expect(resolveStickerOutputSpec(aspectRatio, outputQuality)).toMatchObject({ aspectRatio, outputQuality, width, height });
  });

  it('normalizes decimals and rejects invalid or extreme ratios', () => {
    expect(normalizeStickerAspectRatio(' 2.5 : 1 ')).toBe('2.5:1');
    expect(() => normalizeStickerAspectRatio('wide')).toThrow('产品比例格式应为“宽:高”');
    expect(() => normalizeStickerAspectRatio('1:0')).toThrow('产品比例必须大于 0');
    expect(() => resolveStickerOutputSpec('100:1', '1K')).toThrow('短边不能小于 16 像素');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails because the module is missing**

Run: `npx -y pnpm@10 exec vitest run src/shared/domain/__tests__/stickerOutputSpec.test.ts`

Expected: FAIL resolving `../stickerOutputSpec`.

- [ ] **Step 3: Implement the pure sizing module**

```ts
export const STICKER_OUTPUT_QUALITIES = ['1K', '2K'] as const;
export type StickerOutputQuality = typeof STICKER_OUTPUT_QUALITIES[number];
export const DEFAULT_STICKER_OUTPUT_QUALITY: StickerOutputQuality = '1K';

export interface ResolvedStickerOutputSpec {
  aspectRatio: string;
  outputQuality: StickerOutputQuality;
  width: number;
  height: number;
  size: `${number}x${number}`;
}

export function isStickerOutputQuality(value: unknown): value is StickerOutputQuality {
  return STICKER_OUTPUT_QUALITIES.includes(value as StickerOutputQuality);
}

export function normalizeStickerAspectRatio(value: string) {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!match) throw new Error('产品比例格式应为“宽:高”');
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('产品比例必须大于 0');
  }
  return `${width}:${height}`;
}

export function resolveStickerOutputSpec(
  input: string,
  outputQuality: StickerOutputQuality = DEFAULT_STICKER_OUTPUT_QUALITY,
): ResolvedStickerOutputSpec {
  if (!isStickerOutputQuality(outputQuality)) throw new Error('清晰度必须是 1K 或 2K');
  const aspectRatio = normalizeStickerAspectRatio(input);
  const [rw, rh] = aspectRatio.split(':').map(Number);
  const longEdge = outputQuality === '1K' ? 1024 : 2048;
  const rawShort = longEdge * Math.min(rw, rh) / Math.max(rw, rh);
  const shortEdge = Math.round(rawShort / 16) * 16;
  if (rawShort < 16 || shortEdge < 16) throw new Error('产品比例过于极端，短边不能小于 16 像素');
  const width = rw >= rh ? longEdge : shortEdge;
  const height = rw >= rh ? shortEdge : longEdge;
  return { aspectRatio, outputQuality, width, height, size: `${width}x${height}` };
}
```

Add `outputQuality?: StickerOutputQuality` to `ImageTaskRequest`; keep `productRatio` and `logoText` marked deprecated for restore-only compatibility. Reject non-`1K`/`2K` values in `validateImageTaskRequest`.

- [ ] **Step 4: Run tests and commit**

Run: `npx -y pnpm@10 exec vitest run src/shared/domain/__tests__/stickerOutputSpec.test.ts src/shared/domain/__tests__/imageFeatureApi.test.ts`

Expected: PASS.

```powershell
git add src/shared/domain/stickerOutputSpec.ts src/shared/domain/__tests__/stickerOutputSpec.test.ts src/shared/domain/imageFeatureApi.ts src/shared/domain/__tests__/imageFeatureApi.test.ts
git commit -m "feat: add deterministic sticker output specs"
```

## Task 2: Capacity normalization

**Files:**
- Create: `src/shared/domain/stickerCapacity.ts`
- Create: `src/shared/domain/__tests__/stickerCapacity.test.ts`

- [ ] **Step 1: Write failing conversion tests**

```ts
expect(normalizeStickerCapacity('100 ml')).toEqual({ labelText: 'NET: 100ML / 3.38 FL.OZ' });
expect(normalizeStickerCapacity('100g')).toEqual({ labelText: 'NET: 100G / 3.53 OZ' });
expect(normalizeStickerCapacity('6 pieces')).toEqual({ labelText: 'NET: 6 PIECES' });
expect(normalizeStickerCapacity('family pack')).toEqual({
  labelText: 'NET: FAMILY PACK',
  warning: '无法自动换算为 ML/FL.OZ 或 G/OZ，请确认标签规格文案',
});
```

- [ ] **Step 2: Run `npx -y pnpm@10 exec vitest run src/shared/domain/__tests__/stickerCapacity.test.ts`**

Expected: FAIL resolving the new module.

- [ ] **Step 3: Implement `normalizeStickerCapacity`**

Use `1 US FL.OZ = 29.5735 ML` and `1 OZ = 28.3495 G`; round imperial values to two decimals, preserve explicit dual units, normalize count units to `PIECES`, and return the exact warning above for unknown formats.

```ts
export interface NormalizedStickerCapacity { labelText: string; warning?: string }
const concise = (value: number) => Number(value.toFixed(2)).toString();

export function normalizeStickerCapacity(input: string): NormalizedStickerCapacity | undefined {
  const raw = input.trim();
  if (!raw) return undefined;
  const upper = raw.toUpperCase().replace(/^NET:\s*/, '').replace(/\s+/g, ' ');
  const metric = upper.match(/^(\d+(?:\.\d+)?)\s*(ML|G)$/);
  if (metric) {
    const amount = Number(metric[1]);
    const volume = metric[2] === 'ML';
    const imperial = amount / (volume ? 29.5735 : 28.3495);
    return { labelText: `NET: ${concise(amount)}${metric[2]} / ${concise(imperial)} ${volume ? 'FL.OZ' : 'OZ'}` };
  }
  const count = upper.match(/^(\d+(?:\.\d+)?)\s*(PIECES?|PCS?)$/);
  if (count) return { labelText: `NET: ${concise(Number(count[1]))} PIECES` };
  if (/^\d+(?:\.\d+)?\s*(ML|G)\s*\/\s*\d+(?:\.\d+)?\s*(FL\.OZ|OZ)$/.test(upper)) {
    return { labelText: `NET: ${upper.replace(/\s+/g, ' ')}` };
  }
  return { labelText: `NET: ${upper}`, warning: '无法自动换算为 ML/FL.OZ 或 G/OZ，请确认标签规格文案' };
}
```

- [ ] **Step 4: Run the test and commit**

Expected: PASS.

```powershell
git add src/shared/domain/stickerCapacity.ts src/shared/domain/__tests__/stickerCapacity.test.ts
git commit -m "feat: normalize sticker capacity copy"
```

## Task 3: Product-ratio and quality controls

**Files:**
- Modify: `src/shared/view/stickerProductRatioOptions.ts`
- Modify: `src/components/StickerProductRatioSelect.tsx`
- Create: `src/components/StickerOutputQualitySelect.tsx`
- Create: `src/components/__tests__/StickerOutputControls.test.tsx`
- Modify: `src/components/FeatureParameterPanels.tsx`

- [ ] **Step 1: Write failing component tests**

```tsx
render(<StickerProductRatioSelect value="auto" outputQuality="1K" onChange={vi.fn()} />);
fireEvent.click(screen.getByRole('button', { name: /产品比例/ }));
expect(screen.getByRole('option', { name: /罐子.*21:5/ })).toBeInTheDocument();
expect(screen.getByRole('option', { name: /高罐子.*21:10/ })).toBeInTheDocument();
expect(screen.getByRole('option', { name: /瓶装.*9:12/ })).toBeInTheDocument();
expect(screen.getByRole('option', { name: /自定义比例/ })).toBeInTheDocument();
expect(screen.queryByRole('option', { name: /16:9/ })).not.toBeInTheDocument();

fireEvent.click(screen.getByRole('option', { name: /自定义比例/ }));
fireEvent.change(screen.getByLabelText('比例宽'), { target: { value: '3' } });
fireEvent.change(screen.getByLabelText('比例高'), { target: { value: '2' } });
expect(screen.getByText(/1024 × 688 px/)).toBeInTheDocument();
```

Add a second test that renders `StickerOutputQualitySelect` with `1K`, asserts `aria-pressed="true"`, clicks `2K`, and expects `onChange('2K')`.

- [ ] **Step 2: Run `npx -y pnpm@10 exec vitest run src/components/__tests__/StickerOutputControls.test.tsx`**

Expected: FAIL because the quality component and custom-ratio UI do not exist.

- [ ] **Step 3: Keep only product presets**

Replace the product option module with:

```ts
export const STICKER_PRODUCT_RATIO_OPTIONS = [
  { value: '21:5', label: '罐子' },
  { value: '21:10', label: '高罐子' },
  { value: '9:12', label: '瓶装' },
] as const;

export function isStickerProductRatioPreset(value: string) {
  return STICKER_PRODUCT_RATIO_OPTIONS.some((option) => option.value === value);
}
```

Remove its legacy exact-size map; Task 1 is the only sizing authority.

- [ ] **Step 4: Implement the controls**

`StickerProductRatioSelect` must accept:

```ts
interface Props {
  value: string;
  outputQuality: StickerOutputQuality;
  resolvedAutoRatio?: string;
  onChange: (value: string) => void;
  onValidationChange?: (message?: string) => void;
  id?: string;
}
```

Its list must contain only `auto`, the three product presets, and `__custom__`. The custom panel owns width/height inputs, calls `normalizeStickerAspectRatio`, reports inline errors, calls `onChange('W:H')`, and renders:

```tsx
<p className="mt-2 text-[11px] text-muted-foreground">
  {`${spec.aspectRatio} · ${spec.outputQuality} → ${spec.width} × ${spec.height} px`}
</p>
```

Create the quality control:

```tsx
export default function StickerOutputQualitySelect({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <span className="ui-label">清晰度</span>
      <div className="grid h-9 grid-cols-2 rounded-md border border-input p-0.5">
        {(['1K', '2K'] as const).map((quality) => (
          <button key={quality} type="button" aria-label={quality}
            aria-pressed={value === quality} onClick={() => onChange(quality)}>
            {quality}
          </button>
        ))}
      </div>
    </div>
  );
}
```

Change the basic-panel description to `产品比例、清晰度与生成数量`.

- [ ] **Step 5: Run tests and commit**

Run: `npx -y pnpm@10 exec vitest run src/components/__tests__/StickerOutputControls.test.tsx`

Expected: PASS.

```powershell
git add src/shared/view/stickerProductRatioOptions.ts src/components/StickerProductRatioSelect.tsx src/components/StickerOutputQualitySelect.tsx src/components/__tests__/StickerOutputControls.test.tsx src/components/FeatureParameterPanels.tsx
git commit -m "feat: add sticker ratio and quality controls"
```

## Task 4: Wire controls, exact auto ratios, brand, and capacity previews

**Files:**
- Modify: `src/lib/aspectRatioFromImage.ts`
- Modify: `src/lib/__tests__/aspectRatioFromImage.test.ts`
- Modify: `src/components/FeatureWorkspaceLayout.tsx`
- Modify: `src/components/StickerParameterFields.tsx`
- Modify: `src/components/StickerGen.tsx`
- Modify: `src/components/__tests__/StickerGen.test.tsx`

- [ ] **Step 1: Write failing request-shape tests**

```tsx
it('submits one ratio, defaults to 1K, and omits legacy fields', async () => {
  render(<StickerGen restoredTask={createStickerReplicaTask()} />);
  fireEvent.click(document.getElementById('copy-product-ratio-select')!);
  fireEvent.click(screen.getByRole('option', { name: /罐子.*21:5/ }));
  fireEvent.click(document.getElementById('submit-sticker-copy')!);
  await waitFor(() => expect(submitMany).toHaveBeenCalled());
  const request = (submitMany.mock.calls[0][0] as ImageTaskRequest[])[0];
  expect(request).toMatchObject({ aspectRatio: '21:5', outputQuality: '1K', brand: 'wkau' });
  expect(request).not.toHaveProperty('productRatio');
  expect(request).not.toHaveProperty('logoText');
});
```

Add these tests:

```tsx
it('submits 2K when selected', async () => {
  render(<StickerGen restoredTask={createStickerReplicaTask()} />);
  fireEvent.click(screen.getByRole('button', { name: '2K' }));
  fireEvent.click(document.getElementById('submit-sticker-copy')!);
  await waitFor(() => expect(submitMany).toHaveBeenCalled());
  expect((submitMany.mock.calls[0][0] as ImageTaskRequest[])[0].outputQuality).toBe('2K');
});

it('previews normalized capacity copy', async () => {
  render(<StickerGen restoredTask={createStickerReplicaTask()} />);
  fireEvent.click(screen.getByText('高级参数'));
  fireEvent.change(document.getElementById('copy-capacity-input')!, { target: { value: '100 ml' } });
  expect(await screen.findByText('NET: 100ML / 3.38 FL.OZ')).toBeInTheDocument();
});

it('disables submission for an extreme custom ratio', () => {
  render(<StickerGen restoredTask={createStickerReplicaTask()} />);
  fireEvent.click(document.getElementById('copy-product-ratio-select')!);
  fireEvent.click(screen.getByRole('option', { name: /自定义比例/ }));
  fireEvent.change(screen.getByLabelText('比例宽'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('比例高'), { target: { value: '1' } });
  expect(document.getElementById('submit-sticker-copy')).toBeDisabled();
  expect(screen.getByText(/短边不能小于 16 像素/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused tests and confirm the old state/request shape fails**

Run: `npx -y pnpm@10 exec vitest run src/lib/__tests__/aspectRatioFromImage.test.ts src/components/__tests__/StickerGen.test.tsx`

Expected: FAIL because StickerGen still renders two ratio controls and submits legacy fields.

- [ ] **Step 3: Return exact source ratios**

```ts
export async function inferStickerSourceAspectRatio(filePath: string): Promise<string> {
  const { width, height } = await loadImageDimensions(toDisplaySrc(filePath));
  return formatAspectRatio(width, height);
}
```

Delete nearest-general-preset behavior. Keep `formatAspectRatio(700, 500) === '7:5'` under test.

- [ ] **Step 4: Replace StickerGen state and request wiring**

For each tab retain one ratio and one quality:

```ts
const [copyAspectRatio, setCopyAspectRatio] = useState('auto');
const [copyOutputQuality, setCopyOutputQuality] = useState<StickerOutputQuality>('1K');
```

Repeat for variation and original. Delete the three `*ProductRatio` states and `copyLogoText`; initialize `copyBrand` to `DEFAULT_STICKER_BRAND`.

Resolve auto before submission:

```ts
async function resolveStickerRatio(selected: string, path?: string, region?: RegionInput | null) {
  if (selected !== 'auto') return normalizeStickerAspectRatio(selected);
  if (region && region.width > 0 && region.height > 0) return formatAspectRatio(region.width, region.height);
  if (path) return inferStickerSourceAspectRatio(path);
  return '1:1';
}
```

Each request submits `aspectRatio` and `outputQuality`, never `productRatio` or `logoText`. Replica brand is `copyBrand.trim() || DEFAULT_STICKER_BRAND`. Original auto uses its style reference ratio when present and falls back to `1:1`.

Render product ratio, quality, and count for each tab. Keep variation direction prominent in a `sm:col-span-3` row above its three output controls.

- [ ] **Step 5: Enforce inline validation and capacity preview**

Add optional `submitDisabled` to `FeatureWorkspaceLayout` and combine it with `isSubmitting` for the button's disabled state. Pass the active ratio error from StickerGen.

In `StickerParameterFields`, call `normalizeStickerCapacity(capacity)` and render its `labelText` under the capacity input; render `warning` in amber. Remove the separate “Logo 文字” field from replica advanced parameters, but keep Logo image upload.

- [ ] **Step 6: Run focused tests and commit**

Run: `npx -y pnpm@10 exec vitest run src/lib/__tests__/aspectRatioFromImage.test.ts src/components/__tests__/StickerOutputControls.test.tsx src/components/__tests__/StickerGen.test.tsx`

Expected: PASS.

```powershell
git add src/lib/aspectRatioFromImage.ts src/lib/__tests__/aspectRatioFromImage.test.ts src/components/FeatureWorkspaceLayout.tsx src/components/StickerParameterFields.tsx src/components/StickerGen.tsx src/components/__tests__/StickerGen.test.tsx
git commit -m "feat: wire sticker output settings into generation"
```

## Task 5: Restore new fields and migrate old tasks

**Files:**
- Modify: `src/features/tasks/applyStickerRestore.ts`
- Create: `src/features/tasks/__tests__/applyStickerRestore.test.ts`

- [ ] **Step 1: Write failing restore tests**

```ts
it('restores a new custom ratio and 2K quality', () => {
  const restored = applyStickerRestore(task({
    feature: 'sticker_original', aspectRatio: '7:10', outputQuality: '2K', brand: 'WKUA',
  }));
  expect(restored).toMatchObject({
    subTab: 'original', originalAspectRatio: '7:10', originalOutputQuality: '2K', originalBrand: 'WKUA',
  });
});

it('migrates legacy product ratio and logo text', () => {
  const restored = applyStickerRestore(task({
    feature: 'sticker_replica', aspectRatio: 'auto', productRatio: '21:10', logoText: 'LEGACY',
    images: [{ role: 'source', path: '/input.png' }],
  }));
  expect(restored).toMatchObject({ copyAspectRatio: '21:10', copyOutputQuality: '1K', copyBrand: 'LEGACY' });
  expect(restored).not.toHaveProperty('copyProductRatio');
  expect(restored).not.toHaveProperty('copyLogoText');
});

function task(request: ImageTaskRequest): TaskRecord {
  return {
    taskId: 'task-1', batchId: 'batch-1', category: '贴纸', feature: '贴纸', status: 'Pending',
    imports: [], outputs: [], request,
    createdAt: '2026-07-13T00:00:00.000Z', updatedAt: '2026-07-13T00:00:00.000Z',
  };
}
```

- [ ] **Step 2: Run `npx -y pnpm@10 exec vitest run src/features/tasks/__tests__/applyStickerRestore.test.ts`**

Expected: FAIL on the old restore state shape.

- [ ] **Step 3: Implement migration helpers**

```ts
function restoredRatio(request: ImageTaskRequest) {
  const explicit = request.aspectRatio?.trim();
  if (explicit && explicit !== 'auto') return explicit;
  if (request.productRatio && isStickerProductRatioPreset(request.productRatio)) return request.productRatio;
  return explicit || 'auto';
}

function restoredQuality(request: ImageTaskRequest): StickerOutputQuality {
  return isStickerOutputQuality(request.outputQuality) ? request.outputQuality : '1K';
}
```

Remove `*ProductRatio` and `copyLogoText` from `StickerRestoreState`; add one quality per tab. Restore replica brand using `structured.brand || request.logoText || DEFAULT_STICKER_BRAND`.

- [ ] **Step 4: Run restore and StickerGen tests, then commit**

Run: `npx -y pnpm@10 exec vitest run src/features/tasks/__tests__/applyStickerRestore.test.ts src/components/__tests__/StickerGen.test.tsx`

Expected: PASS.

```powershell
git add src/features/tasks/applyStickerRestore.ts src/features/tasks/__tests__/applyStickerRestore.test.ts src/components/StickerGen.tsx src/components/__tests__/StickerGen.test.tsx
git commit -m "feat: migrate legacy sticker output settings"
```

## Task 6: Carry exact specs through plans and protocols

**Files:**
- Modify: `src/shared/domain/imageTaskPlan.ts`
- Modify: `src/shared/domain/__tests__/imageTaskPlan.test.ts`
- Modify: `electron/main/services/image-tasks/modelGateway.ts`
- Modify: `electron/main/services/image-tasks/protocolClients.ts`
- Modify: `electron/main/services/image-tasks/__tests__/modelGateway.test.ts`
- Modify: `electron/main/services/image-tasks/__tests__/protocolClients.test.ts`
- Modify: `electron/main/services/image-tasks/imageTaskArtifactStore.ts`
- Modify: `electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts`

- [ ] **Step 1: Write failing plan tests**

```ts
const plan = buildImageTaskPlan({
  feature: 'sticker_original',
  productCategory: 'cleaning sheets',
  aspectRatio: '3:2',
  outputQuality: '2K',
}, config);
expect(plan.outputSpec).toEqual({
  aspectRatio: '3:2', outputQuality: '2K', width: 2048, height: 1360, size: '2048x1360',
});
expect(plan.openaiImageSize).toBe('2048x1360');
```

Keep a separate non-sticker test proving `replace_logo + auto` still maps to `auto`.

- [ ] **Step 2: Write failing protocol tests**

```ts
expect(openai.images.edit).toHaveBeenCalledWith(
  expect.objectContaining({ size: '1024x240' }),
  expect.any(Object),
);

expect(gemini.models.generateContent).toHaveBeenCalledWith(expect.objectContaining({
  config: expect.objectContaining({
    imageConfig: { aspectRatio: '3:2', imageSize: '2K' },
  }),
}));
```

- [ ] **Step 3: Run the plan, gateway, and protocol tests**

Run: `npx -y pnpm@10 exec vitest run src/shared/domain/__tests__/imageTaskPlan.test.ts electron/main/services/image-tasks/__tests__/modelGateway.test.ts electron/main/services/image-tasks/__tests__/protocolClients.test.ts`

Expected: FAIL because the current plan has no `outputSpec` and Gemini sends top-level `aspectRatio`.

- [ ] **Step 4: Resolve sticker specs once in `imageTaskPlan`**

```ts
const stickerFeature = validated.feature.startsWith('sticker_');
const quality = validated.outputQuality ?? DEFAULT_STICKER_OUTPUT_QUALITY;
const outputSpec = stickerFeature && effectiveAspectRatio && effectiveAspectRatio !== 'auto'
  ? resolveStickerOutputSpec(effectiveAspectRatio, quality)
  : undefined;
```

Add `outputSpec?: ResolvedStickerOutputSpec` to `ImageTaskPlan`. Return `outputSpec.aspectRatio` as the sticker output ratio and `outputSpec.size` as `openaiImageSize`. Delete product-ratio priority and hard-coded size imports. Keep the existing non-sticker normalization branch unchanged.

- [ ] **Step 5: Map provider fields correctly**

Add `imageSize?: StickerOutputQuality` to `ModelExecutionClientInput` and set it from `plan.outputSpec?.outputQuality`.

For Gemini, replace top-level `aspectRatio` with:

```ts
...(input.aspectRatio || input.imageSize ? {
  imageConfig: {
    ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
    ...(input.imageSize ? { imageSize: input.imageSize } : {}),
  },
} : {}),
```

Keep uppercase `K`. The installed `@google/genai` declaration exposes `GenerateContentConfig.imageConfig`; the current official image API documents `1K`/`2K` as supported image-size strings.

Wrap sticker execution errors in `modelGateway.ts` without altering non-sticker messages:

```ts
let result: ImageExecutionModelResult;
try {
  result = await client.executeImage(executionInput);
} catch (error) {
  if (!input.plan.outputSpec) throw error;
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(
    `贴纸出图请求失败（${input.plan.executionStage.protocol} · ${input.plan.outputSpec.aspectRatio} · ${input.plan.outputSpec.outputQuality} · ${input.plan.outputSpec.size}）：${detail}`,
  );
}
if (result.images.length === 0) throw new Error('image model returned no usable image output');
return result;
```

Add a gateway test that rejects with `unsupported size` and asserts the enriched message contains protocol, ratio, quality, target size, and the original error.

- [ ] **Step 6: Persist the resolved spec**

Add `outputSpec: input.plan.outputSpec` to the `request.json` plan summary and assert the complete object in `imageTaskArtifactStore.test.ts`.

- [ ] **Step 7: Run focused tests and commit**

Run: `npx -y pnpm@10 exec vitest run src/shared/domain/__tests__/imageTaskPlan.test.ts electron/main/services/image-tasks/__tests__/modelGateway.test.ts electron/main/services/image-tasks/__tests__/protocolClients.test.ts electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts`

Expected: PASS.

```powershell
git add src/shared/domain/imageTaskPlan.ts src/shared/domain/__tests__/imageTaskPlan.test.ts electron/main/services/image-tasks/modelGateway.ts electron/main/services/image-tasks/protocolClients.ts electron/main/services/image-tasks/__tests__/modelGateway.test.ts electron/main/services/image-tasks/__tests__/protocolClients.test.ts electron/main/services/image-tasks/imageTaskArtifactStore.ts electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts
git commit -m "feat: send exact sticker output specs to models"
```

## Task 7: Encode non-conflicting variation strategies

**Files:**
- Modify: `src/shared/domain/stickerPrompts.ts`
- Create: `src/shared/domain/__tests__/stickerPrompts.test.ts`
- Modify: `src/shared/domain/imageFeatureApi.ts`
- Modify: `src/shared/domain/__tests__/imageFeatureApi.test.ts`
- Modify: `src/shared/domain/imageTaskPlan.ts`
- Modify: `src/shared/domain/__tests__/imageTaskPlan.test.ts`
- Modify: `electron/main/services/image-tasks/protocolClients.ts`
- Modify: `electron/main/services/image-tasks/__tests__/protocolClients.test.ts`
- Modify: `electron/main/services/image-tasks/imageTaskArtifactStore.ts`
- Modify: `electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts`

- [ ] **Step 1: Write failing strategy tests**

```ts
for (const strategy of STICKER_VARIATION_DIRECTIONS) {
  expect(strategy.change.length).toBeGreaterThan(0);
  expect(strategy.preserve).toContain('brand');
  expect(strategy.forbid.length).toBeGreaterThan(0);
  expect(['low', 'high']).toContain(strategy.inputFidelity);
}
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

- [ ] **Step 2: Run `npx -y pnpm@10 exec vitest run src/shared/domain/__tests__/stickerPrompts.test.ts`**

Expected: FAIL because directions currently expose only one loose prompt string.

- [ ] **Step 3: Replace direction records with contracts**

```ts
export interface StickerVariationStrategy {
  value: 'product' | 'color' | 'reverse' | 'geometry' | 'layout' | 'background' | 'fusion' | 'key-element';
  label: string;
  change: readonly string[];
  preserve: readonly string[];
  forbid: readonly string[];
  inputFidelity: 'low' | 'high';
}
```

Use these fidelity values from the approved design:

| Direction | Fidelity |
|---|---|
| product | low |
| color | high |
| reverse | low |
| geometry | low |
| layout | low |
| background | high |
| fusion | low |
| key-element | high |

Use these exact contracts:

| Direction | Change | Preserve | Forbid |
|---|---|---|---|
| product | product name, claims, efficacy/product graphics, information hierarchy | brand, registered mark, commercial design system | retaining the old product identity, unrelated categories |
| color | primary/secondary palette, contrast, color-block colors | brand, layout, visible copy, graphic positions, capacity | rebuild the layout, single-color filter, reduced legibility |
| reverse | light/dark hierarchy, primary/secondary color roles, visual center | brand, visible copy, product identity | negative-filter effect, mirrored text, broken reading order |
| geometry | internal color blocks, sections, decorative rhythm | brand, visible copy, capacity, main hierarchy | non-rectangular outer contour, moving only one minor block |
| layout | layout, title/claim/graphic/badge/capacity positions and hierarchy | brand, visible copy, product identity, core palette | dropping copy, changing meaning, moving only one minor element |
| background | internal texture, material feeling, decorative background | brand, foreground text structure, capacity, core product information | external scene, container, display stand, 3D background |
| fusion | headline strength, selling-point rhythm, mature category design language | brand, visible copy, product identity, capacity | third-party brands, copied labels, unrelated trend elements |
| key-element | exactly one dominant group such as title container, efficacy graphic, badge, or main illustration | brand, remaining layout, visible copy, palette, capacity | changing multiple regions, turning a local edit into a full redesign |

Add a deterministic resolver for “不指定/智能裂变” so the chosen strategy is auditable:

```ts
export function resolveStickerVariationStrategy(input: {
  direction?: StickerVariationDirection;
  productName?: string;
  sellingPoints?: string[];
  colorScheme?: string;
  colorBlockLayout?: string;
}) {
  const explicit = getStickerVariationDirection(input.direction);
  if (explicit) return explicit;
  if (input.productName?.trim() || input.sellingPoints?.some((value) => value.trim())) {
    return getStickerVariationDirection('product')!;
  }
  if (input.colorScheme?.trim()) return getStickerVariationDirection('color')!;
  if (input.colorBlockLayout?.trim()) return getStickerVariationDirection('layout')!;
  return getStickerVariationDirection('fusion')!;
}
```

Add `resolvedVariationStrategy?: StickerVariationDirection` to `ImageTaskPlan`, set it for `sticker_variation`, persist it in `request.json`, and test that an unspecified request with a color scheme records `color` while an otherwise empty request records `fusion`.

- [ ] **Step 4: Route style references and direction fidelity**

Set `sticker_original.executionImageRoles` to `['style']`.

```ts
if (input.task.feature === 'sticker_variation') {
  return getStickerVariationDirection(input.plan.resolvedVariationStrategy)?.inputFidelity ?? 'low';
}
if (input.task.feature === 'sticker_original' && input.images.some((image) => image.role === 'style')) {
  return 'low';
}
return 'high';
```

Add protocol tests proving color uses high fidelity, layout uses low, and original style reference uses low.

- [ ] **Step 5: Run tests and commit**

Run: `npx -y pnpm@10 exec vitest run src/shared/domain/__tests__/stickerPrompts.test.ts src/shared/domain/__tests__/imageFeatureApi.test.ts electron/main/services/image-tasks/__tests__/protocolClients.test.ts`

Expected: PASS.

```powershell
git add src/shared/domain/stickerPrompts.ts src/shared/domain/__tests__/stickerPrompts.test.ts src/shared/domain/imageFeatureApi.ts src/shared/domain/__tests__/imageFeatureApi.test.ts src/shared/domain/imageTaskPlan.ts src/shared/domain/__tests__/imageTaskPlan.test.ts electron/main/services/image-tasks/protocolClients.ts electron/main/services/image-tasks/__tests__/protocolClients.test.ts electron/main/services/image-tasks/imageTaskArtifactStore.ts electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts
git commit -m "feat: define sticker variation strategy contracts"
```

## Task 8: Deterministic sticker prompt builder

**Files:**
- Create: `electron/main/services/image-tasks/stickerInstructionPrompt.ts`
- Create: `electron/main/services/image-tasks/__tests__/stickerInstructionPrompt.test.ts`
- Modify: `electron/main/services/image-tasks/instructionPrompt.ts`
- Modify: `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`
- Modify: `src/shared/domain/imageFeatureApi.ts`
- Modify: `src/shared/domain/__tests__/imageFeatureApi.test.ts`

- [ ] **Step 1: Write failing shared/mode/direction prompt tests**

```ts
const prompt = buildStickerInstructionPrompt({
  feature: 'sticker_original',
  brand: 'WKUA',
  capacity: '100 ml',
  productCategory: 'car care',
  sellingPoints: ['fast cleaning'],
});
expect(prompt).toContain('[NON-NEGOTIABLE OUTPUT CONTRACT]');
expect(prompt).toContain('one front-facing flat 2D rectangular label');
expect(prompt).toContain('WKUA®');
expect(prompt).toContain('pure white');
expect(prompt).toContain('NET: 100ML / 3.38 FL.OZ');
expect(prompt).toContain('All visible text must be natural English');
expect(prompt).toContain('reduce the main title size by about 20%');
expect(prompt).toContain('wide left and right safety margins');
expect(prompt).toContain('no bottle, jar, box, container, scene, mockup, or 3D packaging');
```

Add mode tests: replica contains de-perspective/unwrap and “do not redesign fields the user did not override”; original contains “do not copy the reference layout or wording”. Add a table-driven test for all eight strategy records. Assert color prompts do not contain `make a clearly different layout` and each common hard rule occurs once.

- [ ] **Step 2: Run `npx -y pnpm@10 exec vitest run electron/main/services/image-tasks/__tests__/stickerInstructionPrompt.test.ts`**

Expected: FAIL resolving the new builder.

- [ ] **Step 3: Implement fixed prompt sections**

Create these constants and mode rules in `stickerInstructionPrompt.ts`:

```ts
const COMMON_RULES = [
  'Produce exactly one front-facing flat 2D rectangular label that fills and centers within the canvas.',
  'The outer contour must have four 90-degree corners and straight horizontal or vertical edges.',
  'Output only the label artwork: no bottle, jar, box, container, scene, display stand, hand, collage, mockup, or 3D packaging.',
  'Render the brand in pure white with no gradient, outline, shadow, texture, or 3D treatment; place ® at its upper-right and center the brand horizontally.',
  'All visible text must be natural English. Do not render Chinese, misspellings, garbled glyphs, pseudo-text, duplicated copy, or meaningless characters.',
  'Keep title, brand, selling points, subtitle, net content, and decorative graphics complete.',
  'Adapt font size, tracking, leading, and wrapping to English copy; reduce the main title size by about 20%.',
  'Center the complete information group and maintain wide left and right safety margins; nothing may touch, clip, or blur at the edges.',
] as const;
```

The builder must output sections in this priority order:

```ts
return [
  '[NON-NEGOTIABLE OUTPUT CONTRACT]', ...COMMON_RULES,
  '[MODE CONTRACT]', ...modeRules(request),
  ...(strategy ? ['[VARIATION STRATEGY]',
    `Strategy: ${strategy.label}`,
    `CHANGE: ${strategy.change.join('; ')}`,
    `PRESERVE: ${strategy.preserve.join('; ')}`,
    `FORBID: ${strategy.forbid.join('; ')}`] : []),
  '[STRUCTURED CONTENT — OVERRIDES THE REFERENCE]', ...structuredFields(request),
  ...(request.prompt?.trim() ? ['[LOW-PRIORITY USER NOTES]', request.prompt.trim()] : []),
  '[FINAL CHECK]',
  'Reject any result that violates the output contract, omits required copy, changes preserved fields, or adds a product container/background.',
].join('\n');
```

`structuredFields` resolves brand as `brand || legacy logoText || wkau`, appends `®`, uses `normalizeStickerCapacity`, and includes non-empty product name, category, selling points, material, style, color, and layout fields. Variation uses `resolveStickerVariationStrategy(request)` so an unspecified direction still renders one named, recorded strategy rather than a vague blend.

Replica mode preserves non-overridden source content and unwraps perspective/curvature. Variation mode obeys exactly the explicit or deterministically resolved strategy. Original mode builds a new hierarchy, treats style images as visual-language reference only, and forbids unsupported certifications or claims.

- [ ] **Step 4: Dispatch sticker tasks before generic assembly**

```ts
export function buildExecutionPrompt(request: ImageTaskRequest, mainPrompt: string) {
  if (request.feature.startsWith('sticker_')) return buildStickerInstructionPrompt(request);
  // retain the existing non-sticker path below
}
```

Delete sticker-only suffix constants and finalizer branches from `instructionPrompt.ts`; retain remove-product and main-image logic. Make sticker feature `mainPrompt` values concise identities because the dedicated builder owns all execution rules.

- [ ] **Step 5: Run prompt tests and commit**

Run: `npx -y pnpm@10 exec vitest run electron/main/services/image-tasks/__tests__/stickerInstructionPrompt.test.ts electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts src/shared/domain/__tests__/imageFeatureApi.test.ts`

Expected: PASS with no duplicated or contradictory sticker rules.

```powershell
git add electron/main/services/image-tasks/stickerInstructionPrompt.ts electron/main/services/image-tasks/__tests__/stickerInstructionPrompt.test.ts electron/main/services/image-tasks/instructionPrompt.ts electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts src/shared/domain/imageFeatureApi.ts src/shared/domain/__tests__/imageFeatureApi.test.ts
git commit -m "feat: rebuild sticker prompts as strict contracts"
```

## Task 9: Output dimension inspection and warnings

**Files:**
- Create: `electron/main/services/image-tasks/generatedImageDimensions.ts`
- Create: `electron/main/services/image-tasks/__tests__/generatedImageDimensions.test.ts`
- Modify: `electron/main/services/image-tasks/imageTaskExecutor.ts`
- Modify: `electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts`
- Modify: `electron/main/services/image-tasks/imageTaskArtifactStore.ts`
- Modify: `electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts`

- [ ] **Step 1: Write a failing test with mocked `nativeImage`**

```ts
const getSize = vi.fn(() => ({ width: 1264, height: 848 }));
vi.mock('electron', () => ({
  nativeImage: { createFromBuffer: vi.fn(() => ({ isEmpty: () => false, getSize })) },
}));
expect(inspectGeneratedImage(new Uint8Array([1, 2, 3]))).toEqual({ width: 1264, height: 848 });
expect(outputDimensionWarning(
  { width: 1264, height: 848 },
  { width: 1024, height: 688 },
)).toBe('模型返回尺寸 1264x848，与目标尺寸 1024x688 不一致');
```

- [ ] **Step 2: Run `npx -y pnpm@10 exec vitest run electron/main/services/image-tasks/__tests__/generatedImageDimensions.test.ts`**

Expected: FAIL resolving the new module.

- [ ] **Step 3: Implement inspection and comparison**

```ts
import { nativeImage } from 'electron';

interface Size { width: number; height: number }

export function inspectGeneratedImage(buffer: Uint8Array) {
  const image = nativeImage.createFromBuffer(Buffer.from(buffer));
  if (image.isEmpty()) return undefined;
  const { width, height } = image.getSize();
  return width > 0 && height > 0 ? { width, height } : undefined;
}

export function outputDimensionWarning(actual?: Size, expected?: Size) {
  if (!actual || !expected || (actual.width === expected.width && actual.height === expected.height)) return undefined;
  return `模型返回尺寸 ${actual.width}x${actual.height}，与目标尺寸 ${expected.width}x${expected.height} 不一致`;
}
```

- [ ] **Step 4: Attach dimensions and warnings**

Add optional `width`/`height` to `GeneratedImageOutput`. Inspect each result before saving; assign actual dimensions, append the warning when it differs from `plan.outputSpec`, and log target/actual values. Include width/height in each `result-1.json` output item. Tests must cover matching, mismatching, and unreadable images.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx -y pnpm@10 exec vitest run electron/main/services/image-tasks/__tests__/generatedImageDimensions.test.ts electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts`

Expected: PASS.

```powershell
git add electron/main/services/image-tasks/generatedImageDimensions.ts electron/main/services/image-tasks/__tests__/generatedImageDimensions.test.ts electron/main/services/image-tasks/imageTaskExecutor.ts electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts electron/main/services/image-tasks/imageTaskArtifactStore.ts electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts
git commit -m "feat: validate generated sticker dimensions"
```

## Task 10: Documentation and end-to-end verification

**Files:**
- Modify: `docs/ai-image-feature-api.md`
- Modify: `docs/ai-image-system-prompts.md`
- Verify: all changed source and tests

- [ ] **Step 1: Update docs with the final request contract**

Document `aspectRatio?: string`, `outputQuality?: '1K' | '2K'`, the three product presets, custom input, 16-alignment formula, legacy `productRatio` migration, shared prompt rules, and all eight strategy contracts. State explicitly that color preserves layout while layout variation changes it.

- [ ] **Step 2: Run focused sticker tests**

```powershell
npx -y pnpm@10 exec vitest run src/shared/domain/__tests__/stickerOutputSpec.test.ts src/shared/domain/__tests__/stickerCapacity.test.ts src/shared/domain/__tests__/stickerPrompts.test.ts src/shared/domain/__tests__/imageFeatureApi.test.ts src/shared/domain/__tests__/imageTaskPlan.test.ts src/lib/__tests__/aspectRatioFromImage.test.ts src/components/__tests__/StickerOutputControls.test.tsx src/components/__tests__/StickerGen.test.tsx src/features/tasks/__tests__/applyStickerRestore.test.ts electron/main/services/image-tasks/__tests__/stickerInstructionPrompt.test.ts electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts electron/main/services/image-tasks/__tests__/modelGateway.test.ts electron/main/services/image-tasks/__tests__/protocolClients.test.ts electron/main/services/image-tasks/__tests__/generatedImageDimensions.test.ts electron/main/services/image-tasks/__tests__/imageTaskExecutor.test.ts electron/main/services/image-tasks/__tests__/imageTaskArtifactStore.test.ts
```

Expected: every listed test file PASS.

- [ ] **Step 3: Run repository verification**

```powershell
npx -y pnpm@10 run lint
npx -y pnpm@10 run build
npx -y pnpm@10 run build:electron
```

Expected: all commands exit 0.

- [ ] **Step 4: Inspect the Electron UI**

Run `npx -y pnpm@10 run dev:electron`. Verify each tab shows product ratio, 1K/2K, and count; only `21:5`, `21:10`, `9:12`, auto, and custom exist; custom `3:2 + 1K` previews `1024 × 688`; invalid input disables submit; replica has one `wkau` brand field; `100 ml` previews the normalized NET copy; all eight variation directions remain visible. Verify the long-lived command by port/process state, then clean up only the processes started by this check.

- [ ] **Step 5: Run a real model smoke task when credentials exist**

Create the uncommitted file `tests/output/requests/sticker-output-spec-smoke.zh.json` with:

```json
{
  "feature": "sticker_replica",
  "prompt": "Keep the red, black, and white industrial design; use a flat front-facing label only.",
  "brand": "wkau",
  "productName": "Belt Silencer Pro",
  "capacity": "120ML",
  "colorScheme": "red, black, and white industrial style",
  "aspectRatio": "3:2",
  "outputQuality": "1K",
  "images": [
    {
      "role": "source",
      "path": "tests/fixtures/images/img_4.png",
      "mimeType": "image/png"
    }
  ]
}
```

Run:

```powershell
npx -y pnpm@10 run smoke:image-task -- --request tests/output/requests/sticker-output-spec-smoke.zh.json --run-dir tests/output/sticker-output-spec-smoke
```

Verify `request.json` records `1024x688`, `image-instruction.txt` contains each shared rule once, the image is a flat label, and result metadata records actual dimensions. If credentials are unavailable, record the smoke test as not run rather than passing.

- [ ] **Step 6: Commit documentation only**

```powershell
git add docs/ai-image-feature-api.md docs/ai-image-system-prompts.md
git commit -m "docs: document sticker output and prompt contracts"
```

Never stage `skills-lock.json`, `tests/package-scripts.test.ts`, smoke outputs, credentials, or unrelated user changes.

## Completion gate

Invoke `superpowers:verification-before-completion` for fresh focused-test, TypeScript, Vite, Electron, and optional real-smoke evidence. Then invoke `superpowers:requesting-code-review`. Only after both gates pass should `superpowers:finishing-a-development-branch` offer merge, PR, or cleanup options.
