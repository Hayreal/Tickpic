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
    'Resolve locked_copy once for the entire batch from Image 1 primary label only: brand, product_name, and capacity. Ignore promotional slogans, icons, banners, accessory callouts, gift badges, bundle stickers, and any other ecommerce overlay graphics on Image 1.',
    'Every instruction must use those exact locked_copy values without synonyms, category substitutions, alternate spellings, or additional product names.',
    'When the user does not provide capacity, read capacity from Image 1 primary label. If any net weight, net volume, NET:, ml, g, oz, or fl.oz appears on that label, locked_copy.capacity must not be empty.',
    'Every non-empty locked_copy.capacity must start with the exact prefix "NET:".',
    'Every instruction must require the output label to visibly display locked_copy.capacity whenever it is non-empty. Never instruct the image model to omit, hide, or skip capacity when locked_copy.capacity is set.',
    'Explicit user brand, product name, and capacity override image text. For a blank source package in variation mode, use reliable reference-label identity for missing user fields.',
    'For batches, return every instruction in one JSON response. The instructions array length must equal requested_count, and each index must follow batch_diversity_plan when provided.',
    'For batches, make every label design visibly distinct through layout, hierarchy, scale, and element placement while keeping locked_copy identical.',
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
  const batchDiversityPlan = buildSkuBatchDiversityPlan(request.feature, count);

  return [
    count === 1
      ? 'Create 1 English SKU label-edit execution prompt from the attached images.'
      : `Create one batch with ${count} independent English SKU label-edit execution prompts from the attached images.`,
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
  const sections = [
    buildSourceLockSection(request),
    request.images?.some((image) => image.role === 'reference')
      ? request.feature === 'sku_variation'
        ? [
            'REFERENCE ROLE:',
            'Images 2 and later are the controlling label-design references; never copy their container shape, crop, scene, copy, or secondary objects.',
            'The reference label design system overrides any conflicting LABEL DESIGN PLAN.',
            'Keep its dominant palette, material and texture treatment, typography mood, signature graphics, and decorative language recognizable in every output.',
            'Vary layout and element placement only within that reference design system.',
            'Never introduce source-label styling or category-native graphics unless that visual language is clearly present in the reference.',
          ].join('\n')
        : 'REFERENCE ROLE:\nImages 2 and later are label-design references only. Use their label style as instructed, but never copy their container shape, crop, scene, or secondary objects.'
      : '',
    `LABEL DESIGN PLAN:\n${sanitizePlannedInstructionForLockedCopy(plannedInstruction, lockedCopy)}`,
    modeExecutionRule(request),
    buildLockedCopySection(request, lockedCopy),
    buildVisionFinalCheck(request, lockedCopy),
  ];

  return sections.filter(Boolean).join('\n\n');
}

function buildSourceLockSection(request: ImageTaskRequest): string {
  const lines = [
    'NON-NEGOTIABLE SOURCE LOCK:',
    'Image 1 is the fixed source canvas, not a visual reference to regenerate.',
    'Preserve exactly the canvas composition, crop, whitespace, background, primary SKU pixel position, outer silhouette, bottle height-to-width ratio, cap-to-body ratio, shoulders, neck, base, material, camera angle, perspective, lighting, reflections, and shadows.',
    'Never redraw, resize, stretch, compress, zoom, recenter, crop, or replace the container.',
    'Only redesign or add the printed label on the primary SKU front printable area.',
    'If Image 1 is a dimension diagram, preserve all dimension lines, arrows, numbers, and units exactly; never move, cover, translate, or redraw them.',
  ];

  if (request.feature === 'sku_original') {
    lines.push(
      'Preserve every non-label element in Image 1 exactly as uploaded, including accessories, bundle items, gift icons, secondary products, promotional callouts, and the original background composition.',
      'Do not remove, recenter, or isolate the primary SKU container from its original scene.',
      'From Image 1 primary label only, extract visible copy as brand, product name, and capacity for locked_copy. Do not copy old label design onto the new label; ignore source slogans, icons, banners, and decorative graphics when designing the replacement label.',
    );
  } else {
    lines.push(
      'Remove ecommerce overlay graphics from Image 1, including accessory quantity callouts, gift badges, bundle stickers, secondary product thumbnails, and promotional stickers outside the primary label. Output only the primary SKU container on a clean background.',
      'From Image 1 primary label, extract visible copy only as brand, product name, and capacity. Do not reproduce other source-label slogans, icons, banners, or decorative graphics unless the user explicitly requests them.',
    );
  }

  lines.push('If Image 1 is a blank package render, add the label only inside its front printable area without changing the blank container geometry.');
  return lines.join('\n');
}

