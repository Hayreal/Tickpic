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
