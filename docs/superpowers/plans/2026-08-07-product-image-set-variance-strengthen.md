# Visual Variance Strengthening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace abstract batch-variation direction text with concrete observable visual-dimension lists, and give collage/grid modes explicit canvas-split structure.

**Architecture:** Update the product-set variant direction helper and multi-scene layout definitions in `instructionPrompt.ts`. Update existing exact prompt tests for new dimension text and new collage/grid structure. No new files, no API/UI changes.

**Tech Stack:** TypeScript, Electron main process, Vitest

---

## File Structure

- Modify: `electron/main/services/image-tasks/instructionPrompt.ts` — replace `PRODUCT_SET_VARIATION_DIRECTIONS`, `buildProductSetVariantDirection`, `multiSceneLayoutLines`.
- Modify: `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts` — update all exact-snapshot tests and dimension assertions.
- Reference: `docs/superpowers/specs/2026-08-07-product-image-set-variance-strengthen-design.md`

### Task 1: Replace Abstract Variance with Concrete Dimensions

**Files:**
- Modify: `electron/main/services/image-tasks/instructionPrompt.ts:237-257, 317-321`
- Test: `electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts`

- [ ] **Step 1: Write failing exact-output tests with new dimension text**

Update the nine exact complete-output cases plus direction-matrix assertions. Each comparison variant must contain at least 3 concrete observable dimensions from the spec (color base, spatial depth, foreground layout, light direction/intensity, problem manifestation). Each multi-scene variant must contain at least 3 concrete dimensions (space type, subject object, observation distance/angle, light ambiance, background complexity). Assert specific concrete phrases:

```
comparison variant 1 `toContain`: ['目标子区域', '前景物体布局', '色彩基调']
comparison variant 2 `toContain`: ['空间深度', '光线方向与强度', '问题表现方式']
comparison variant 3 `toContain`: different concrete dimensions
multiScene variant 1 `toContain`: ['空间类型', '观察距离与角度', '光影氛围']
multiScene variant 2 `toContain`: ['主体对象', '背景复杂度', '空间类型']
```

Assert all old abstract language is absent:
```
not.toContain '使用最典型的目标场景'
not.toContain '使用同类目标场景中的不同子空间或使用位置'
not.toContain '使用同类目标场景中的另一种环境表达'
```

- [ ] **Step 2: Write failing collage/grid structure tests**

Assert new layout lines contain explicit structure:

```
single `toContain`: only scene description, not canvas split
collage `toContain`: '4个面板', '不规则', '边界清晰', '宽高比', '不同面板不得复用同一场景'
grid `toContain`: '2行×2列', '等大小', '分隔线可见', '不同单元格不得复用同一场景'
```

Assert old layout lines absent:
```
not.toContain '一张图组合一组不同目标场景，允许不规则拼贴且各区域边界清晰'
not.toContain '一张图使用规则网格展示一组不同目标场景'
```

- [ ] **Step 3: Run focused tests and observe failure**

```bash
pnpm vitest run electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts
```

Expected: tests fail because production still emits old abstract text.

- [ ] **Step 4: Replace PRODUCT_SET_VARIATION_DIRECTIONS with concrete dimensions**

Replace the three abstract direction entries with six concrete dimension definitions (3 per comparison, 3 per multi-scene). Each entry is a feature-keyed object returning an array of dimension requirement strings. Use `(variantIndex - 1) % 3` to select per-feature.

```
comparison direction 1 lines:
- '改变目标子区域：场景中的核心问题区域从当前位置明显切换到另一处（例如从平面主体切换到边缘或缝隙区域）。'
- '改变前景物体布局：Before/After 两侧的前景辅助物体或道具的位置、密度或类型必须明显不同。'
- '改变色彩基调：主导色温必须从当前基调切换到明显不同的另一基调（例如从暖黄切换到冷白，或从明亮切换到深沉）。'
- '禁止通过轻微调色、只换标题、只移动产品或只换装饰物达到差异。'

comparison direction 2 lines:
- '改变空间深度：画面必须从浅景深切换到深景深，或从平实背景切换到有明显前后层次的深度空间。'
- '改变光线方向与强度：主光源必须从当前方向切换到明显的另一种方向（例如从正面光切换到侧逆光或顶光），阴影区域面积必须明显不同。'
- '改变问题表现方式：Before 的问题状态必须从一种视觉形式切换到另一种（例如从表面污渍切换到结构脏乱、从磨损痕迹切换到褪色变旧），After 必须在同一对象同一区域呈现对应的真实改善。'
```

```
multiScene direction 1 lines:
- '改变空间类型：目标场景的空间类型必须从当前位置明显切换到另一种（例如从室内台面切换到室外地面环境、从明亮空间切换到暗调空间）。'
- '改变观察距离与角度：主体场景的景别和观察角度必须明显变化（例如从近景切换到中远景、或从俯视切换到正视）。'
- '改变光影氛围：光线环境必须从当前氛围明显切换到另一种（例如从均匀商业光切换到强烈方向光、或从白天自然光切换到暖色人工光）。'
```

```
multiScene direction 2 lines:
- '改变主体对象：画面中核心展示的表面或物体必须从一种类型切换到另一种（例如从光滑瓷砖切换到纹理粗糙的木质或石质表面）。'
- '改变背景复杂度：背景环境必须从简单空旷切换到丰富多层次，或从密集杂乱切换到简洁有序，两者不能相同。'
- '改变空间类型：目标场景的空间类型必须从当前位置明显切换到另一种（例如从台面附近切换到墙角转折处、从开阔区域切换到狭窄区域）。'
```

Toggle feature-specific lines by `request.feature`:
- comparison: always append `禁止通过轻微调色...` constraint.
- multiScene: keep existing `仅输出不同的具体目标场景...不得出现产品或人物。`

- [ ] **Step 5: Replace multi-scene layout lines with explicit structure**

```
single: '每张只展示一个完整目标场景，包含可观察的前中后景层次和具体的材质/物体/光影细节；同一批次的不同输出必须使用不同的具体场景。'
collage: '将画布分为 4 个不规则区域作为独立面板，至少包含 2 种不同的宽高比，面板之间必须有清晰可见的边界线或分隔线；每个面板展示一个完整的、与其他面板不同的目标场景；不同面板之间不得选用色调相近或内容雷同的场景；同一批次的不同输出不得复用同一组面板场景组合。'
grid: '将画布划分为 2 行 × 2 列共 4 个等大小单元格，单元格之间必须有清晰可见的分隔线或边框；每个单元格展示一个完整的、与其他单元格不同的目标场景；不得用纯色或相近色调填满所有单元格导致网格边界消失；同一批次的不同输出不得复用同一格场景组合。'
```

- [ ] **Step 6: Run and pass**

```bash
pnpm vitest run electron/main/services/image-tasks/__tests__/instructionPrompt.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Update existing exact complete-output cases (nine cases) and any other failing snapshots**

Adjust all nine exact `toBe(withEnglishOnlyRule(...))` expectations to match the new concrete dimension text and new layout text. Keep existing control, conflict, scene-scope, and English-only assertions intact.

### Task 2: Run Full Verification

**Files:**
- Verify only

- [ ] **Step 1: Full test suite**

```bash
pnpm test
```

Expected: all Vitest files pass.

- [ ] **Step 2: TypeScript check**

```bash
pnpm lint
```

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 3: Builds**

```bash
pnpm build
pnpm build:electron
```

Expected: both succeed.

- [ ] **Step 4: Whitespace**

```bash
git diff --check
```

Expected: no whitespace errors.