function buildVisionFinalCheck(request: ImageTaskRequest, lockedCopy: SkuLockedCopy): string {
  const capacityRule = lockedCopy.capacity
    ? `The redesigned label must visibly show ${JSON.stringify(lockedCopy.capacity)}. `
    : 'If Image 1 primary label shows any net weight or volume, read it from the image and display it on the new label with the exact "NET:" prefix. ';

  if (request.feature === 'sku_original') {
    return `FINAL CHECK:\n${capacityRule}Return Image 1 with only the primary SKU label redesigned. Preserve every non-label element exactly as uploaded. Source container geometry and all locked visible copy override any conflicting wording above.`;
  }

  return `FINAL CHECK:\n${capacityRule}Return the primary SKU container with a redesigned label on a clean background. Remove source overlay graphics. Source container geometry and all locked visible copy override any conflicting wording above.`;
}

function sanitizePlannedInstructionForLockedCopy(plannedInstruction: string, lockedCopy: SkuLockedCopy): string {
  let instruction = plannedInstruction.trim();
  if (!lockedCopy.capacity) {
    return instruction;
  }

  return instruction
    .replace(/\b(?:do not add(?: any)?|without|omit|no|never add(?: any)?)\s+capacity(?:\s+text)?[^.]*\.?\s*/gi, '')
    .replace(/\b(?:and\s+)?no capacity(?:\s+text)?[^.]*\.?\s*/gi, '')
    .trim();
}

function resolveLockedCopy(request: ImageTaskRequest, plannedCopy: SkuLockedCopy): SkuLockedCopy {
  const original = request.feature === 'sku_original';
  const requestedProductName = request.productName?.trim();
  return {
    brand: request.brand?.trim() || (original ? '' : plannedCopy.brand),
    productName: requestedProductName
      ? (HAN_CHARACTER_PATTERN.test(requestedProductName) ? plannedCopy.productName : requestedProductName)
      : (original ? '' : plannedCopy.productName),
    capacity: normalizeNetCapacity(request.capacity?.trim() || plannedCopy.capacity),
  };
}

function normalizeNetCapacity(value: string) {
  const capacity = value.replace(/^(?:net\s*[:：]?\s*)+/i, '').trim();
  return capacity ? `NET: ${capacity}` : '';
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
    lines.push('Every output must display this exact capacity visibly on the label.');
    lines.push('Never omit capacity from the label. Ignore any conflicting LABEL DESIGN PLAN wording about omitting or hiding capacity.');
  }
  lines.push('Every visible capacity must start with the exact prefix "NET:".');
  if (!copy.capacity) {
    lines.push('When Image 1 primary label shows any net weight or volume, read it from the image and display it on the new label with the exact "NET:" prefix.');
  }
  lines.push('Use each locked value exactly and consistently. Do not show a synonym, alternate spelling, category replacement, or second product name.');
  return lines.join('\n');
}

