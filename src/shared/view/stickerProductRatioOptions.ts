export const STICKER_PRODUCT_RATIO_OPTIONS = [
  { value: '21:5', label: '罐子' },
  { value: '21:10', label: '高罐子' },
  { value: '9:12', label: '瓶装' },
] as const;

export type StickerProductRatioValue = typeof STICKER_PRODUCT_RATIO_OPTIONS[number]['value'];

export type StickerProductRatioSelection = StickerProductRatioValue | '';

export const STICKER_PRODUCT_RATIO_NONE: StickerProductRatioSelection = '';

export function resolveStickerProductRatio(value?: string): StickerProductRatioSelection {
  return STICKER_PRODUCT_RATIO_OPTIONS.some((option) => option.value === value)
    ? (value as StickerProductRatioValue)
    : STICKER_PRODUCT_RATIO_NONE;
}

export function stickerProductRatioLabel(value: StickerProductRatioValue): string {
  return STICKER_PRODUCT_RATIO_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

/** gpt-image-2 可用的精确像素尺寸（宽高均为 16 的倍数） */
export const STICKER_PRODUCT_RATIO_OPENAI_SIZES: Record<StickerProductRatioValue, string> = {
  '21:5': '2688x640',
  '21:10': '2016x960',
  '9:12': '960x1280',
};

export function resolveStickerProductRatioOpenAISize(
  value?: string,
): string | undefined {
  const ratio = resolveStickerProductRatio(value);
  return ratio ? STICKER_PRODUCT_RATIO_OPENAI_SIZES[ratio] : undefined;
}
