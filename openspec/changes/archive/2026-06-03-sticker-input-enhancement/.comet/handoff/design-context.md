# Comet Design Handoff

- Change: sticker-input-enhancement
- Phase: design
- Mode: compact
- Context hash: ba6bc39721da6c9198bf9dcb810d77029191987459312c27168a3932504c8dbe

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/sticker-input-enhancement/proposal.md

- Source: openspec/changes/sticker-input-enhancement/proposal.md
- Lines: 1-38
- SHA256: 7361ffb3fcb5de10d162dc0e10cb70bd398348eaa14a67f0de4fb649ce1f1595

```md
# Sticker Generation UI Input Enhancement Proposal

## 1. Problem Statement
The current sticker generation tools lack sufficient granular control. Users cannot specify key design elements like brand identity components (logo, product name), color schemes, or precise output formats directly in the UI. The "Original" sticker creation process relies on a single, unstructured text prompt, making it difficult to ensure consistent quality and specific brand compliance. Additionally, the "Variation" tab contains the "Direction" selector which has been deemed unnecessary for the current workflow.

## 2. Proposed Changes
We propose adding structured input fields to the sticker generation tools in `src/components/StickerGen.tsx`:

### 2.1 Sticker Replication (Tab 1: 'copy')
- Add **Logo** image upload component.
- Add **Product Name** text input field.
- Add **Color Scheme** text input field.
- Add **Aspect Ratio** radio buttons: 9:16, 4:3, 1:1 (defaulting to 1:1).

### 2.2 Sticker Variation (Tab 2: 'variation')
- Remove the "Variation Direction" (裂变方向) radio button section.
- Add **Color Scheme** text input field.

### 2.3 Sticker Original (Tab 3: 'original')
- Replace the single "Design Requirements (Prompt)" textarea with structured inputs:
  - **Product Category** (e.g., Skincare, Beverage)
  - **Brand** (Brand Name)
  - **Selling Point** (e.g., "Long-lasting hydration")
  - **Volume/Size** (e.g., "50ml", "100g")
  - **Style** (e.g., "Minimalist", "Cyberpunk", "Watercolor")
- Remove the "Prompt Quick Tags" section (as structured inputs replace the general prompt).
- Modify the Right Preview panel header from "创作预览" (Creation Preview) to "生成结果" (Generation Result) to match the other tabs.

## 3. Impact Analysis
- **Files Modified**: `src/components/StickerGen.tsx`
- **State Changes**: New state variables needed for all new inputs. Existing `variationDirection` and `originalPrompt` states will be removed/refactored.
- **Dependencies**: No new external dependencies. Uses existing `ImageUploader` component for the Logo upload.

## 4. Success Criteria
- All specified input fields appear and function correctly.
- Form validation (if any) handles the new required/optional states appropriately.
- UI remains responsive and layout adapts correctly to the new elements.
- Right preview panel for "Original" matches the structure of "Copy" and "Variation".
```

## openspec/changes/sticker-input-enhancement/design.md

- Source: openspec/changes/sticker-input-enhancement/design.md
- Lines: 1-42
- SHA256: e3c7eed2e6753d5ae5e6f9e40f72d51d2bb255aa28cac4db67a41968848e9b9a

```md
# Technical Design: Sticker Input Enhancement

## Architecture
The enhancement focuses entirely on the client-side React component `src/components/StickerGen.tsx`. We will extend the existing state management to handle the new granular inputs and refactor the JSX structure to accommodate the new UI elements.

## Component Modifications

### 1. State Management
We will introduce new state hooks for the additional inputs:
- **Copy Tab**: `copyLogo` (for batch/image), `copyProductName`, `copyColorScheme`, `copyAspectRatio`.
- **Variation Tab**: `variationColorScheme`. (Removing `variationDirection`)
- **Original Tab**: `originalCategory`, `originalBrand`, `originalSellingPoint`, `originalVolume`, `originalStyle`. (Removing `originalPrompt`)

### 2. UI/UX Changes

#### Sticker Replication (copy)
- **Layout**: Maintain the vertical flow. Add a new section "Design Elements" below the "Reference Image" uploader.
- **Inputs**:
  - `ImageUploader` for Logo (smaller aspect ratio, e.g., 1:1 square crop).
  - `input` for Product Name (Text).
  - `input` for Color Scheme (Text, placeholder: "e.g., Pastel, High-contrast").
  - Radio group for Aspect Ratio (9:16, 4:3, 1:1).

#### Sticker Variation (variation)
- **Cleanup**: Remove the `variation-direction-group` div and associated buttons.
- **Addition**: Add a "Color Scheme" input field, similar to the copy tab.

#### Sticker Original (original)
- **Form Structure**: Replace the large `textarea` with a structured form grid or vertical stack.
  - Inputs for Category, Brand, Selling Point, Volume, Style.
- **Preview Header**: Change text from "创作预览" to "生成结果" in the `original-preview-header` section.

## Data Flow
1. **Input Capture**: User fills structured fields.
2. **Aggregation**: When "Generate" is clicked, `runGeneration` aggregates these new state values into a structured object (or formatted string) to pass to the backend/task system.
3. **Task Creation**: The `onCreateTask` payload will be updated to include this metadata if the backend supports it, or we format it into a legacy prompt string if strict backward compatibility is needed (assuming prompt aggregation for now).

## Implementation Strategy
1. Add state definitions.
2. Update UI forms for all three tabs.
3. Update `runGeneration` to handle new state.
4. Verify layout consistency across tabs.
```

## openspec/changes/sticker-input-enhancement/tasks.md

- Source: openspec/changes/sticker-input-enhancement/tasks.md
- Lines: 1-26
- SHA256: b6f9f2999cba04290e7c5366c6de10299e8d9049133ebfbab15e6bac53811e42

```md
# Tasks for Sticker Input Enhancement

## Phase 1: Sticker Replication (Tab 1: 'copy')
- [ ] Add `ImageUploader` for Logo in `parameter-sticker-copy`.
- [ ] Add text input for "Product Name" (`copyProductName`).
- [ ] Add text input for "Color Scheme" (`copyColorScheme`).
- [ ] Add radio buttons for "Aspect Ratio" (9:16, 4:3, 1:1).
- [ ] Update state definitions and `runGeneration` to capture/use these new inputs.

## Phase 2: Sticker Variation (Tab 2: 'variation')
- [ ] Remove the "Variation Direction" radio button group from `parameter-sticker-variation`.
- [ ] Remove `variationDirection` state variable.
- [ ] Add text input for "Color Scheme" (`variationColorScheme`).
- [ ] Update `runGeneration` logic for variation tab.

## Phase 3: Sticker Original (Tab 3: 'original')
- [ ] Replace `originalPrompt` textarea with structured inputs: Category, Brand, Selling Point, Volume, Style.
- [ ] Add corresponding state variables for the new structured inputs.
- [ ] Remove "Prompt Quick Tags" section.
- [ ] Update the Right Side preview header text from "创作预览" to "生成结果" in `original-preview-header`.
- [ ] Refactor `runGeneration` to aggregate original inputs into a prompt or structured data object.

## Final Verification
- [ ] Verify UI layout and spacing across all tabs.
- [ ] Ensure state management is clean and no unused variables remain.
- [ ] Test basic generation flow with new inputs.
```

