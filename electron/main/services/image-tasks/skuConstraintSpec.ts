import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;

const SKU_ANTI_AI_LABEL_TEMPLATE_FORBIDDEN = [
  'Never use the generic AI ecommerce label template: a horizontal row of three hexagonal or circular icon badges, each with a short benefit slogan underneath (for example Deep Cleaning / Powerful Stain Removal / Safe & Gentle).',
  'Do not add 3-icon feature rows, hex badge grids, or equivalent small-icon selling-point modules on the label.',
  'Other label layouts, typography, color blocking, bands, and decorative structures remain allowed; only this 3-hex selling-point template is forbidden.',
] as const;

const SKU_LABEL_ONLY_EDIT_RULES = [
  'This is a label-only edit: change only the printed label on the primary SKU front printable area.',
  'Preserve every non-label element in Image 1 exactly as uploaded, including accessories, bundle items, gift items, secondary products, promotional callouts, and the original canvas composition.',
  'Do not remove, recenter, recrop, or isolate the primary SKU container from its original scene.',
] as const;

export interface SkuLockedCopy {
  brand: string;
  productName: string;
  capacity: string;
}

export interface SkuLabelConstraintSpec {
  feature: 'sku_replica' | 'sku_variation' | 'sku_original';
  task: 'sku_label_edit';
  image_roles: {
    image_1: string;
    reference_images?: string;
  };
  source_lock: string[];
  reference_policy?: string[];
  mode_authority: string[];
  locked_copy: {
    brand?: string;
    product_name?: string;
    capacity?: string;
  };
  copy_rules: string[];
  forbidden: string[];
  final_check: string[];
  batch_slot?: string;
  user_supplement?: string;
  user_negative?: string;
}

export function resolveLockedCopy(request: ImageTaskRequest, plannedCopy: SkuLockedCopy): SkuLockedCopy {
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

export function sanitizePlannedInstructionForLockedCopy(
  plannedInstruction: string,
  lockedCopy: SkuLockedCopy,
): string {
  let instruction = plannedInstruction.trim();
  if (!lockedCopy.capacity) {
    return instruction;
  }

  return instruction
    .replace(/\b(?:do not add(?: any)?|without|omit|no|never add(?: any)?)\s+capacity(?:\s+text)?[^.]*\.?\s*/gi, '')
    .replace(/\b(?:and\s+)?no capacity(?:\s+text)?[^.]*\.?\s*/gi, '')
    .trim();
}

export function buildSkuLabelConstraintSpec(
  request: ImageTaskRequest,
  lockedCopy: SkuLockedCopy,
): SkuLabelConstraintSpec {
  assertSkuLabelFeature(request.feature);
  const hasReference = request.images?.some((image) => image.role === 'reference') ?? false;

  return {
    feature: request.feature,
    task: 'sku_label_edit',
    image_roles: {
      image_1: 'Fixed SKU product canvas. Only redesign the printed label on the primary SKU front printable area.',
      ...(hasReference
        ? {
          reference_images: request.feature === 'sku_variation'
            ? 'Images 2+ control the label-design reference system. Never copy their container shape, crop, scene, copy, or secondary objects. Reference design system overrides conflicting creative plan wording.'
            : 'Images 2+ are label-design references only. Never copy their container shape, crop, scene, or secondary objects.',
        }
        : {}),
    },
    source_lock: buildSourceLockLines(request),
    ...(hasReference ? { reference_policy: buildReferencePolicyLines(request) } : {}),
    mode_authority: buildModeAuthorityLines(request),
    locked_copy: {
      ...(lockedCopy.brand ? { brand: lockedCopy.brand } : {}),
      ...(lockedCopy.productName ? { product_name: lockedCopy.productName } : {}),
      ...(lockedCopy.capacity ? { capacity: lockedCopy.capacity } : {}),
    },
    copy_rules: buildCopyRules(request, lockedCopy),
    forbidden: buildForbiddenLines(request),
    final_check: buildFinalCheckLines(request, lockedCopy),
    ...(resolveBatchSlotDirective(request) ? { batch_slot: resolveBatchSlotDirective(request) } : {}),
    ...(request.prompt?.trim() ? { user_supplement: request.prompt.trim() } : {}),
    ...(request.negativePrompt?.trim() ? { user_negative: request.negativePrompt.trim() } : {}),
  };
}

export function renderSkuLabelExecutionPrompt(
  spec: SkuLabelConstraintSpec,
  creativePlan: string,
): string {
  const sections = [
    'NON-NEGOTIABLE SOURCE LOCK:',
    ...spec.source_lock,
    spec.reference_policy?.length
      ? ['REFERENCE ROLE:', ...spec.reference_policy].join('\n')
      : '',
    `LABEL DESIGN PLAN:\n${creativePlan.trim()}`,
    ['MODE AUTHORITY:', ...spec.mode_authority, ...(spec.batch_slot ? [spec.batch_slot] : [])].join('\n'),
    ['FINAL VISIBLE-COPY AUTHORITY:', ...spec.copy_rules].join('\n'),
    ['FORBIDDEN:', ...spec.forbidden].join('\n'),
    ['FINAL CHECK:', ...spec.final_check].join('\n'),
  ];

  return sections.filter(Boolean).join('\n\n');
}

function assertSkuLabelFeature(feature: ImageFeature): asserts feature is SkuLabelConstraintSpec['feature'] {
  if (feature !== 'sku_replica' && feature !== 'sku_variation' && feature !== 'sku_original') {
    throw new Error(`buildSkuLabelConstraintSpec does not support feature ${feature}`);
  }
}

function buildSourceLockLines(request: ImageTaskRequest): string[] {
  return [
    'Image 1 is the fixed source canvas, not a visual reference to regenerate.',
    'Preserve exactly the canvas composition, crop, whitespace, background, primary SKU pixel position, outer silhouette, bottle height-to-width ratio, cap-to-body ratio, shoulders, neck, base, material, camera angle, perspective, lighting, reflections, and shadows.',
    'Never redraw, resize, stretch, compress, zoom, recenter, crop, or replace the container.',
    ...SKU_LABEL_ONLY_EDIT_RULES,
    'If Image 1 is a dimension diagram, preserve all dimension lines, arrows, numbers, and units exactly; never move, cover, translate, or redraw them.',
    'If Image 1 is a blank package render, add the label only inside its front printable area without changing the blank container geometry.',
  ];
}

function buildReferencePolicyLines(request: ImageTaskRequest): string[] {
  if (request.feature === 'sku_variation') {
    return [
      'The reference label design system overrides any conflicting creative plan wording.',
      'Keep the reference dominant palette, material and texture treatment, typography mood, signature graphics, and decorative language recognizable in every output.',
      'Vary layout and element placement only within that reference design system.',
      'Never introduce source-label styling or category-native graphics unless that visual language is clearly present in the reference.',
    ];
  }
  return ['Use reference label style as instructed, but never copy reference container shape, crop, scene, or secondary objects.'];
}

function buildModeAuthorityLines(request: ImageTaskRequest): string[] {
  switch (request.feature) {
    case 'sku_replica':
      return [
        'Reproduce the reference label design on Image 1 at the highest practical visual fidelity while fitting the unchanged source container.',
        'Preserve the full Image 1 product set composition, including bundle accessories and secondary products; only redesign the primary SKU label.',
      ];
    case 'sku_variation':
      return [
        'Create this batch slot as a visibly distinct layout inside the same reference label design system. Change arrangement, never reference style identity, product identity, or source geometry.',
        'Preserve the full Image 1 product set composition, including bundle accessories and secondary products; only redesign the primary SKU label.',
      ];
    case 'sku_original':
      return [
        'Ignore every existing label design on Image 1. Image 1 provides container geometry only; derive the new visual language from reference images when present.',
        'Preserve the full Image 1 product set composition, including bundle accessories and secondary products; only redesign the primary SKU label.',
        "The user's product name is the sole semantic authority for product category, usage, and label imagery.",
        'Any source-derived category or usage direction in the creative plan is invalid and must be ignored.',
        'Unless explicit user input names an automotive or vehicle use, do not show cars, vehicles, headlights, engines, dashboards, wheels, or other automotive imagery.',
        'When no target context is explicit, use neutral abstract product graphics rather than inventing a target object.',
      ];
    default:
      return [];
  }
}

function buildCopyRules(request: ImageTaskRequest, copy: SkuLockedCopy): string[] {
  const lines: string[] = [];
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
    lines.push('Never omit capacity from the label.');
  }
  lines.push('Every visible capacity must start with the exact prefix "NET:".');
  if (!copy.capacity) {
    lines.push('When Image 1 primary label shows any net weight or volume, read it from the image and display it on the new label with the exact "NET:" prefix.');
  }
  lines.push('Use each locked value exactly and consistently. Do not show a synonym, alternate spelling, category replacement, or second product name.');
  return lines;
}

