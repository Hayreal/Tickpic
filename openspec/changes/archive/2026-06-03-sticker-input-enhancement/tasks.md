# Tasks for Sticker Input Enhancement

## Phase 1: Sticker Replication (Tab 1: 'copy')
- [x] Add `ImageUploader` for Logo in `parameter-sticker-copy`.
- [x] Add text input for "Product Name" (`copyProductName`).
- [x] Add text input for "Color Scheme" (`copyColorScheme`).
- [x] Add radio buttons for "Aspect Ratio" (9:16, 4:3, 1:1).
- [x] Update state definitions and `runGeneration` to capture/use these new inputs.

## Phase 2: Sticker Variation (Tab 2: 'variation')
- [x] Remove the "Variation Direction" radio button group from `parameter-sticker-variation`.
- [x] Remove `variationDirection` state variable.
- [x] Add text input for "Color Scheme" (`variationColorScheme`).
- [x] Update `runGeneration` logic for variation tab.

## Phase 3: Sticker Original (Tab 3: 'original')
- [x] Replace `originalPrompt` textarea with structured inputs: Category, Brand, Selling Point, Volume, Style.
- [x] Add corresponding state variables for the new structured inputs.
- [x] Remove "Prompt Quick Tags" section.
- [x] Update the Right Side preview header text from "创作预览" to "生成结果" in `original-preview-header`.
- [x] Refactor `runGeneration` to aggregate original inputs into a prompt or structured data object.

## Final Verification
- [x] Verify UI layout and spacing across all tabs.
- [x] Ensure state management is clean and no unused variables remain.
- [x] Test basic generation flow with new inputs.
