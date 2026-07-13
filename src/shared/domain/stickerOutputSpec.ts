export const STICKER_OUTPUT_QUALITIES = ['1K', '2K'] as const;

export type StickerOutputQuality = typeof STICKER_OUTPUT_QUALITIES[number];

export const DEFAULT_STICKER_OUTPUT_QUALITY: StickerOutputQuality = '1K';

export interface ResolvedStickerOutputSpec {
  aspectRatio: string;
  outputQuality: StickerOutputQuality;
  width: number;
  height: number;
  size: `${number}x${number}`;
}

const STICKER_OUTPUT_LONG_EDGES: Record<StickerOutputQuality, number> = {
  '1K': 1024,
  '2K': 2048,
};

const ASPECT_RATIO_PATTERN = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+|Infinity|NaN))\s*:\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+|Infinity|NaN))$/;

export function isStickerOutputQuality(value: unknown): value is StickerOutputQuality {
  return STICKER_OUTPUT_QUALITIES.includes(value as StickerOutputQuality);
}

export function normalizeStickerAspectRatio(value: string): string {
  const match = value.trim().match(ASPECT_RATIO_PATTERN);
  if (!match) {
    throw new Error('产品比例格式应为“宽:高”');
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('产品比例必须大于 0');
  }

  return `${width}:${height}`;
}

export function resolveStickerOutputSpec(
  input: string,
  outputQuality: StickerOutputQuality = DEFAULT_STICKER_OUTPUT_QUALITY,
): ResolvedStickerOutputSpec {
  if (!isStickerOutputQuality(outputQuality)) {
    throw new Error('清晰度必须是 1K 或 2K');
  }

  const aspectRatio = normalizeStickerAspectRatio(input);
  const [ratioWidth, ratioHeight] = aspectRatio.split(':').map(Number);
  const longEdge = STICKER_OUTPUT_LONG_EDGES[outputQuality];
  const isLandscape = ratioWidth >= ratioHeight;
  const shortToLongRatio = Math.min(ratioWidth, ratioHeight) / Math.max(ratioWidth, ratioHeight);
  const rawShortEdge = longEdge * shortToLongRatio;
  const shortEdge = Math.round(rawShortEdge / 16) * 16;

  if (rawShortEdge < 16 || shortEdge < 16) {
    throw new Error('产品比例过于极端，短边不能小于 16 像素');
  }

  const width = isLandscape ? longEdge : shortEdge;
  const height = isLandscape ? shortEdge : longEdge;

  return {
    aspectRatio,
    outputQuality,
    width,
    height,
    size: `${width}x${height}`,
  };
}