function modeExecutionRule(request: ImageTaskRequest) {
  const batchSlot = resolveBatchSlotDirective(request);
  switch (request.feature) {
    case 'sku_replica':
      return [
        'MODE AUTHORITY:',
        'Reproduce the reference label design on Image 1 at the highest practical visual fidelity while fitting the unchanged source container.',
        batchSlot,
      ].filter(Boolean).join('\n');
    case 'sku_variation':
      return [
        'MODE AUTHORITY:',
        'Create this batch slot as a visibly distinct layout inside the same reference label design system. Change arrangement, never reference style identity, product identity, or source geometry.',
        batchSlot,
      ].filter(Boolean).join('\n');
    case 'sku_original':
      return [
        'MODE AUTHORITY:',
        'Ignore every existing label design on Image 1, including its brand, wording, palette, typography, graphics, layout, product category, usage context, and target object. Image 1 provides container geometry only; derive the new visual language from Images 2 and later.',
        'Preserve every non-label element in Image 1 exactly as uploaded, including accessories, bundle items, gift icons, secondary products, and promotional callouts.',
        "The user's product name is the sole semantic authority for product category, usage, and label imagery.",
        'Any source-derived category or usage direction in LABEL DESIGN PLAN is invalid and must be ignored.',
        'Unless explicit user input names an automotive or vehicle use, do not show cars, vehicles, headlights, engines, dashboards, wheels, or other automotive imagery.',
        'When no target context is explicit, use neutral abstract product graphics rather than inventing a target object.',
        batchSlot,
      ].filter(Boolean).join('\n');
    default:
      throw new Error(`unsupported SKU feature ${request.feature}`);
  }
}

function resolveBatchSlotDirective(request: ImageTaskRequest): string {
  const total = request.variantTotal ?? (request.count > 1 ? request.count : undefined);
  const index = request.variantIndex;
  if (!index || !total || total <= 1) {
    return '';
  }
  return `This is batch output ${index}/${total}. It must be visibly different from the other outputs in label layout, hierarchy, typography scale, color blocking, decorative motifs, and graphic placement while staying within the same reference design language.`;
}

function modeRule(feature: ImageFeature) {
  switch (feature) {
    case 'sku_replica':
      return 'Replica mode: treat the reference product label as the default source of label copy, including its brand, product name, capacity, layout, hierarchy, palette, typography proportions, graphic shapes, and decorative language. Reproduce the visible reference label at the highest practical visual fidelity. Do not reinterpret, modernize, simplify, or merely approximate it as a similar style. Extract only the reference product label, ignoring any reference main-image scene, headlines, props, or additional products. Replace the source label copy completely instead of mixing it with the reference. Explicit user brand, product name, capacity, or additional copy overrides the matching reference label copy. When locked_copy.capacity is non-empty, every output label must visibly display that exact capacity with the "NET:" prefix.';
    case 'sku_variation':
      return 'Variation mode: redesign only the source SKU label. From Image 1, locked_copy may contain only brand, product_name, and capacity from the primary label; never copy source slogans, icons, banners, accessory callouts, or other sticker graphics. When references exist: All batch variants must remain unmistakably derived from the same reference label design system. Preserve its dominant palette, material and texture treatment, typography mood, signature graphics, and decorative language; vary only layout, hierarchy, scale, cropping, and element placement within that system. Never use the source label design or product category aesthetics as visual direction, and never invent a contrasting design system for diversity. Keep one shared product identity from locked_copy; never create different product names or copy a reference brand as a second identity. When locked_copy.capacity is non-empty, every output label must visibly display that exact capacity with the "NET:" prefix.';
    case 'sku_original':
      return 'Original mode: create a new commercial label for the source SKU. Treat source-image label design as forbidden input: do not inherit its brand, wording, palette, typography, graphics, layout, product category, usage, target object, or accessory meaning. Never infer product category, usage, target object, or label imagery from the source image. Preserve the full uploaded canvas composition, including accessories, bundle items, gift icons, secondary products, and promotional callouts; only redesign the primary SKU label. Use explicit user brand and product name as semantic authority; never copy source brand or product name. When the user does not provide capacity, extract capacity from Image 1 primary label only; when locked_copy.capacity is non-empty, every instruction must display that exact capacity and must never say to omit capacity. Leave missing brand absent rather than copying or inventing it. Use reference images as the primary style, hierarchy, palette, typography-proportion, and decoration direction without copying their brand, product name, or literal text. For batches, make every label design clearly distinct through layout, hierarchy, scale, typography treatment, color blocking, and decorative placement while keeping the same product name, locked capacity, and reference-derived design language.';
    default:
      throw new Error(`unsupported SKU feature ${feature}`);
  }
}
