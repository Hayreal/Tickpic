/** Headline + SKU overlay rules shared with product_main_image carousel cards. */
export const PRODUCT_MAIN_IMAGE_HEADLINE_RULES = [
  'Place headline copy only in the upper-left, upper-right, or a top banner; never in the middle of the frame.',
  'Render at most two headline lines total: either one or two main-title lines, or one kicker/subtitle line plus one main-title line.',
  'Set every headline line on a level horizontal baseline with no italic slant, diagonal skew, or perspective warping.',
  'Use visible type effects (outline, shadow, color slab, two-tone fill, accent shape) without rotating or tilting the type.',
] as const;

export const PRODUCT_MAIN_IMAGE_SKU_OVERLAY_RULES = [
  'Composite the SKU as one floating graphic cutout only in the lower-left or lower-right.',
  'Keep the bottle upright with zero rotation and the label facing camera; never place the SKU in the middle or upper area.',
  'Do not stand the SKU on any surface; do not add a ground contact shadow; a very soft graphic separation shadow is OK.',
  'Do not let the SKU cutout cover the headline zone or Before/After evidence.',
] as const;

export function productMainImageHeadlineRulesText(): string {
  return PRODUCT_MAIN_IMAGE_HEADLINE_RULES.join(' ');
}

export function productMainImageSkuOverlayRulesText(): string {
  return PRODUCT_MAIN_IMAGE_SKU_OVERLAY_RULES.join(' ');
}

export function productMainImageLayoutRulesForHitMain(showProduct: boolean): string[] {
  return showProduct
    ? [...PRODUCT_MAIN_IMAGE_HEADLINE_RULES, ...PRODUCT_MAIN_IMAGE_SKU_OVERLAY_RULES]
    : [...PRODUCT_MAIN_IMAGE_HEADLINE_RULES];
}
