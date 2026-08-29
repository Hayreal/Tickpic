import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import { stripJsonFence } from '../../../../src/shared/domain/replaceProductExecutionPrompt.js';
import { sanitizeRequestForInstruction } from './instructionPrompt.js';
import {
  buildSkuLabelConstraintSpec,
  renderSkuLabelExecutionPrompt,
  resolveLockedCopy,
  sanitizePlannedInstructionForLockedCopy,
  normalizeNetCapacity,
  type SkuLockedCopy,
} from './skuConstraintSpec.js';
import { isSkuFeature } from './skuExecutionPrompt.js';

export type { SkuLockedCopy };

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;

export interface SkuVisionBatch {
  lockedCopy: SkuLockedCopy;
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
    'This task changes only the printed label on the primary SKU. Preserve every non-label pixel in Image 1, including bundle accessories, secondary products, and promotional callouts.',
    'Inspect the supplied SKU product image and optional packaging-design reference images.',
    'Return ONLY one JSON object with this exact shape: {"locked_copy":{"brand":"","product_name":"","capacity":""},"instructions":[{"index":1,"prompt":"..."}]}.',
    'The instructions array length must equal requested_count and indexes must start at 1 and be consecutive.',
    'Resolve locked_copy once for the entire batch from Image 1 primary label only: brand, product_name, and capacity. Ignore promotional slogans, icons, banners, accessory callouts, gift badges, bundle stickers, and any other ecommerce overlay graphics on Image 1.',
    'Every instruction must use those exact locked_copy values without synonyms, category substitutions, alternate spellings, or additional product names.',
    'When the user does not provide capacity, read capacity from Image 1 primary label. If any net weight, net volume, NET:, ml, g, oz, or fl.oz appears on that label, locked_copy.capacity must not be empty.',
    'Every non-empty locked_copy.capacity must start with the exact prefix "NET:".',
    'Every instruction must require the output label to visibly display locked_copy.capacity whenever it is non-empty. Never instruct the image model to omit, hide, or skip capacity when locked_copy.capacity is set.',
    'Explicit user brand, product name, and capacity override image text. For a blank source package in variation mode, use reliable reference-label identity for missing user fields.',
    'For batches, return every instruction in one JSON response. The instructions array length must equal requested_count, and each index must follow batch_diversity_plan when provided.',
    'For batches, make every label design visibly distinct through layout, hierarchy, scale, and element placement while keeping locked_copy identical.',
    'Return every creative plan in English only.',
    'Each prompt must be a concise English label design plan for an image editing model, not a complete execution prompt and not an explanation memo.',
    'Describe label layout, hierarchy, palette direction, typography mood, decorative motifs, and graphic placement only.',
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
  const batchDiversityPlan = buildSkuBatchDiversityPlan(request.feature, count);

  return [
    count === 1
      ? 'Create 1 English SKU label design plan from the attached images.'
      : `Create one batch with ${count} independent English SKU label design plans from the attached images.`,
    JSON.stringify({
      feature: request.feature,
      requested_count: count,
      structured_parameters: Object.keys(structuredParameters).length > 0
        ? structuredParameters
        : undefined,
      image_roles: imageRoles,
      ...(batchDiversityPlan ? { batch_diversity_plan: batchDiversityPlan } : {}),
    }, null, 2),
  ].join('\n\n');
}

const SKU_BATCH_DIVERSITY_DIRECTIVES: Record<
  'sku_replica' | 'sku_variation' | 'sku_original',
  readonly string[]
> = {
  sku_replica: [
    'Make the label hierarchy, band structure, and graphic placement clearly different from the other outputs while preserving reference fidelity.',
    'Use a different typography scale, color blocking, and decorative arrangement while keeping the same reference label identity.',
    'Shift the layout rhythm, badge placement, and supporting graphic zones without simplifying the reference design language.',
  ],
  sku_variation: [
    'Use a distinct label layout direction inside the same reference design system; change hierarchy and element placement, not the reference palette mood.',
    'Apply a different composition structure, scale relationship, and decorative framing while staying unmistakably within the reference label system.',
    'Rotate the arrangement, headline treatment, and graphic zones while keeping the same reference-derived visual language.',
  ],
  sku_original: [
    'Use a distinct label layout, hierarchy, and typography scale while staying within the reference design language.',
    'Apply a different composition structure, color blocking, and decorative motif placement from the other outputs.',
    'Shift the headline treatment, badge zones, and supporting graphics while keeping the same product name and reference mood.',
  ],
};

