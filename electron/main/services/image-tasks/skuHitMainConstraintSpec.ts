import type { ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';

const SKU_HIT_MAIN_SINGLE_PRODUCT_RULES = [
  'Show one primary Image 1 SKU instance with sufficient exposure in the final image.',
  'A secondary product display using the Image 1 SKU is allowed when it improves product visibility and does not look like accidental duplication.',
] as const;

const SKU_HIT_MAIN_PHYSICS_RULES = [
  'All tools, scrapers, brushes, and applicators must be physically supported: held by a natural visible hand applying pressure, resting on a surface, or actively contacting the repair surface.',
  'Never show floating scrapers, hovering spatulas, unsupported putty blobs, or objects without believable grip, contact, or cast shadow.',
  'Keep one coherent light direction; shadows, highlights, and reflections must agree across product, hands, tools, walls, furniture, and table surfaces.',
  'Keep realistic product scale relative to hands, walls, furniture, and repair areas; the SKU may be prominent but must not become an oversized hero jar that breaks room perspective.',
  'Putty, paste, cream, and gel must behave realistically: spread from contact points, follow gravity, level fill in open jars, and avoid impossible stiff whipped-cream peaks or floating clumps.',
  'Before/after inset patches must match the wall material and lighting of the main scene; the final image must read as one believable photograph, not pasted layers.',
] as const;

const SKU_HIT_MAIN_ANTI_TEMPLATE_FORBIDDEN = [
  'Never use the generic AI ecommerce template: a horizontal row of three hexagonal or circular icon badges, each with a short benefit slogan underneath.',
  'Do not add new 3-icon feature rows, hex badge grids, or equivalent small-icon selling-point modules unless Image 2 reference clearly already uses that exact module.',
] as const;

export interface SkuHitMainConstraintSpec {
  feature: 'sku_hit_main_image';
  task: 'sku_hit_main_image';
  image_roles: {
    image_1: string;
    image_2: string;
  };
  authority_policy: string[];
  must_preserve: string[];
  product_replacement: string[];
  usage_scene_policy: string[];
  physics_realism: string[];
  differentiation: string[];
  copy_overrides: string[];
  forbidden: string[];
  output_target: string[];
  final_check: string[];
  user_fields: {
    brand?: string;
    product_name?: string;
    capacity?: string;
  };
  batch_slot?: string;
  user_supplement?: string;
  user_negative?: string;
}

export function buildSkuHitMainConstraintSpec(request: ImageTaskRequest): SkuHitMainConstraintSpec {
  const brand = request.brand?.trim();
  const productName = request.productName?.trim();
  const capacity = normalizeNetCapacity(request.capacity);

  return {
    feature: 'sku_hit_main_image',
    task: 'sku_hit_main_image',
    image_roles: {
      image_1: 'New SKU product image. The only allowed product identity and packaging standard.',
      image_2: 'Viral main-image reference. Inherit marketing theme, core English copy, product use case, target object, usage-scene type, selling logic, and before/after intent.',
    },
    authority_policy: [
      'Image 1 controls the exact SKU product identity, packaging structure, material, color, transparency, label, brand, product name, capacity, and physical appearance.',
      'Image 2 reference image controls the advertised use case, target object, visible headline/subheadline, explicit marketing copy in its original language, selling angle, usage-scene type, and before/after promise.',
      'When authorities conflict, use Image 1 for the physical SKU and Image 2 for the advertisement, scene, target object, and marketing copy; do not derive a new use case from the Image 1 SKU label.',
    ],
    must_preserve: [
      'Preserve Image 2 reference visible headline, subheadline, explicit marketing copy in its original language, advertised use case, target object, selling angle, and before/after marketing structure.',
      'Preserve Image 2 comparison intent and repair-result promise, but redesign the presentation.',
      'Preserve Image 1 SKU identity and packaging exactly; never redesign the product itself.',
    ],
    product_replacement: [
      'Remove the original product from Image 2 and insert the Image 1 SKU.',
      'Lock Image 1 packaging structure, aspect ratio, container shape, cap/opening, material, color, transparency, label visuals, and overall identity.',
      'The Image 1 cap, pump, trigger, nozzle, collar, opening, and dispensing mechanism are immutable: copy their exact type and geometry from Image 1 (a pump stays a pump and a trigger stays a trigger).',
      'Never borrow, merge, transplant, or retain any product part, cap, pump, trigger, nozzle, collar, bottle piece, label, or accessory from the Image 2 reference product.',
      'If Image 1 uses a pump or atomizer, show that same pump or atomizer in use; never convert it into the Image 2 trigger sprayer or another dispenser.',
      'Never stretch, compress, slim, widen, or redesign Image 1.',
      'Derive overall ad palette primarily from Image 1 label colors.',
      'This is not a plain white-background full-bottle SKU shot.',
      ...SKU_HIT_MAIN_SINGLE_PRODUCT_RULES,
    ],
    usage_scene_policy: [
      'Build the demo/usage scene from Image 2 reference advertised use case, target object, and usage-scene type, not from Image 1 SKU label category.',
      'Image 2 provides the headline, subheadline, selling angle, before/after logic, and scene problem to communicate.',
      'Image 1 provides the exact product that performs the repair, not a new problem category or replacement headline.',
      'Do not copy Image 2 literal scene objects, camera angle, layout, props, or composition.',
      'For before/after, compare the same localized area of the same target object with aligned perspective and boundaries; do not substitute unrelated left/right areas.',
    ],
    physics_realism: [...SKU_HIT_MAIN_PHYSICS_RULES],
    differentiation: buildDifferentiationLines(request),
    copy_overrides: buildCopyOverrideLines({ brand, productName, capacity }),
    forbidden: [
      'Never copy Image 2 composition or paste Image 1 onto the reference layout.',
      'Never redesign Image 1 packaging or label artwork.',
      'Never use recolor-only, mirror/flip, or headline-only nudge variants.',
      'Never let Image 1 SKU label category override Image 2 reference advertised use case or target object in the usage scene.',
      'Never rewrite Image 2 reference headline or use case merely because Image 1 SKU label uses a different category name.',
      'Never show floating tools, unsupported product clumps, impossible material physics, or inconsistent scale.',
      ...SKU_HIT_MAIN_ANTI_TEMPLATE_FORBIDDEN,
    ],
    output_target: [
      'Return one high-click US Temu / Amazon ecommerce main image at the user-selected aspect ratio.',
      'Inherit Image 2 reference selling points, never inherit Image 2 layout.',
      'Return only the final image, not analysis.',
    ],
    final_check: buildFinalCheckLines(),
    user_fields: {
      ...(brand ? { brand } : {}),
      ...(productName ? { product_name: productName } : {}),
      ...(capacity ? { capacity } : {}),
    },
    ...(resolveBatchSlotDirective(request) ? { batch_slot: resolveBatchSlotDirective(request) } : {}),
    ...(request.prompt?.trim() ? { user_supplement: request.prompt.trim() } : {}),
    ...(request.negativePrompt?.trim() ? { user_negative: request.negativePrompt.trim() } : {}),
  };
}

export function renderSkuHitMainExecutionPrompt(
  spec: SkuHitMainConstraintSpec,
  creativePlan: string,
): string {
  const sections = [
    ['IMAGE ROLES:', `Image 1 = ${spec.image_roles.image_1}`, `Image 2 = ${spec.image_roles.image_2}`].join('\n'),
    ['AUTHORITY POLICY:', ...spec.authority_policy].join('\n'),
    ['MUST PRESERVE:', ...spec.must_preserve].join('\n'),
    ['PRODUCT REPLACEMENT (HIGHEST PRIORITY):', ...spec.product_replacement].join('\n'),
    ['USAGE SCENE POLICY:', ...spec.usage_scene_policy].join('\n'),
    ['PHYSICS REALISM:', ...spec.physics_realism].join('\n'),
    ['MAJOR DIFFERENTIATION:', ...spec.differentiation].join('\n'),
    ['COPY AND FIELD OVERRIDES:', ...spec.copy_overrides].join('\n'),
    spec.user_negative || spec.user_supplement
      ? [
        'BOUNDED USER INPUT:',
        spec.user_negative
          ? `User negative prompt (higher priority than supplemental; forbidden elements only; if they conflict, obey this):\n${spec.user_negative}`
          : '',
        spec.user_supplement
          ? `User supplemental requirements (apply only when they do not violate the rules above or the user negative):\n${spec.user_supplement}`
          : '',
      ].filter(Boolean).join('\n')
      : '',
    `MAIN IMAGE DESIGN PLAN:\n${creativePlan.trim()}`,
    ['FORBIDDEN:', ...spec.forbidden].join('\n'),
    spec.batch_slot ? spec.batch_slot : '',
    ['FINAL CHECK:', ...spec.final_check].join('\n'),
    ['OUTPUT TARGET:', ...spec.output_target].join('\n'),
  ];

  return sections.filter(Boolean).join('\n\n');
}

function buildDifferentiationLines(request: ImageTaskRequest): string[] {
  const lines = [
    'Change at least 3 dimensions in every output: product placement, product scale, headline placement, scene composition, camera angle, depth, before/after presentation, info-block layout, background structure, and product-to-scene relationship.',
    'Regenerate concrete scene assets, angles, and composition; do not reuse Image 2 objects or viewpoint.',
    'Keep the Image 1 SKU clearly visible and readable, but preserve realistic scale relative to hands, furniture, walls, and repair areas; never use an oversized foreground jar that breaks room perspective.',
  ];

  if (request.variantTotal && request.variantTotal > 1) {
    lines.push('Every output in the same batch must use a visibly different composition; recolor-only variants are forbidden.');
  }

  return lines;
}

function buildCopyOverrideLines(fields: {
  brand?: string;
  productName?: string;
  capacity?: string;
}): string[] {
  const lines: string[] = [];
  if (fields.brand) {
    lines.push(`Brand: ${quoted(fields.brand)}`);
  }
  if (fields.productName) {
    lines.push(`Product name: ${quoted(fields.productName)}`);
  }
  if (fields.capacity) {
    lines.push(`Capacity: ${quoted(fields.capacity)}`);
  }
  if (fields.brand || fields.productName || fields.capacity) {
    lines.push('User-filled brand, product name, and capacity override matching words in Image 1, including headline blocks.');
  } else {
    lines.push('When the user does not provide product name or capacity, read those SKU identity fields from Image 1 visible label copy; do not derive the advertised use case from Image 1.');
  }
  lines.push('Use only marketing wording actually visible in Image 2 or explicitly supplied by the user; preserve its original language. If Image 2 has no readable English, do not invent, translate, or promote Image 1 SKU label copy into a new ad headline unless the user explicitly requests translation or new copy.');
  lines.push('Every visible capacity must start with the exact prefix "NET:".');
  lines.push('Allow headline resizing and repositioning while keeping Image 2 reference marketing copy recognizable; never add fake English or meaningless icon clutter.');
  return lines;
}

function resolveBatchSlotDirective(request: ImageTaskRequest): string | undefined {
  const total = request.variantTotal ?? (request.count > 1 ? request.count : undefined);
  const index = request.variantIndex;
  if (!index || !total || total <= 1) {
    return undefined;
  }
  return `This is batch output ${index}/${total}. Use a visibly different composition from the other outputs while keeping the same marketing promise.`;
}

function buildFinalCheckLines(): string[] {
  return [
    'The final image must contain one clear primary Image 1 SKU instance with sufficient exposure; a secondary product display is allowed when natural and useful.',
    'Image 2 reference headline, subheadline, advertised use case, target object, and before/after promise must remain recognizable after the redesign.',
    'Every tool or applicator must have a visible hand, surface support, or believable contact with the repair surface.',
    'No floating scrapers, hovering product clumps, impossible jar peaks, or mismatched lighting between foreground product and background scene.',
    'Physics realism and packaging lock override any conflicting design plan wording.',
  ];
}

function quoted(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function normalizeNetCapacity(raw?: string) {
  const capacity = raw?.trim().replace(/^(?:net\s*[:：]?\s*)+/i, '').trim();
  return capacity ? `NET: ${capacity}` : '';
}