function buildForbiddenLines(request: ImageTaskRequest): string[] {
  const lines = [
    'Never alter the SKU container, crop, camera angle, perspective, silhouette, cap, proportions, material, transparency, lighting, background, or any non-label object.',
    'Never omit locked capacity when locked_copy.capacity is set.',
    'Never merge or duplicate brand marks from multiple images.',
    ...SKU_ANTI_AI_LABEL_TEMPLATE_FORBIDDEN,
  ];
  if (request.feature === 'sku_original') {
    lines.push('Never copy promotional slogans, icons, or benefit modules from Image 1 source label unless the user explicitly requests them.');
  } else {
    lines.push('Never reproduce source-label slogans, icons, banners, or promotional overlay graphics unless the user explicitly requests them.');
    lines.push(
      'When reproducing a reference label, preserve its actual layout; do not add a new 3-hex icon selling-point row unless that exact module already exists on the reference label.',
    );
  }
  return lines;
}

function buildFinalCheckLines(request: ImageTaskRequest, lockedCopy: SkuLockedCopy): string[] {
  const lines = lockedCopy.capacity
    ? [`The redesigned label must visibly show ${JSON.stringify(lockedCopy.capacity)}.`]
    : ['If Image 1 primary label shows any net weight or volume, display it on the new label with the exact "NET:" prefix.'];

  lines.push('Return Image 1 unchanged except for the primary SKU printed label. Preserve every non-label element exactly as uploaded.');

  lines.push('Source container geometry and all locked visible copy override any conflicting creative plan wording.');
  return lines;
}

function resolveBatchSlotDirective(request: ImageTaskRequest): string | undefined {
  const total = request.variantTotal ?? (request.count > 1 ? request.count : undefined);
  const index = request.variantIndex;
  if (!index || !total || total <= 1) {
    return undefined;
  }
  return `This is batch output ${index}/${total}. It must be visibly different from the other outputs in label layout, hierarchy, typography scale, color blocking, decorative motifs, and graphic placement while staying within the same reference design language; never satisfy batch diversity by adding a 3-hex icon selling-point template.`;
}

function normalizeNetCapacity(value: string) {
  const capacity = value.replace(/^(?:net\s*[:：]?\s*)+/i, '').trim();
  return capacity ? `NET: ${capacity}` : '';
}

export { normalizeNetCapacity };
