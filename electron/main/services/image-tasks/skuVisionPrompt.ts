import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import { stripJsonFence } from '../../../../src/shared/domain/replaceProductExecutionPrompt.js';
import { sanitizeRequestForInstruction } from './instructionPrompt.js';
import { isSkuFeature } from './skuExecutionPrompt.js';

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;

export interface SkuVisionBatch {
  instructions: Array<{
    index: number;
    prompt: string;
  }>;
}

export function buildSkuVisionSystemPrompt(feature: ImageFeature): string {
  if (!isSkuFeature(feature)) {
    throw new Error(`buildSkuVisionSystemPrompt does not support feature ${feature}`);
  }

  return [
    'You are the visual prompt planner for a US Temu SKU label-edit task.',
    'Inspect the supplied SKU product image and optional packaging-design reference images.',
    'Return ONLY one JSON object with this exact shape: {"instructions":[{"index":1,"prompt":"..."}]}.',
    'The instructions array length must equal requested_count and indexes must start at 1 and be consecutive.',
    'Return every execution prompt in English only.',
    'Each prompt must be a complete instruction for an image editing model, not an explanation or a design plan.',
    'Use the source SKU image as the immutable product canvas: only edit the printed label area.',
    'Never alter the SKU container, its composition, camera angle, perspective, crop, position, silhouette, cap, nozzle, dropper, tube, proportions, material, transparency, lighting, background, or any non-label object.',
    'Preserve every source-image measurement annotation, including dimension lines, arrows, numerals, and units, exactly as visible. Never delete, move, crop, cover, translate, or redraw those annotations.',
    'Make the new label conform naturally to the existing label surface, curvature, highlights, reflections, and shadows.',
    'Translate Chinese user product names, categories, selling points, and supplemental requests into concise natural US ecommerce English. Preserve brands, capacities, and model numbers literally.',
    'Use exactly one brand identity and one brand logo or wordmark on the label. Never merge or duplicate brand marks from multiple images.',
    'Do not invent promotions, meaningless microcopy, or false product claims. All visible label copy must be natural English.',
    'If a user asks to turn the product into a tube, spray bottle, jar, or other package form, keep the source container unchanged and interpret that request only as label category or visual-direction guidance.',
    modeRule(feature),
  ].join('\n');
}

export function buildSkuVisionUserText(request: ImageTaskRequest, count: number): string {
  const structuredParameters = sanitizeRequestForInstruction({
    ...request,
    count,
    variantIndex: undefined,
    variantTotal: undefined,
  });
  const imageRoles = (request.images ?? []).map((image, index) => ({
    index: index + 1,
    role: image.role,
    purpose: image.role === 'source'
      ? 'fixed SKU product canvas'
      : 'label-design reference only; never a container-form reference',
  }));

  return [
    `Create ${count} English SKU label-edit execution prompt${count === 1 ? '' : 's'} from the attached images.`,
    JSON.stringify({
      feature: request.feature,
      requested_count: count,
      structured_parameters: Object.keys(structuredParameters).length > 0
        ? structuredParameters
        : undefined,
      image_roles: imageRoles,
    }, null, 2),
  ].join('\n\n');
}

export function parseSkuVisionBatch(raw: string, expectedCount: number): SkuVisionBatch {
  const parsed = JSON.parse(stripJsonFence(raw)) as Partial<SkuVisionBatch>;
  if (!Array.isArray(parsed.instructions) || parsed.instructions.length !== expectedCount) {
    throw new Error(`vision model returned invalid SKU instruction batch; expected ${expectedCount} prompts`);
  }

  const instructions = [...parsed.instructions].sort((left, right) => left.index - right.index);
  for (let index = 0; index < expectedCount; index += 1) {
    const instruction = instructions[index];
    if (!instruction || instruction.index !== index + 1 || typeof instruction.prompt !== 'string' || !instruction.prompt.trim()) {
      throw new Error(`vision model missing SKU prompt for index ${index + 1}`);
    }
    if (HAN_CHARACTER_PATTERN.test(instruction.prompt)) {
      throw new Error('vision model must return English-only SKU execution prompts');
    }
  }

  return {
    instructions: instructions.map((instruction) => ({
      index: instruction.index,
      prompt: instruction.prompt.trim(),
    })),
  };
}

function modeRule(feature: ImageFeature) {
  switch (feature) {
    case 'sku_replica':
      return 'Replica mode: treat the reference product label as the default source of label copy, including its brand, product name, capacity, layout, hierarchy, palette, typography proportions, graphic shapes, and decorative language. Reproduce the visible reference label at the highest practical visual fidelity. Do not reinterpret, modernize, simplify, or merely approximate it as a similar style. Extract only the reference product label, ignoring any reference main-image scene, headlines, props, or additional products. Replace the source label copy completely instead of mixing it with the reference. Explicit user brand, product name, capacity, or additional copy overrides the matching reference label copy.';
    case 'sku_variation':
      return 'Variation mode: redesign only the source SKU label with clearly different label layout, palette, and/or graphic language. Keep the source brand and core product identity unless the user explicitly changes label copy; never copy a reference brand as a second identity.';
    case 'sku_original':
      return 'Original mode: create a new commercial label for the source SKU. Use an explicit user brand when provided, otherwise the source SKU brand. Reference images may guide only abstract style, hierarchy, palette, and decoration; never copy another brand, product name, or literal reference copy.';
    default:
      throw new Error(`unsupported SKU feature ${feature}`);
  }
}
