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

  it('never formats a zero conversion as negative zero', () => {
    expect(normalizeStickerCapacity('0 ml')).toEqual({
      labelText: 'NET: 0ML / 0 FL.OZ',
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
