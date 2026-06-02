---
change: sticker-input-enhancement
design-doc: docs/superpowers/specs/2026-06-02-sticker-input-enhancement-design.md
base-ref: no-commits-yet
archived-with: 2026-06-03-sticker-input-enhancement
---

# Implementation Plan: Sticker Input Enhancement

This plan outlines the steps to implement the structured inputs for the sticker generation tools in `src/components/StickerGen.tsx`.

## Phase 1: Sticker Replication (Tab 1: 'copy')
1.  **State Updates**:
    *   Add state definitions for `copyLogo`, `copyProductName`, `copyColorScheme`, and `copyAspectRatio`.
2.  **UI Implementation**:
    *   Add an `ImageUploader` component for the logo.
    *   Add text inputs for Product Name and Color Scheme.
    *   Add a radio button group for Aspect Ratio (9:16, 4:3, 1:1).
3.  **Logic Updates**:
    *   Update `runGeneration` to aggregate these inputs.

## Phase 2: Sticker Variation (Tab 2: 'variation')
1.  **State Updates**:
    *   Add state definition for `variationColorScheme`.
    *   Remove the `variationDirection` state.
2.  **UI Implementation**:
    *   Remove the "Variation Direction" section.
    *   Add a text input for Color Scheme.
3.  **Logic Updates**:
    *   Update `runGeneration` to include `variationColorScheme`.

## Phase 3: Sticker Original (Tab 3: 'original')
1.  **State Updates**:
    *   Replace `originalPrompt` with state definitions for `originalCategory`, `originalBrand`, `originalSellingPoint`, `originalVolume`, and `originalStyle`.
2.  **UI Implementation**:
    *   Replace the "Design Requirements" textarea with structured inputs.
    *   Remove the "Prompt Quick Tags" section.
    *   Update the Right Preview header to "生成结果".
3.  **Logic Updates**:
    *   Update `runGeneration` to aggregate the new structured inputs into a descriptive string.

## Verification
- Verify that the UI correctly updates state on input changes.
- Verify that the "Generate" button correctly aggregates and dispatches the new data.
- Ensure layout consistency across tabs.
