import { describe, expect, it } from 'vitest';
import { normalizeStickerCapacity } from '../stickerCapacity';

describe('sticker capacity', () => {
  it.each(['', '   ', '\t\n'])('returns undefined for blank input %j', (input) => {
    expect(normalizeStickerCapacity(input)).toBeUndefined();
  });

  it('normalizes milliliters and adds the converted US fluid-ounce value', () => {
    expect(normalizeStickerCapacity('100 ml')).toEqual({
      labelText: 'NET: 100ML / 3.38 FL.OZ',
    });
  });

  it('normalizes grams and adds the converted ounce value', () => {
    expect(normalizeStickerCapacity('100g')).toEqual({
      labelText: 'NET: 100G / 3.53 OZ',
    });
  });

  it.each(['6 pieces', '6 piece', '6 pcs', '6 pc'])(
    'normalizes the piece-count alias in %j',
    (input) => {
      expect(normalizeStickerCapacity(input)).toEqual({
        labelText: 'NET: 6 PIECES',
      });
    },
  );

  it('removes an optional NET prefix and normalizes case and whitespace', () => {
    expect(normalizeStickerCapacity('  nEt:   100   mL  ')).toEqual({
      labelText: 'NET: 100ML / 3.38 FL.OZ',
    });
    expect(normalizeStickerCapacity('NET:   6   PcS')).toEqual({
      labelText: 'NET: 6 PIECES',
    });
  });

  it('preserves explicit metric and imperial values instead of recalculating them', () => {
    expect(normalizeStickerCapacity('100 ml / 3.4 fl.oz')).toEqual({
      labelText: 'NET: 100ML / 3.4 FL.OZ',
    });
    expect(normalizeStickerCapacity('NET: 100 g / 3.5 oz')).toEqual({
      labelText: 'NET: 100G / 3.5 OZ',
    });
  });

  it('normalizes spacing, case, and insignificant zeros in explicit dual units', () => {
    expect(normalizeStickerCapacity(' net:  100.00 G/  3.40 oZ ')).toEqual({
      labelText: 'NET: 100G / 3.4 OZ',
    });
    expect(normalizeStickerCapacity('100.00 ML / 3.400 FL.OZ')).toEqual({
      labelText: 'NET: 100ML / 3.4 FL.OZ',
    });
  });

  it('strips insignificant zeros from metric input and rounds conversions to two decimals', () => {
    expect(normalizeStickerCapacity('100.00 ml')).toEqual({
      labelText: 'NET: 100ML / 3.38 FL.OZ',
    });
    expect(normalizeStickerCapacity('100.00 g')).toEqual({
      labelText: 'NET: 100G / 3.53 OZ',
    });
  });

  it('removes insignificant converted decimals at exact conversion boundaries', () => {
    expect(normalizeStickerCapacity('29.5735ML')).toEqual({
      labelText: 'NET: 29.5735ML / 1 FL.OZ',
    });
    expect(normalizeStickerCapacity('28.3495g')).toEqual({
      labelText: 'NET: 28.3495G / 1 OZ',
    });
  });

  it('rounds exact half-cent conversion boundaries up without floating-point drift', () => {
    expect(normalizeStickerCapacity('64.3223625ml')).toEqual({
      labelText: 'NET: 64.3223625ML / 2.18 FL.OZ',
    });
    expect(normalizeStickerCapacity('61.6601625g')).toEqual({
      labelText: 'NET: 61.6601625G / 2.18 OZ',
    });
  });

  it('accepts a whitespace-delimited NET prefix without a colon', () => {
    expect(normalizeStickerCapacity('NET 120ML')).toEqual({
      labelText: 'NET: 120ML / 4.06 FL.OZ',
    });
    expect(normalizeStickerCapacity('  net   120 g  ')).toEqual({
      labelText: 'NET: 120G / 4.23 OZ',
    });
  });

  it('does not mistake words beginning with NET for a capacity prefix', () => {
    expect(normalizeStickerCapacity('NETWORK 120ML')).toEqual({
      labelText: 'NET: NETWORK 120ML',
      warning: '无法自动换算为 ML/FL.OZ 或 G/OZ，请确认标签规格文案',
    });
  });

  it('declines automatic conversion beyond the ordinary label precision limit', () => {
    expect(normalizeStickerCapacity('1234567890123456 ml')).toEqual({
      labelText: 'NET: 1234567890123456 ML',
      warning: '无法自动换算为 ML/FL.OZ 或 G/OZ，请确认标签规格文案',
    });
  });

  it('keeps extremely long metric input usable without Infinity or scientific notation', () => {
    const digits = '9'.repeat(1_000);

    expect(() => normalizeStickerCapacity(`${digits}ml`)).not.toThrow();
    expect(normalizeStickerCapacity(`${digits}ml`)).toEqual({
      labelText: `NET: ${digits}ML`,
      warning: '无法自动换算为 ML/FL.OZ 或 G/OZ，请确认标签规格文案',
    });
  });

  it('does not apply the single-unit precision limit to explicit dual-unit copy', () => {
    expect(normalizeStickerCapacity('12345678901234567890 ml / 1 fl.oz')).toEqual({
      labelText: 'NET: 12345678901234567890ML / 1 FL.OZ',
    });
  });

  it('never formats a zero conversion as negative zero', () => {
    expect(normalizeStickerCapacity('0 ml')).toEqual({
      labelText: 'NET: 0ML / 0 FL.OZ',
    });
  });

  it.each([
    ['1e2 ml', 'NET: 1E2 ML'],
    ['-10 g', 'NET: -10 G'],
  ])('treats unsupported numeric syntax in %j as warning copy', (input, labelText) => {
    expect(normalizeStickerCapacity(input)).toEqual({
      labelText,
      warning: '无法自动换算为 ML/FL.OZ 或 G/OZ，请确认标签规格文案',
    });
  });

  it('keeps supported decimal piece counts stable', () => {
    expect(normalizeStickerCapacity('1.50 pcs')).toEqual({
      labelText: 'NET: 1.5 PIECES',
    });
  });

  it('keeps unknown copy usable and returns a non-blocking warning', () => {
    expect(() => normalizeStickerCapacity('family pack')).not.toThrow();
    expect(normalizeStickerCapacity('  NET:  family   pack  ')).toEqual({
      labelText: 'NET: FAMILY PACK',
      warning: '无法自动换算为 ML/FL.OZ 或 G/OZ，请确认标签规格文案',
    });
  });
});
