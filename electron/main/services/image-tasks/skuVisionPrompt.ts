import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import { stripJsonFence } from '../../../../src/shared/domain/replaceProductExecutionPrompt.js';
import { sanitizeRequestForInstruction } from './instructionPrompt.js';
import { isSkuFeature } from './skuExecutionPrompt.js';

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;

export interface SkuLockedCopy {
  brand: string;
  productName: string;
  capacity: string;
}

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
    'Inspect the supplied SKU product image and optional packaging-design reference images.',
    'Return ONLY one JSON object with this exact shape: {"locked_copy":{"brand":"","product_name":"","capacity":""},"instructions":[{"index":1,"prompt":"..."}]}.',
    'The instructions array length must equal requested_count and indexes must start at 1 and be consecutive.',
    'Resolve locked_copy once for the entire batch. Every instruction must use those exact visible values without synonyms, category substitutions, alternate spellings, or additional product names.',
    'Explicit user brand, product name, and capacity override image text. For a blank source package in variation mode, use reliable reference-label identity for missing user fields.',
    'For batches, make every label design visibly distinct in at least two of layout, palette, typography structure, and graphic language while keeping locked_copy identical.',
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
      capacity: lockedCopy.capacity.trim(),
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
  const sections = [
    [
      'NON-NEGOTIABLE SOURCE LOCK:',
      'Image 1 is the fixed source canvas, not a visual reference to regenerate.',
      'Preserve exactly the canvas composition, crop, whitespace, background, primary SKU pixel position, outer silhouette, bottle height-to-width ratio, cap-to-body ratio, shoulders, neck, base, material, camera angle, perspective, lighting, reflections, and shadows.',
      'Never redraw, resize, stretch, compress, zoom, recenter, crop, or replace the container.',
      'Only redesign or add the printed label on the primary SKU front printable area.',
      'If Image 1 is a dimension diagram, preserve all dimension lines, arrows, numbers, and units exactly; never move, cover, translate, or redraw them.',
      'If Image 1 contains a secondary package, accessory, quantity marker, or other object, preserve every such object and the complete composition exactly; edit only the primary SKU label.',
      'If Image 1 is a blank package render, add the label only inside its front printable area without changing the blank container geometry.',
    ].join('\n'),
    request.images?.some((image) => image.role === 'reference')
      ? 'REFERENCE ROLE:\nImages 2 and later are label-design references only. Use their label style as instructed, but never copy their container shape, crop, scene, or secondary objects.'
      : '',
    `LABEL DESIGN PLAN:\n${plannedInstruction.trim()}`,
    modeExecutionRule(request.feature),
    buildLockedCopySection(request, lockedCopy),
    'FINAL CHECK:\nReturn the same source composition with only the primary SKU label changed. Source geometry and all locked visible copy override any conflicting wording above.',
  ];

  return sections.filter(Boolean).join('\n\n');
}

function resolveLockedCopy(request: ImageTaskRequest, plannedCopy: SkuLockedCopy): SkuLockedCopy {
  const original = request.feature === 'sku_original';
  const requestedProductName = request.productName?.trim();
  return {
    brand: request.brand?.trim() || (original ? '' : plannedCopy.brand),
    productName: requestedProductName
      ? (HAN_CHARACTER_PATTERN.test(requestedProductName) ? plannedCopy.productName : requestedProductName)
      : (original ? '' : plannedCopy.productName),
    capacity: request.capacity?.trim() || (original ? '' : plannedCopy.capacity),
  };
}

function buildLockedCopySection(request: ImageTaskRequest, copy: SkuLockedCopy) {
  const lines = ['FINAL VISIBLE-COPY AUTHORITY:'];
  if (copy.brand) {
    lines.push(`The exact brand is ${JSON.stringify(copy.brand)}.`);
  } else if (request.feature === 'sku_original') {
    lines.push('No brand is locked. Do not copy a brand from Image 1 or the reference images.');
  }
  if (copy.productName) {
    lines.push(`The exact product name is ${JSON.stringify(copy.productName)}.`);
  }
  if (copy.capacity) {
    lines.push(`The exact capacity is ${JSON.stringify(copy.capacity)}.`);
  }
  lines.push('Use each locked value exactly and consistently. Do not show a synonym, alternate spelling, category replacement, or second product name.');
  return lines.join('\n');
}

function modeExecutionRule(feature: ImageFeature) {
  switch (feature) {
    case 'sku_replica':
      return 'MODE AUTHORITY:\nReproduce the reference label design on Image 1 at the highest practical visual fidelity while fitting the unchanged source container.';
    case 'sku_variation':
      return 'MODE AUTHORITY:\nCreate this batch slot as a visibly distinct label design in the same product family. Change design, never product identity or source geometry.';
    case 'sku_original':
      return 'MODE AUTHORITY:\nIgnore every existing label design on Image 1, including its brand, wording, palette, typography, graphics, and layout. Image 1 provides container geometry only; derive the new visual language from Images 2 and later.';
    default:
      throw new Error(`unsupported SKU feature ${feature}`);
  }
}

function modeRule(feature: ImageFeature) {
  switch (feature) {
    case 'sku_replica':
      return 'Replica mode: treat the reference product label as the default source of label copy, including its brand, product name, capacity, layout, hierarchy, palette, typography proportions, graphic shapes, and decorative language. Reproduce the visible reference label at the highest practical visual fidelity. Do not reinterpret, modernize, simplify, or merely approximate it as a similar style. Extract only the reference product label, ignoring any reference main-image scene, headlines, props, or additional products. Replace the source label copy completely instead of mixing it with the reference. Explicit user brand, product name, capacity, or additional copy overrides the matching reference label copy.';
    case 'sku_variation':
      return 'Variation mode: redesign only the source SKU label. When references exist, keep their recognizable label-design family while creating clearly different layouts, palettes, typography structures, and/or graphic language across the batch. Keep one shared product identity from locked_copy; never create different product names or copy a reference brand as a second identity.';
    case 'sku_original':
      return 'Original mode: create a new commercial label for the source SKU. Treat the source label as forbidden design input: do not inherit its brand, wording, palette, typography, graphics, or layout. Use explicit user copy only; leave missing brand or capacity absent rather than copying or inventing it. Use reference images as the primary style, hierarchy, palette, typography-proportion, and decoration direction without copying their brand, product name, or literal text.';
    default:
      throw new Error(`unsupported SKU feature ${feature}`);
  }
}
