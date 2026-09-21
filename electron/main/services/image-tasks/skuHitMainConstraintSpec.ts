import type { ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import { productMainImageLayoutRulesForHitMain } from '../../../../src/shared/domain/productSetMainImageLayoutRules.js';

const SKU_HIT_MAIN_ANTI_TEMPLATE_FORBIDDEN = [
  'Never use the generic AI ecommerce template: a horizontal row of three hexagonal or circular icon badges, each with a short benefit slogan underneath.',
  'Do not add new 3-icon feature rows, hex badge grids, or equivalent small-icon selling-point modules unless Image 2 reference clearly already uses that exact module.',
] as const;

export interface SkuHitMainConstraintSpec {
  feature: 'sku_hit_main_image';
  task: 'sku_hit_main_image';
  show_product: boolean;
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
    headline?: string;
  };
  batch_slot?: string;
  user_supplement?: string;
  user_negative?: string;
}

export function resolveSkuHitMainShowProduct(request: ImageTaskRequest): boolean {
  return request.showProduct !== false;
}

export function buildSkuHitMainConstraintSpec(request: ImageTaskRequest): SkuHitMainConstraintSpec {
  const brand = request.brand?.trim();
  const productName = request.productName?.trim();
  const capacity = normalizeNetCapacity(request.capacity);
  const headline = request.headline?.trim();
  const showProduct = resolveSkuHitMainShowProduct(request);

  return {
    feature: 'sku_hit_main_image',
    task: 'sku_hit_main_image',
    show_product: showProduct,
    image_roles: {
      image_1: 'source = new SKU product image. The only allowed product identity and packaging standard.',
      image_2: 'reference = viral main-image reference. Inherit marketing theme, core English copy, product use case, target object, usage-scene type, selling logic, and before/after intent.',
    },
    authority_policy: [
      'Image 1 controls the exact SKU product identity, packaging structure, material, color, transparency, label, brand, product name, capacity, physical appearance, and the product type used to keep the scene relationship coherent.',
      'Image 2 reference image controls the advertised use case, target object, visible headline/subheadline, explicit marketing copy in its original language, selling angle, usage-scene type, and before/after promise.',
      'When authorities conflict, keep Image 1 packaging and product effect, but keep Image 2’s visible cropped surface and marketing copy; do not complete that crop into a larger host object from the Image 1 SKU label.',
    ],
    must_preserve: [
      'Preserve Image 2 reference visible headline, subheadline, and explicit marketing copy in its original language; keep the advertised use case, target object, and selling angle.',
      'Keep Image 2’s visible surface as a crop; never complete it into a larger host object inferred from Image 1.',
      'Always include a Before/After comparison of the advertised problem. If Image 2 already shows one, keep that marketing logic but restyle it; if it does not, add a tight comparison of the same cropped surface.',
      ...(showProduct
        ? ['Preserve Image 1 SKU identity and packaging exactly; composite it as a floating graphic cutout and never redraw or stand the product in the scene.']
        : ['Do not preserve or render Image 1 SKU packaging anywhere in the frame.']),
    ],
    product_replacement: showProduct ? buildShowProductReplacement() : buildHideProductReplacement(),
    usage_scene_policy: [
      'Keep Image 2’s visible cropped surface and advertised problem; restyle lighting or crop tightness only, do not expand the scene.',
      'Image 2 provides the headline, subheadline, selling angle, before/after logic, and the visible surface to treat.',
      showProduct
        ? 'Understand Image 1 for the product effect on that cropped surface; Image 1 does not supply a replacement headline or extra objects.'
        : 'Communicate the advertised use case through the scene, headline, and before/after evidence only; Image 1 is identity reference, not a visible product.',
      'Do not copy Image 2 layout, holding hand, or camera; do keep the same visible cropped surface.',
      showProduct
        ? 'Keep the frame simple: one usage scene, one headline, one Before/After, and at most one SKU layer. No extra info blocks, icon rows, callout stacks, or collage modules.'
        : 'Keep the frame simple: one usage scene, one headline, and one Before/After. No SKU layer, brand logo, wordmark, info blocks, or collage modules.',
      'Every output must include Before/After of the same cropped surface; BEFORE problem must be obvious, AFTER improvement clear, and material changes must stay believable.',
    ],
    physics_realism: buildHandRules(showProduct),
    differentiation: buildDifferentiationLines(request, showProduct),
    copy_overrides: buildCopyOverrideLines({ brand, productName, capacity, headline, showProduct }),
    forbidden: [
      'Never copy Image 2 composition or paste Image 1 onto the reference layout.',
      ...(showProduct
        ? [
          'Never redraw, restage, or regenerate Image 1 as a 3D bottle inside the scene.',
          'Never generate a handheld second bottle or any extra SKU instance.',
        ]
        : ['Never overlay, draw, or imply Image 1 SKU, packaging, bottle, brand logo, wordmark, or ® mark in the frame.']),
      'Never let a hand hold, grip, or operate a redrawn bottle.',
      'Never use recolor-only, mirror/flip, left-right product swap, headline-only nudge, scene-for-scene copy, or paste-SKU-onto-original-layout variants.',
      'Never let Image 1 SKU label category override Image 2’s visible cropped surface or advertised use case.',
      'Never complete Image 2’s cropped surface into a larger host object that is not fully shown, even if Image 1 label suggests another category.',
      'Never rewrite Image 2 reference headline or use case merely because Image 1 SKU label uses a different category name.',
      'Never add a standalone brand logo or wordmark outside the Image 1 SKU cutout.',
      'Never add many new selling points, garbled text, fake English, repeated copy, meaningless small type, extra info blocks, or a grid of feature icons.',
      'Never tilt, italicize, skew, perspective-warp, or diagonally stack headline type.',
      ...(showProduct
        ? ['Never place the Image 1 SKU cutout in the middle or upper headline zone.']
        : []),
      'Never over-design the layout with stacked modules, multiple comparison strips, or collage-like decoration.',
      ...SKU_HIT_MAIN_ANTI_TEMPLATE_FORBIDDEN,
    ],
    output_target: [
      'Return one high-click US Temu / Amazon ecommerce main image at the user-selected aspect ratio.',
      'The viewer must understand the problem, the result, and the product-scene relationship within 3 seconds.',
      'The image must look photographic and commercial: high contrast, high information efficiency, not cluttered, not templated.',
      'Inherit Image 2 selling points, never inherit Image 2 picture. Return only the final image, not analysis.',
    ],
    final_check: buildFinalCheckLines(showProduct),
    user_fields: {
      ...(brand ? { brand } : {}),
      ...(productName ? { product_name: productName } : {}),
      ...(capacity ? { capacity } : {}),
      ...(headline ? { headline } : {}),
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
  const core = creativePlan.trim() || defaultEditInstruction(spec);
  return [core, ...buildExecutionLockClauses(spec)].filter(Boolean).join(' ');
}

function defaultEditInstruction(spec: SkuHitMainConstraintSpec): string {
  return spec.show_product
    ? 'Composite Image 1 SKU as a floating graphic cutout layer on Image 2’s visible cropped surface; keep Image 1 packaging pixel-identical without redrawing the bottle, standing it on any surface, or adding a handheld second bottle, and add a simple Before/After of that same cropped surface; place the floating layer in unused space without covering the headline or comparison evidence.'
    : 'Remove every product bottle, brand logo, wordmark, and packaging; keep Image 2’s visible cropped surface, Image 2 headline wording, and a simple Before/After of that same surface; apply the change to the entire frame so no Image 1 SKU, logo, or brand mark appears.';
}

function buildExecutionLockClauses(spec: SkuHitMainConstraintSpec): string[] {
  const fields = spec.user_fields;
  return [
    spec.show_product
      ? 'Image 1 is the new SKU product photo only. Image 2 is the viral main-image reference. Do not treat Image 1 as the ad layout or keep Image 2’s original product.'
      : 'Image 1 is category reference only and must stay invisible. Image 2 is the viral main-image reference for scene and headline. Do not render Image 1 brand, logo, or packaging.',
    spec.show_product
      ? 'Composite Image 1 as one floating graphic cutout, like a Photoshop layer; do not stand it on any surface, and do not add a contact shadow or handheld second SKU.'
      : 'Do not overlay or render Image 1 SKU, packaging, bottle, brand logo, wordmark, or ® mark anywhere in the frame.',
    spec.user_fields.headline
      ? 'Understand Image 1 for the product effect on Image 2’s visible cropped surface, not to guess a larger host object. Keep that same cropped surface; do not copy Image 2 layout, holding hand, or camera, and do not complete the crop into objects Image 2 does not fully show. All visible text must be English. Never invent claims beyond the user headline and Image 2 selling evidence.'
      : 'Understand Image 1 for the product effect on Image 2’s visible cropped surface, not to guess a larger host object. Keep that same cropped surface; do not copy Image 2 layout, holding hand, or camera, and do not complete the crop into objects Image 2 does not fully show. All visible text must be English: translate Image 2 headlines and selling copy to correctly spelled natural English, and never invent claims Image 2 does not make.',
    'If a hand appears, keep five complete fingers and a visible thumb, and do not let it hold a bottle.',
    spec.show_product
      ? 'Always show one simple Before/After of the same cropped surface; do not copy Image 2’s comparison layout, and do not cover the comparison evidence with the SKU layer.'
      : 'Always show one simple Before/After of the same cropped surface; do not copy Image 2’s comparison layout, and do not place any SKU, logo, or brand mark on the comparison evidence.',
    ...productMainImageLayoutRulesForHitMain(spec.show_product),
    spec.show_product
      ? 'Keep the frame simple: one scene, one headline lockup, one Before/After, and at most one SKU layer. No extra info blocks, icon rows, callout stacks, or collage modules. Give the headline Image 2’s type energy with designed effects, not a flat single-style title.'
      : 'Keep the frame simple: one scene, one headline lockup, and one Before/After. No SKU layer, brand logo, info blocks, icon rows, or collage modules. Give the headline Image 2’s type energy with designed effects, not a flat single-style title.',
    spec.user_fields.headline
      ? `On-image headline: ${quoted(spec.user_fields.headline)}. Use this user title as the only main headline; translate to correctly spelled natural English if needed. Do not use Image 2 headline wording.`
      : '',
    'Never add a standalone brand logo, wordmark, or ® lockup outside the Image 1 SKU cutout.',
    ...(spec.show_product
      ? [
        fields.brand ? `If the SKU label brand must change, apply ${quoted(fields.brand)} only on the Image 1 cutout label, never as a separate logo.` : '',
        fields.product_name ? `Product name: ${quoted(fields.product_name)}.` : '',
        fields.capacity ? `Capacity: ${quoted(fields.capacity)}.` : '',
      ]
      : ['Do not render Image 1 brand, logo, product name, or capacity anywhere.']),
    spec.user_negative ? `Forbidden: ${spec.user_negative}` : '',
    spec.user_supplement ? `Also: ${spec.user_supplement}` : '',
    spec.batch_slot ?? '',
  ];
}

function buildShowProductReplacement(): string[] {
  return [
    'Composite Image 1 SKU as one floating graphic cutout on the rebuilt main-image scene, like a Photoshop layer.',
    'Do not stand, rest, or plant Image 1 on any surface; do not add a contact shadow, supporting pile, or shelf under the bottle.',
    'Treat Image 1 as a flat cutout layer: do not redraw, restage, or regenerate the bottle as a 3D object inside the scene.',
    'Keep Image 1 packaging, aspect ratio, cap/nozzle, label artwork, brand, product name, and capacity pixel-identical.',
    'The Image 1 cap, pump, trigger, nozzle, collar, opening, and dispensing mechanism are immutable: copy their exact type and geometry from Image 1 (a pump stays a pump and a trigger stays a trigger).',
    'Never borrow, merge, transplant, or retain any product part, cap, pump, trigger, nozzle, collar, bottle piece, label, or accessory from the Image 2 reference product.',
    'Never add a second SKU instance, handheld bottle, or background bottle.',
    'Place the layer only in the lower-left or lower-right foreground; do not cover the headline zone, demo target, or before/after evidence.',
    'Never stretch, compress, slim, widen, or redesign Image 1.',
    'Derive overall ad palette primarily from Image 1 label colors.',
  ];
}

function buildHideProductReplacement(): string[] {
  return [
    'Do not overlay or render Image 1 SKU anywhere in the frame.',
    'Do not show any bottle, packaging, brand logo, wordmark, ® mark, label, handheld product, or second product instance.',
    'Communicate the selling point only through the usage scene, headline, and before/after evidence.',
    'Never borrow, merge, transplant, or retain any product part, cap, pump, trigger, nozzle, collar, bottle piece, label, or accessory from the Image 2 reference product.',
  ];
}

function buildHandRules(showProduct: boolean): string[] {
  return [
    'If a hand appears, it must be anatomically complete: five fingers, a visible thumb, natural joints, and a continuous wrist; never omit, fuse, extra, reverse, or distort fingers.',
    'A visible hand may only gesture, point, or press toward the Image 2 target object; it must not hold, grip, or operate a redrawn bottle or any second SKU.',
    showProduct
      ? 'Never generate a handheld product instance. The Image 1 SKU appears only as the foreground layer, never in a hand.'
      : 'Never generate a handheld product instance. No bottle may appear in a hand or elsewhere in the frame.',
    'Keep one coherent light direction; if a hand appears, its shadow and skin tone must match the scene.',
    'If a tool appears, it must rest on a surface or contact the target with a believable shadow. This support rule applies to tools only, never to the Image 1 SKU layer, which must float as a graphic overlay.',
  ];
}

function buildDifferentiationLines(request: ImageTaskRequest, showProduct: boolean): string[] {
  const lines = [
    'Change headline or SKU placement enough to look newly designed; do not add extra scene objects or expand the crop.',
    'The first glance must read as a newly designed ad, not a recolored or product-swapped copy of Image 2.',
    'Keep Image 2’s visible cropped surface; do not complete it into a larger host object inferred from Image 1.',
    showProduct
      ? 'Keep the Image 1 SKU layer large enough to read in the lower-left or lower-right; never cover the headline zone or before/after evidence.'
      : 'Keep the frame focused on the usage scene, headline, and before/after evidence with no product layer.',
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
  headline?: string;
  showProduct: boolean;
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
  if (fields.headline) {
    lines.push(`On-image headline: ${quoted(fields.headline)}. Use this user title as the only main headline; translate to correctly spelled natural English if needed. Do not use Image 2 headline wording.`);
  } else {
    lines.push('Use only marketing wording actually visible in Image 2 or explicitly supplied by the user. Render it in English on the image; translate Chinese source copy to natural English. If Image 2 has no readable headline, do not invent or promote Image 1 SKU label copy into a new ad headline unless the user explicitly requests new copy.');
  }
  lines.push('Every visible capacity must start with the exact prefix "NET:".');
  lines.push('Give the headline Image 2’s type energy with designed effects and more than one weight or color, but keep type on level horizontal baselines without italic slant, diagonal skew, or perspective warping.');
  lines.push(...productMainImageLayoutRulesForHitMain(fields.showProduct));
  return lines;
}

function resolveBatchSlotDirective(request: ImageTaskRequest): string | undefined {
  const total = request.variantTotal ?? ((request.count ?? 0) > 1 ? request.count : undefined);
  const index = request.variantIndex;
  if (!index || !total || total <= 1) {
    return undefined;
  }
  return `This is batch output ${index}/${total}. Use a visibly different composition from the other outputs while keeping the same marketing promise.`;
}

function buildFinalCheckLines(showProduct: boolean): string[] {
  return [
    showProduct
      ? 'The final image must contain exactly one Image 1 SKU foreground layer with readable packaging in the lower-left or lower-right; never a handheld second bottle and never a middle/upper SKU placement.'
      : 'The final image must contain no SKU, bottle, packaging, or handheld product.',
    'Headline type must stay on level horizontal baselines with no italic slant, diagonal skew, or perspective warping.',
    'Image 2 reference headline, subheadline, advertised use case, target object, and before/after promise must remain recognizable after the redesign.',
    'If a hand appears, it must have five complete fingers and a visible thumb, and must not hold a bottle.',
    'No floating tools, mismatched lighting, or Image 2 product parts transplanted onto Image 1.',
    'SKU layer lock and hand anatomy override any conflicting edit instruction wording.',
  ];
}

function quoted(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function normalizeNetCapacity(raw?: string) {
  const capacity = raw?.trim().replace(/^(?:net\s*[:：]?\s*)+/i, '').trim();
  return capacity ? `NET: ${capacity}` : '';
}
