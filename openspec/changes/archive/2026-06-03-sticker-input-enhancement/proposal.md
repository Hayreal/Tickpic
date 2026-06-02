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
