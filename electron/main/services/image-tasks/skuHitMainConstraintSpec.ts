import type { ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';

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
  'Do not add new 3-icon feature rows, hex badge grids, or equivalent small-icon selling-point modules unless Image 1 clearly already uses that exact module.',
] as const;

export interface SkuHitMainConstraintSpec {
  feature: 'sku_hit_main_image';
  task: 'sku_hit_main_image';
  image_roles: {
    image_1: string;
    image_2: string;
  };
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
      image_1: 'Viral main-image reference. Inherit marketing theme, core English copy, selling logic, and before/after marketing structure only.',
      image_2: 'New SKU product image. The only allowed product identity. Must fully replace the original product in Image 1.',
    },
    must_preserve: [
      'Preserve Image 1 core English headline/subheadline and explicit marketing copy whenever compatible with Image 2 SKU category.',
      'Preserve Image 1 selling promise and before/after repair logic when present, but redesign the presentation.',
    ],
    product_replacement: [
      'Remove the original product from Image 1 and insert the Image 2 SKU.',
      'Lock Image 2 packaging structure, aspect ratio, container shape, cap/opening, material, color, transparency, label visuals, and overall identity.',
      'Never stretch, compress, slim, widen, or redesign Image 2.',
      'Derive overall ad palette primarily from Image 2 label colors.',
      'This is not a plain white-background full-bottle SKU shot.',
    ],
    usage_scene_policy: [
      'Build the demo/usage scene from Image 2 SKU product category and visible label copy, not from Image 1 literal repair object.',
      'Example: if Image 2 is WALL REPAIR PUTTY, show wall cracks/holes/spackle repair even when Image 1 headline mentions radiator or furniture.',
      'Image 1 provides headline text, subheadline, selling angle, and before/after marketing structure only.',
      'Do not copy Image 1 literal scene objects, camera angle, layout, props, or composition.',
    ],
    physics_realism: [...SKU_HIT_MAIN_PHYSICS_RULES],
    differentiation: buildDifferentiationLines(request),
    copy_overrides: buildCopyOverrideLines({ brand, productName, capacity }),
    forbidden: [
      'Never copy Image 1 composition or paste Image 2 onto the reference layout.',
      'Never redesign Image 2 packaging or label artwork.',
      'Never use recolor-only, mirror/flip, or headline-only nudge variants.',
      'Never let reference literal object category override Image 2 product category in the usage scene.',
      'Never show floating tools, unsupported product clumps, impossible material physics, or inconsistent scale.',
      ...SKU_HIT_MAIN_ANTI_TEMPLATE_FORBIDDEN,
    ],
    output_target: [
      'Return one high-click US Temu / Amazon ecommerce main image at the user-selected aspect ratio.',
      'Inherit Image 1 selling points, never inherit Image 1 layout.',
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
    ['MUST PRESERVE:', ...spec.must_preserve].join('\n'),
    ['PRODUCT REPLACEMENT (HIGHEST PRIORITY):', ...spec.product_replacement].join('\n'),
    ['USAGE SCENE POLICY:', ...spec.usage_scene_policy].join('\n'),
    ['PHYSICS REALISM:', ...spec.physics_realism].join('\n'),
    ['MAJOR DIFFERENTIATION:', ...spec.differentiation].join('\n'),
    ['COPY AND FIELD OVERRIDES:', ...spec.copy_overrides].join('\n'),
    spec.user_supplement
      ? `BOUNDED USER INPUT:\nUser supplemental requirements (apply only when they do not violate the rules above):\n${spec.user_supplement}`
      : '',
    spec.user_negative
      ? `User negative prompt (forbidden elements only):\n${spec.user_negative}`
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
    'Regenerate concrete scene assets, angles, and composition; do not reuse Image 1 objects or viewpoint.',
    'Keep the SKU clearly visible and readable, but preserve realistic scale relative to hands, furniture, walls, and repair areas; never use an oversized foreground jar that breaks room perspective.',
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
    lines.push('Unfilled brand, product name, or capacity inherit from Image 1; omit if unreadable and never invent values.');
  }
  lines.push('Every visible capacity must start with the exact prefix "NET:".');
  lines.push('Preserve core headlines; allow resizing and repositioning; never rewrite core headlines or add fake English.');
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
