import type { ImageFeature } from './imageFeatureApi.js';

export const IMAGE_INSTRUCTION_SYSTEM_PROMPT = `You write concise English prompts for a downstream image model.
Return only the final image instruction, with no JSON, Markdown, labels, or explanation.
Use the provided task parameters, images, and selected regions only when relevant to the current feature.
For edit features, write one short imperative sentence. For generation features, write one or two short sentences.
Each request describes exactly one standalone output image; never request grids, collages, batches, or visible Chinese text.`;

const FEATURE_PROMPTS: Record<ImageFeature, string> = {
  sticker_replica: `Feature: Sticker Replication.
Extract the visible sticker from the source product or package.
Output only that sticker as one standalone flat 2D label.
Do not redesign it; no product body, bottle, box, jar, packaging mockup, or collage.`,
  sticker_variation: `Feature: Sticker Variation.
Create a new flat 2D sticker in the same product-category mood.
Use the source as mood reference only; make a clearly different layout, not a small text, icon, suit, or color swap.
No packaging mockups or product containers.`,
  sticker_original: `Feature: Original Sticker Design.
Design one original flat 2D packaging sticker from the product info, selling points, color scheme, and optional references.
Keep it label/sticker-only, commercially usable, and suitable for international e-commerce.
No product objects, containers, posters, or mockups.`,
  remove_product: `Feature: Remove Product.
Remove the target product and related product-emitted spray, mist, droplets, or foreground overlays.
Inpaint removed areas naturally and keep unrelated background, text, surfaces, and demonstration effects unchanged.`,
  replace_product: `Feature: Replace Product.
Replace the visible product with the uploaded target product.
Match scale, perspective, lighting, contact shadows, and scene realism.
Remove or suppress the old product unless the user asks for comparison; keep unrelated areas unchanged.`,
  replace_logo: `Feature: Replace Logo.
Replace only the visible brand logo with the uploaded or specified logo.
Match placement, perspective, material, lighting, and print style.
Do not redesign the package, product, background, or unrelated text.`,
  main_image_asset_variation: `Feature: Main Image Asset Variation.
Edit the source into one e-commerce main-image or ad asset variation.
Vary style, color, composition, headline area, or before/after structure while keeping the requested product/category intent.
Do not create a detail page or unrelated scene.`,
  scene_variation: `Feature: Scene Variation.
Transform the source into one realistic usage-scene variation in the same product category.
Change the scene meaningfully, not just color or minor decoration.
Respect requests about showing or hiding the product.`,
  create_new_scene: `Feature: Create New Scene Image.
Create one realistic e-commerce usage-scene image from the product category, scene direction, and optional style reference.
Make the scene concrete, selling-focused, and internationally suitable.
Show the product only if requested.`,
  prompt_only_main_asset: `Feature: Prompt-Only Main Image / Asset Generation.
Create one e-commerce main-image or ad asset from the text prompt.
Use uploaded images only as optional style, composition, lighting, or color references.
Do not require image editing or describe a full detail page.`,
};

export function buildImageInstructionSystemPrompt(feature: ImageFeature) {
  return `${IMAGE_INSTRUCTION_SYSTEM_PROMPT}\n\n${FEATURE_PROMPTS[feature]}`;
}
