import { describe, expect, it } from 'vitest';
import {
  STICKER_VARIATION_DIRECTIONS,
  STICKER_VARIATION_STRATEGIES,
  resolveStickerVariationStrategy,
} from '../stickerPrompts';

describe('sticker variation strategies', () => {
  it.each([
    ['product', 'low'],
    ['color', 'high'],
    ['reverse', 'low'],
    ['geometry', 'low'],
    ['layout', 'low'],
    ['background', 'high'],
    ['fusion', 'low'],
    ['key-element', 'high'],
  ] as const)('defines an auditable %s contract with %s input fidelity', (value, inputFidelity) => {
    const strategy = STICKER_VARIATION_STRATEGIES.find((item) => item.value === value);

    expect(strategy).toMatchObject({ value, inputFidelity });
    expect(strategy?.change.length).toBeGreaterThan(0);
    expect(strategy?.preserve).toContain('brand');
    expect(strategy?.forbid.length).toBeGreaterThan(0);
  });

  it('keeps layout and visible copy for color while layout strategy changes layout', () => {
    const color = STICKER_VARIATION_STRATEGIES.find((item) => item.value === 'color')!;
    const layout = STICKER_VARIATION_STRATEGIES.find((item) => item.value === 'layout')!;

    expect(color.preserve).toEqual(expect.arrayContaining(['layout', 'visible copy']));
    expect(color.forbid).toContain('rebuilding layout');
    expect(layout.change).toEqual(expect.arrayContaining(['layout', 'title positions']));
  });

  it('exports full auditable contracts through the public directions collection', () => {
    for (const direction of STICKER_VARIATION_DIRECTIONS) {
      expect(direction.change.length).toBeGreaterThan(0);
      expect(direction.preserve).toContain('brand');
      expect(direction.forbid.length).toBeGreaterThan(0);
      expect(['low', 'high']).toContain(direction.inputFidelity);
    }
  });

  it('resolves an explicit direction first, then applies deterministic fallback order', () => {
    expect(resolveStickerVariationStrategy({ direction: 'layout', colorScheme: 'blue' }).value).toBe('layout');
    expect(resolveStickerVariationStrategy({ productName: 'Foam Cleaner' }).value).toBe('product');
    expect(resolveStickerVariationStrategy({ sellingPoints: ['  deep clean  '] }).value).toBe('product');
    expect(resolveStickerVariationStrategy({ colorScheme: 'blue and silver' }).value).toBe('color');
    expect(resolveStickerVariationStrategy({ colorBlockLayout: 'split diagonal' }).value).toBe('layout');
    expect(resolveStickerVariationStrategy({}).value).toBe('fusion');
  });
});
