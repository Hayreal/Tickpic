export const SKU_IMAGE_COUNT_OPTIONS = [1, 2, 3, 6] as const;

export type SkuImageCountValue = typeof SKU_IMAGE_COUNT_OPTIONS[number];

export const DEFAULT_SKU_REPLICA_COUNT: SkuImageCountValue = 1;

export const DEFAULT_SKU_VARIATION_COUNT: SkuImageCountValue = 1;

export const DEFAULT_SKU_ORIGINAL_COUNT: SkuImageCountValue = 1;

export const DEFAULT_SKU_HIT_MAIN_COUNT: SkuImageCountValue = 1;

export const DEFAULT_SKU_BRAND = 'wkau';

export function resolveSkuImageCount(count: number, fallback: SkuImageCountValue = DEFAULT_SKU_REPLICA_COUNT): SkuImageCountValue {
  return (SKU_IMAGE_COUNT_OPTIONS as readonly number[]).includes(count)
    ? (count as SkuImageCountValue)
    : fallback;
}
