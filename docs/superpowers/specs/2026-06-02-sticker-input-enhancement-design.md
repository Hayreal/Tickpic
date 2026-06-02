---
comet_change: sticker-input-enhancement
role: technical-design
canonical_spec: openspec
archived-with: 2026-06-03-sticker-input-enhancement
status: final
---

# Sticker Input Enhancement Design

## Overview
This document details the technical design for enhancing the sticker generation UI. The goal is to provide users with granular control over sticker creation by replacing generic text inputs with structured data fields.

## 1. State Management Updates

### 1.1 Sticker Replication (Tab 1: 'copy')
We will introduce the following state variables:
- `copyLogo`: `ImportBatch | null` - Stores the uploaded logo image.
- `copyProductName`: `string` - Stores the product name.
- `copyColorScheme`: `string` - Stores the desired color scheme (e.g., "Pastel", "Vibrant").
- `copyAspectRatio`: `'9:16' | '4:3' | '1:1'` - Stores the selected aspect ratio, defaulting to `'1:1'`.

### 1.2 Sticker Variation (Tab 2: 'variation')
- `variationColorScheme`: `string` - Stores the desired color scheme.
- *Removal*: `variationDirection` state variable will be removed.

### 1.3 Sticker Original (Tab 3: 'original')
We will replace `originalPrompt` with:
- `originalCategory`: `string` - Product category (e.g., "Skincare").
- `originalBrand`: `string` - Brand name.
- `originalSellingPoint`: `string` - Key selling point.
- `originalVolume`: `string` - Volume/Size (e.g., "50ml").
- `originalStyle`: `string` - Artistic style (e.g., "Minimalist", "Cyberpunk").

## 2. UI Component Implementation

### 2.1 Replication UI
- Add `ImageUploader` component for Logo with `feature="logo"`.
- Add text inputs for Product Name and Color Scheme.
- Add a Radio Group component for Aspect Ratio selection.
- Update `runGeneration` to aggregate these into a structured object or formatted prompt string.

### 2.2 Variation UI
- Remove the `variation-direction-group` div.
- Add a text input for Color Scheme.
- Update `runGeneration` to include `variationColorScheme`.

### 2.3 Original UI
- Replace the `textarea` with a grid or vertical stack of text inputs for Category, Brand, Selling Point, Volume, and Style.
- Remove the "Prompt Quick Tags" section.
- Update the preview header text from "创作预览" to "生成结果".
- Update `runGeneration` to aggregate the new structured inputs.

## 3. Data Flow & Aggregation
When the user clicks "Generate", the `runGeneration` function will aggregate the structured inputs into a single object. For backward compatibility with existing task processing, this object will be serialized into a descriptive string format: `[Category] sticker for [Brand], featuring [Selling Point], [Volume], in [Style] style, colors: [ColorScheme]`.

## 4. Verification Strategy
- **Unit Testing**: Verify that state updates correctly upon user input.
- **UI Testing**: Ensure the new layout is responsive and all elements are accessible.
- **Functional Testing**: Verify that the aggregated prompt/data is correctly passed to the task creation system.
