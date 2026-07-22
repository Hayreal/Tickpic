import { describe, expect, it } from 'vitest';
import { STICKER_VARIATION_DIRECTIONS } from '../stickerPrompts';

describe('STICKER_VARIATION_DIRECTIONS', () => {
  it('defines one bounded prompt for every variation direction', () => {
    expect(STICKER_VARIATION_DIRECTIONS.map(({ value }) => value)).toEqual([
      'product',
      'color',
      'reverse',
      'geometry',
      'layout',
      'background',
      'fusion',
      'key-element',
    ]);

    for (const direction of STICKER_VARIATION_DIRECTIONS) {
      expect(direction.prompt).toContain('允许变化');
      expect(direction.prompt).toContain('必须保持');
      expect(direction.prompt).not.toContain('爆品');
    }
  });

  it('limits color variation to palette changes', () => {
    const color = STICKER_VARIATION_DIRECTIONS.find(({ value }) => value === 'color');

    expect(color?.prompt).toContain('只调整主色、辅助色和色彩比例');
    expect(color?.prompt).toContain('版式、元素位置、字体层级、文案语义和装饰几何');
  });

  it('keeps background variation inside the label', () => {
    const background = STICKER_VARIATION_DIRECTIONS.find(({ value }) => value === 'background');

    expect(background?.prompt).toContain('仅调整标签内部背景');
    expect(background?.prompt).not.toContain('场景背景');
  });

  it('prevents fusion from copying brands or literal copy', () => {
    const fusion = STICKER_VARIATION_DIRECTIONS.find(({ value }) => value === 'fusion');

    expect(fusion?.prompt).toContain('不得复制其他品牌、产品或无关字面文字');
  });
});
