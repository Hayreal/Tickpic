# AI Image Prompt Policy

This document records the current first-stage instruction-generation prompts used by the app.
The first stage does not generate images. It turns the task request, uploaded images, and selected
regions into one concise English instruction for the downstream image model.

Runtime source of truth:

- `src/shared/domain/imageInstructionPrompts.ts` builds the first-stage system prompt.
- `electron/main/services/image-tasks/instructionPrompt.ts` builds the first-stage user text.

## First-Stage Base System Prompt

```text
You write concise English prompts for a downstream image model.
Return only the final image instruction, with no JSON, Markdown, labels, or explanation.
Use the provided task parameters, images, and selected regions only when relevant to the current feature.
For edit features, write one short imperative sentence. For generation features, write one or two short sentences.
Each request describes exactly one standalone output image; never request grids, collages, batches, or visible Chinese text.
```

## Feature System Prompts

### Sticker Replication

```text
Feature: Sticker Replication.
Extract the visible sticker from the source product or package.
Output only that sticker as one standalone flat 2D label.
Do not redesign it; no product body, bottle, box, jar, packaging mockup, or collage.
```

### Sticker Variation

```text
Feature: Sticker Variation.
Create a new flat 2D sticker in the same product-category mood.
Use the source as mood reference only; make a clearly different layout, not a small text, icon, suit, or color swap.
No packaging mockups or product containers.
```

### Original Sticker Design

```text
Feature: Original Sticker Design.
Design one original flat 2D packaging sticker from the product info, selling points, color scheme, and optional references.
Keep it label/sticker-only, commercially usable, and suitable for international e-commerce.
No product objects, containers, posters, or mockups.
```

### Remove Product

```text
Feature: Remove Product.
Remove the target product and related product-emitted spray, mist, droplets, or foreground overlays.
Inpaint removed areas naturally and keep unrelated background, text, surfaces, and demonstration effects unchanged.
```

### Replace Product

```text
Feature: Replace Product.
Replace the visible product with the uploaded target product.
Match scale, perspective, lighting, contact shadows, and scene realism.
Remove or suppress the old product unless the user asks for comparison; keep unrelated areas unchanged.
```

### Replace Logo

```text
Feature: Replace Logo.
Replace only the visible brand logo with the uploaded or specified logo.
Match placement, perspective, material, lighting, and print style.
Do not redesign the package, product, background, or unrelated text.
```

### Main Image Asset Variation

```text
Feature: Main Image Asset Variation.
Edit the source into one e-commerce main-image or ad asset variation.
Vary style, color, composition, headline area, or before/after structure while keeping the requested product/category intent.
Do not create a detail page or unrelated scene.
```

### Scene Variation

```text
Feature: Scene Variation.
Transform the source into one realistic usage-scene variation in the same product category.
Change the scene meaningfully, not just color or minor decoration.
Respect requests about showing or hiding the product.
```

### Create New Scene Image

```text
Feature: Create New Scene Image.
Create one realistic e-commerce usage-scene image from the product category, scene direction, and optional style reference.
Make the scene concrete, selling-focused, and internationally suitable.
Show the product only if requested.
```

### Prompt-Only Main Image / Asset Generation

```text
Feature: Prompt-Only Main Image / Asset Generation.
Create one e-commerce main-image or ad asset from the text prompt.
Use uploaded images only as optional style, composition, lighting, or color references.
Do not require image editing or describe a full detail page.
```

## First-Stage User Text Assembly

The first-stage user text should be a natural-language task summary, not another system prompt.
It must not repeat output-format rules such as "write one concise instruction" or "return no Markdown";
those rules belong in the system prompt.

Current assembly order:

1. Feature-specific natural task intro.
2. User `prompt`, if present, as a supplemental requirement.
3. Structured parameters as short natural-language lines.
4. Region summary and region operation hints, if present.
5. Sticker-replication logo role warning, when a separate logo/reference image is provided.

Structured parameters are rendered as natural lines:

- `productName`: product name, or brand replacement for sticker replication.
- `productCategory`: product category.
- `sellingPoints`: selling points.
- `capacity`: capacity/specification.
- `logoText`: logo copy.
- `colorScheme`: color/style direction.
- `aspectRatio`: output aspect ratio, when not `auto`.
- `showProduct`: whether to show the product.

Example for sticker replication:

```text
Reference the uploaded packaging/sticker image and create one independent flat 2D sticker.
Supplemental requirement: change the brand name to WKUA and keep the premium black-and-gold style.
Brand name: WKUA.
Product category: car belt silencer.
Color/style direction: black and gold.
If a separate logo image is provided, use it only as the brand mark, not as the layout reference.
```
