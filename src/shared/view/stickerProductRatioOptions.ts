export const STICKER_PRODUCT_RATIO_OPTIONS = [
  { value: '21:5', label: '罐子' },
  { value: '21:10', label: '高罐子' },
  { value: '9:12', label: '瓶装' },
] as const;

export type StickerProductRatioValue = typeof STICKER_PRODUCT_RATIO_OPTIONS[number]['value'];

export type StickerProductRatioSelection = StickerProductRatioValue | '';

export const STICKER_PRODUCT_RATIO_NONE: StickerProductRatioSelection = '';

export function isStickerProductRatioPreset(value: string): value is StickerProductRatioValue {
  return STICKER_PRODUCT_RATIO_OPTIONS.some((option) => option.value === value);
}

export function resolveStickerProductRatio(value?: string): StickerProductRatioSelection {
  return value && isStickerProductRatioPreset(value)
    ? (value as StickerProductRatioValue)
    : STICKER_PRODUCT_RATIO_NONE;
}

export function stickerProductRatioLabel(value: StickerProductRatioValue): string {
  return STICKER_PRODUCT_RATIO_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