export function buildSkuBatchDiversityPlan(feature: ImageFeature, count: number) {
  if (count <= 1) {
    return undefined;
  }
  if (!(feature in SKU_BATCH_DIVERSITY_DIRECTIVES)) {
    return undefined;
  }

  const directives = SKU_BATCH_DIVERSITY_DIRECTIVES[feature as keyof typeof SKU_BATCH_DIVERSITY_DIRECTIVES];
  return Array.from({ length: count }, (_, index) => ({
    index: index + 1,
    diversity_directive: directives[index % directives.length]!,
  }));
}

export function parseSkuVisionBatch(raw: string, expectedCount: number): SkuVisionBatch {
  const parsed = JSON.parse(stripJsonFence(raw)) as {
    locked_copy?: {
      brand?: unknown;
      product_name?: unknown;
      capacity?: unknown;
    };
    instructions?: SkuVisionBatch['instructions'];
  };
  const lockedCopy = parsed.locked_copy;
  if (
    !lockedCopy
    || typeof lockedCopy.brand !== 'string'
    || typeof lockedCopy.product_name !== 'string'
    || typeof lockedCopy.capacity !== 'string'
  ) {
    throw new Error('vision model returned invalid SKU locked_copy');
  }
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
    lockedCopy: {
      brand: lockedCopy.brand.trim(),
      productName: lockedCopy.product_name.trim(),
      capacity: normalizeNetCapacity(lockedCopy.capacity.trim()),
    },
    instructions: instructions.map((instruction) => ({
      index: instruction.index,
      prompt: instruction.prompt.trim(),
    })),
  };
}

export function finalizeSkuVisionInstruction(
  request: ImageTaskRequest,
  plannedInstruction: string,
  plannedCopy: SkuLockedCopy,
): string {
  const lockedCopy = resolveLockedCopy(request, plannedCopy);
  const creativePlan = sanitizePlannedInstructionForLockedCopy(plannedInstruction, lockedCopy);
  const spec = buildSkuLabelConstraintSpec(request, lockedCopy);
  return renderSkuLabelExecutionPrompt(spec, creativePlan);
}

function modeRule(feature: ImageFeature) {
  switch (feature) {
    case 'sku_replica':
      return 'Replica mode: treat the reference product label as the default source of label copy, including its brand, product name, capacity, layout, hierarchy, palette, typography proportions, graphic shapes, and decorative language. Reproduce the visible reference label at the highest practical visual fidelity. Do not reinterpret, modernize, simplify, or merely approximate it as a similar style. Extract only the reference product label, ignoring any reference main-image scene, headlines, props, or additional products. Replace the source label copy completely instead of mixing it with the reference. Explicit user brand, product name, capacity, or additional copy overrides the matching reference label copy. Preserve the full Image 1 canvas composition, including bundle accessories and secondary products; only redesign the primary SKU label. When locked_copy.capacity is non-empty, every output label must visibly display that exact capacity with the "NET:" prefix.';
    case 'sku_variation':
      return 'Variation mode: redesign only the source SKU label. From Image 1, locked_copy may contain only brand, product_name, and capacity from the primary label; never copy source slogans, icons, banners, accessory callouts, or other sticker graphics. Preserve the full Image 1 canvas composition, including bundle accessories and secondary products; do not remove, recenter, or isolate the primary SKU to a bottle-only clean background. When references exist: All batch variants must remain unmistakably derived from the same reference label design system. Preserve its dominant palette, material and texture treatment, typography mood, signature graphics, and decorative language; vary only layout, hierarchy, scale, cropping, and element placement within that system. Never use the source label design or product category aesthetics as visual direction, and never invent a contrasting design system for diversity. Keep one shared product identity from locked_copy; never create different product names or copy a reference brand as a second identity. When locked_copy.capacity is non-empty, every output label must visibly display that exact capacity with the "NET:" prefix.';
    case 'sku_original':
      return 'Original mode: create a new commercial label for the source SKU. Treat source-image label design as forbidden input: do not inherit its brand, wording, palette, typography, graphics, layout, product category, usage, target object, or accessory meaning. Never infer product category, usage, target object, or label imagery from the source image. Preserve the full uploaded canvas composition, including accessories, bundle items, gift icons, secondary products, and promotional callouts; only redesign the primary SKU label. Use explicit user brand and product name as semantic authority; never copy source brand or product name. When the user does not provide capacity, extract capacity from Image 1 primary label only; when locked_copy.capacity is non-empty, every instruction must display that exact capacity and must never say to omit capacity. Leave missing brand absent rather than copying or inventing it. Use reference images as the primary style, hierarchy, palette, typography-proportion, and decoration direction without copying their brand, product name, or literal text. For batches, make every label design clearly distinct through layout, hierarchy, scale, typography treatment, color blocking, and decorative placement while keeping the same product name, locked capacity, and reference-derived design language.';
    default:
      throw new Error(`unsupported SKU feature ${feature}`);
  }
}
