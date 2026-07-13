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

  it('keeps normalized small and large decimal ratios parseable and idempotent', () => {
    const hugeSide = `1${'0'.repeat(308)}`;
    const cases = [
      ['000.0000001000:0001.0000', '0.0000001:1'],
      [`000${hugeSide}.0000:000${hugeSide}.0000`, `${hugeSide}:${hugeSide}`],
    ] as const;

    for (const [input, expected] of cases) {
      const normalized = normalizeStickerAspectRatio(input);

      expect(normalized).toBe(expected);
      expect(normalizeStickerAspectRatio(normalized)).toBe(normalized);
    }
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

  it('keeps dimensions finite and aligned for very large finite ratio values', () => {
    const side = `1${'0'.repeat(308)}`;
    const spec = resolveStickerOutputSpec(`${side}:${side}`);

    expect(spec).toMatchObject({
      aspectRatio: `${side}:${side}`,
      width: 1024,
      height: 1024,
      size: '1024x1024',
    });
    expect(normalizeStickerAspectRatio(spec.aspectRatio)).toBe(spec.aspectRatio);
    expect(Number.isFinite(spec.width)).toBe(true);
    expect(Number.isFinite(spec.height)).toBe(true);
    expect(spec.width % 16).toBe(0);
    expect(spec.height % 16).toBe(0);
  });

  it.each([
    ['64:1', '1K', 1024, 16, '1024x16'],
    ['128:1', '2K', 2048, 16, '2048x16'],
  ] as const)(
    'accepts the exact 16-pixel short-edge boundary for %s at %s',
    (aspectRatio, outputQuality, width, height, size) => {
      expect(resolveStickerOutputSpec(aspectRatio, outputQuality)).toMatchObject({
        width,
        height,
        size,
      });
    },
  );

  it.each([
    ['64.0001:1', '1K'],
    ['128.0001:1', '2K'],
  ] as const)(
    'rejects ratios just beyond the 16-pixel short-edge boundary for %s at %s',
    (aspectRatio, outputQuality) => {
      expect(() => resolveStickerOutputSpec(aspectRatio, outputQuality)).toThrow(
        '产品比例过于极端，短边不能小于 16 像素',
      );
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
