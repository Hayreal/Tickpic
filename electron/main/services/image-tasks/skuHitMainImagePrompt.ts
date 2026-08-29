import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';

export function isSkuHitMainImageFeature(feature: ImageFeature): boolean {
  return feature === 'sku_hit_main_image';
}

export function buildSkuHitMainImagePrompt(request: ImageTaskRequest, designPlan?: string): string {
  const sections = [
    buildImageRolesSection(),
    buildKeepSection(),
    buildProductReplaceSection(),
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
  const reference = images.find((image) => image.role === 'reference');
  const source = images.find((image) => image.role === 'source');
  if (!reference || !source) {
    return images;
  }
  return [reference, source];
}

function buildImageRolesSection() {
  return [
    'IMAGE ROLES:',
    'Image 1 = reference = viral main-image reference. Inherit marketing theme, core English copy, product use case / usage-scene type, and selling logic. Not a packaging-label reference.',
    'Image 2 = source = new SKU product image. The only allowed product identity. Must fully replace the original product in Image 1.',
    'Even if source appears before reference in the array, always call reference Image 1 and source Image 2.',
    'Follow role labels, not upload array order.',
  ].join('\n');
}

function buildKeepSection() {
  return [
    'MUST PRESERVE:',
    'Preserve Image 1 marketing theme, core English headline/subheadline, and explicit marketing copy; keep original wording whenever possible.',
    'Preserve Image 1 product use case and usage-scene type; do not change the problem being solved.',
    'If Image 1 targets a specific object, every output must stay on that object category.',
  ].join('\n');
}

function buildProductReplaceSection() {
  return [
    'PRODUCT REPLACEMENT (HIGHEST PRIORITY):',
    'Remove the original product from Image 1 and insert the Image 2 SKU.',
    'Lock Image 2 packaging structure, aspect ratio, bottle/can/tube shape, cap/opening, material, color, transparency, label visuals, and overall identity.',
    'Packaging lock includes container type, brand, product name, and capacity.',
    'Packaging lock applies only to the SKU itself; it does not block rebuilding the scene or layout.',
    'Never stretch, compress, slim, widen, or redesign Image 2.',
    'Derive overall ad palette primarily from Image 2 label colors. This is not a plain white-background full-bottle SKU shot.',
  ].join('\n');
}

function buildDifferentiationSection(request: ImageTaskRequest) {
  const lines = [
    'MAJOR DIFFERENTIATION:',
    'Never copy Image 1 composition. Change at least 3 dimensions in every output.',
    'Dimensions include product placement, product scale, headline placement and line breaks, scene composition, camera angle, depth, before/after presentation, info-block layout, scene prop styling, comparison-region shape, background structure, and product-to-scene relationship.',
    'Never do recolor-only, mirror/flip, left-right swap, headline-only nudge, scene-for-scene copy, or paste-SKU-onto-original-layout.',
    'Keep Image 1 usage-scene type, but regenerate concrete assets, angles, and composition.',
    'The new scene must not reuse the exact same objects, angle, and composition as Image 1.',
    'If Image 1 includes before/after repair logic, preserve that marketing logic but redesign the presentation; the product must have strong exposure and must not appear too small.',
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
    lines.push('Unfilled brand, product name, or capacity inherit from Image 1; omit if unreadable and never invent values.');
  }

  lines.push('Every visible capacity must start with the exact prefix "NET:".');
  lines.push('Preserve core headlines; resizing and repositioning are allowed; never rewrite core headlines, add fake English, or add meaningless icon clutter.');
  lines.push('All visible marketing copy should read as natural English; translate any non-English source copy into equivalent English.');
  return lines.join('\n');
}

function buildBoundedUserInputSection(request: ImageTaskRequest) {
  const supplemental = request.prompt?.trim();
  const avoid = request.negativePrompt?.trim();
  if (!supplemental && !avoid) {
    return '';
  }

  const sections = ['BOUNDED USER INPUT:'];
  if (supplemental) {
    sections.push(`User supplemental requirements (apply only when they do not violate the rules above; must not break Image 2 packaging lock or turn this into a plain white-background SKU shot):\n${supplemental}`);
  }
  if (avoid) {
    sections.push(`User negative prompt (forbidden elements only):\n${avoid}`);
  }
  return sections.join('\n');
}

function buildOutputSection() {
  return [
    'OUTPUT TARGET:',
    'Return one high-click US Temu / Amazon ecommerce main image at the user-selected aspect ratio.',
    'Inherit Image 1 selling points, never inherit Image 1 layout. Return only the final image, not analysis.',
  ].join('\n');
}

function quoted(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function normalizeNetCapacity(raw?: string) {
  const capacity = raw?.trim().replace(/^(?:net\s*[:：]?\s*)+/i, '').trim();
  return capacity ? `NET: ${capacity}` : '';
}
