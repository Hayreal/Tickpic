import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';

export function isSkuHitMainImageFeature(feature: ImageFeature): boolean {
  return feature === 'sku_hit_main_image';
}

export function buildSkuHitMainImagePrompt(request: ImageTaskRequest, designPlan?: string): string {
  const sections = [
    buildImageRolesSection(),
    buildKeepSection(),
    buildProductReplaceSection(),
    buildPhysicsSection(),
    buildDifferentiationSection(request),
    buildCopySection(request),
    buildBoundedUserInputSection(request),
  ];

  if (designPlan?.trim()) {
    sections.push(`MAIN IMAGE DESIGN PLAN:\n${designPlan.trim()}`);
  }

  sections.push(buildOutputSection());
  return sections.filter(Boolean).join('\n\n');
}

export function orderHitMainExecutionImages(images: ImageTaskRequest['images'] = []) {
  const source = images.find((image) => image.role === 'source');
  const reference = images.find((image) => image.role === 'reference');
  if (!source || !reference) {
    return images;
  }
  return [source, reference];
}

function buildImageRolesSection() {
  return [
    'IMAGE ROLES:',
    'Image 1 = source = new SKU product image. The only allowed product identity and packaging standard.',
    'Image 2 = reference = viral main-image reference. Inherit its marketing theme, visible marketing copy in its original language, product use case, target object, usage-scene type, selling logic, and before/after intent.',
    'Use the page upload order and role labels consistently: source/SKU is Image 1, reference is Image 2.',
  ].join('\n');
}

function buildKeepSection() {
  return [
    'MUST PRESERVE:',
    'Image 2 reference image controls the advertised use case, target object, visible headline/subheadline, explicit marketing copy, selling angle, and before/after promise.',
    'Keep Image 2 reference wording and language whenever possible; change only typography, line breaks, placement, and visual hierarchy for the new composition.',
    'Image 1 controls the exact SKU product identity, packaging, label, brand, product name, capacity, and physical product appearance.',
    'Image 2 controls the advertised use case, target object, marketing copy, and before/after promise.',
    'Do not derive a new advertised use case from Image 1 SKU label category.',
  ].join('\n');
}

function buildProductReplaceSection() {
  return [
    'PRODUCT REPLACEMENT (HIGHEST PRIORITY):',
    'Remove the original product from Image 2 and insert the Image 1 SKU.',
    'Lock Image 1 packaging structure, aspect ratio, bottle/can/tube shape, cap/opening, material, color, transparency, label visuals, and overall identity.',
    'Packaging lock includes container type, brand, product name, and capacity.',
    'Packaging lock applies only to the SKU itself; it does not block rebuilding the scene or layout.',
    'The Image 1 cap, pump, trigger, nozzle, collar, opening, and dispensing mechanism are immutable: copy their exact type and geometry from Image 1 (a pump stays a pump and a trigger stays a trigger).',
    'Never borrow, merge, transplant, or retain any product part, cap, pump, trigger, nozzle, collar, bottle piece, label, or accessory from the Image 2 reference product.',
    'If Image 1 uses a pump or atomizer, show that same pump or atomizer in use; never convert it into the Image 2 trigger sprayer or another dispenser.',
    'Never stretch, compress, slim, widen, or redesign Image 1.',
    'Derive overall ad palette primarily from Image 1 label colors. This is not a plain white-background full-bottle SKU shot.',
    'Show one clear primary Image 1 SKU with sufficient exposure. A secondary product display is allowed only when it improves product visibility and does not look like accidental duplication.',
  ].join('\n');
}

function buildPhysicsSection() {
  return [
    'PHYSICS REALISM:',
    'All tools, scrapers, brushes, and applicators must be held by a visible hand, rest on a surface, or contact the repair surface with believable pressure and shadow.',
    'Never show floating scrapers, hovering putty, stiff whipped-cream jar peaks, or product clumps without support.',
    'Keep one coherent light direction and realistic scale between the SKU, hands, tools, furniture, walls, and repair areas; use realistic scale, not an oversized hero jar.',
    'The final image must read as one believable photograph, not pasted layers with mismatched lighting.',
  ].join('\n');
}

