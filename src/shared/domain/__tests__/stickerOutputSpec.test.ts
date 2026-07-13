import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STICKER_OUTPUT_QUALITY,
  isStickerOutputQuality,
  normalizeStickerAspectRatio,
  resolveStickerOutputSpec,
  STICKER_OUTPUT_QUALITIES,
} from '../stickerOutputSpec';

describe('sticker output spec', () => {
  it('defines the supported output qualities and default', () => {
    expect(STICKER_OUTPUT_QUALITIES).toEqual(['1K', '2K']);
    expect(DEFAULT_STICKER_OUTPUT_QUALITY).toBe('1K');
    expect(isStickerOutputQuality('1K')).toBe(true);
    expect(isStickerOutputQuality('2K')).toBe(true);
    expect(isStickerOutputQuality('4K')).toBe(false);
  });

  it('normalizes whitespace and decimal values in product ratios', () => {
    expect(normalizeStickerAspectRatio(' 2.5 : 1 ')).toBe('2.5:1');
    expect(normalizeStickerAspectRatio('03.00:02.50')).toBe('3:2.5');
  });

  it('rejects malformed product ratios', () => {
    expect(() => normalizeStickerAspectRatio('wide')).toThrow('产品比例格式应为“宽:高”');
  });

  it.each(['1:0', '-1:1', 'Infinity:1', 'NaN:1'])(
    'rejects non-positive or non-finite ratio sides in %s',
    (aspectRatio) => {
      expect(() => normalizeStickerAspectRatio(aspectRatio)).toThrow('产品比例必须大于 0');
    },
  );

  it.each([
    ['1:1', '1K', 1024, 1024, '1024x1024'],
    ['3:2', '1K', 1024, 688, '1024x688'],
    ['9:12', '1K', 768, 1024, '768x1024'],
    ['21:5', '1K', 1024, 240, '1024x240'],
    ['3:2', '2K', 2048, 1360, '2048x1360'],
  ] as const)(
    'resolves %s at %s to a 16-pixel-aligned size',
    (aspectRatio, outputQuality, width, height, size) => {
      expect(resolveStickerOutputSpec(aspectRatio, outputQuality)).toEqual({
        aspectRatio,
        outputQuality,
        width,
        height,
        size,
      });
    },
  );

  it('rejects ratios whose raw short edge is below 16 pixels', () => {
    expect(() => resolveStickerOutputSpec('100:1')).toThrow(
      '产品比例过于极端，短边不能小于 16 像素',
    );
  });

  it('rejects unsupported output qualities', () => {
    expect(() => resolveStickerOutputSpec('1:1', '4K' as never)).toThrow(
      '清晰度必须是 1K 或 2K',
    );
  });
});