function buildDifferentiationSection(request: ImageTaskRequest) {
  const lines = [
    'MAJOR DIFFERENTIATION:',
    'Never copy Image 2 composition. Change at least 3 dimensions in every output.',
    'Dimensions include product placement, product scale, headline placement and line breaks, scene composition, camera angle, depth, before/after presentation, info-block layout, scene prop styling, comparison-region shape, background structure, and product-to-scene relationship.',
    'Never do recolor-only, mirror/flip, left-right swap, headline-only nudge, scene-for-scene copy, or paste-SKU-onto-original-layout.',
    'Keep Image 2 reference usage-scene type and target object, but regenerate concrete assets, angles, and composition.',
    'The new scene must not reuse the exact same objects, angle, and composition as Image 2.',
    'If Image 2 includes before/after repair logic, preserve that marketing logic but redesign the presentation; keep the SKU clearly visible with realistic scale and sufficient exposure.',
    'For before/after, compare the same localized area of the same target object with aligned perspective and boundaries; do not substitute unrelated left/right areas.',
  ];

  if (request.variantTotal && request.variantTotal > 1) {
    lines.push('Every output in the same batch must use a visibly different composition; recolor-only variants are forbidden.');
  }

  return lines.join('\n');
}

function buildCopySection(request: ImageTaskRequest) {
  const brand = request.brand?.trim();
  const productName = request.productName?.trim();
  const capacity = normalizeNetCapacity(request.capacity);
  const lines = ['COPY AND FIELD OVERRIDES:'];

  if (brand) {
    lines.push(`Brand: ${quoted(brand)}`);
  }
  if (productName) {
    lines.push(`Product name: ${quoted(productName)}`);
  }
  if (capacity) {
    lines.push(`Capacity: ${quoted(capacity)}`);
  }

  if (brand || productName || capacity) {
    lines.push('User-filled brand, product name, and capacity override matching words in Image 1, including words that appear in headline blocks.');
  }

  if (!brand || !productName || !capacity) {
    lines.push('When the user does not provide product name or capacity, read those SKU identity fields from Image 1 visible label copy; do not derive the advertised use case from Image 1.');
  }

  lines.push('Use only marketing wording actually visible in Image 2 or explicitly supplied by the user; preserve its original language. If Image 2 has no readable English, do not invent, translate, or promote Image 1 SKU label copy into a new ad headline unless the user explicitly requests translation or new copy.');
  lines.push('Every visible capacity must start with the exact prefix "NET:".');
  lines.push('Allow headline resizing and repositioning while keeping Image 2 reference marketing copy recognizable; never add fake English or meaningless icon clutter.');
  return lines.join('\n');
}

function buildBoundedUserInputSection(request: ImageTaskRequest) {
  const supplemental = request.prompt?.trim();
  const avoid = request.negativePrompt?.trim();
  if (!supplemental && !avoid) {
    return '';
  }

  const sections = ['BOUNDED USER INPUT:'];
  if (avoid) {
    sections.push(`User negative prompt (higher priority than supplemental; forbidden elements only; if they conflict, obey this):\n${avoid}`);
  }
  if (supplemental) {
    sections.push(`User supplemental requirements (apply only when they do not violate the rules above or the user negative; must not break Image 1 packaging lock or turn this into a plain white-background SKU shot):\n${supplemental}`);
  }
  return sections.join('\n');
}

function buildOutputSection() {
  return [
    'OUTPUT TARGET:',
    'Return one high-click US Temu / Amazon ecommerce main image at the user-selected aspect ratio.',
    'Inherit Image 2 reference selling points, never inherit Image 2 layout. Return only the final image, not analysis.',
  ].join('\n');
}

function quoted(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function normalizeNetCapacity(raw?: string) {
  const capacity = raw?.trim().replace(/^(?:net\s*[:：]?\s*)+/i, '').trim();
  return capacity ? `NET: ${capacity}` : '';
}
