import { describe, expect, it } from 'vitest';
import { buildStickerInstructionPrompt } from '../stickerInstructionPrompt';

const sectionNames = [
  '[NON-NEGOTIABLE OUTPUT CONTRACT]',
  '[MODE CONTRACT]',
  '[VARIATION STRATEGY]',
  '[STRUCTURED CONTENT — OVERRIDES THE REFERENCE]',
  '[LOW-PRIORITY USER NOTES]',
  '[FINAL CHECK]',
] as const;

describe('buildStickerInstructionPrompt', () => {
  it('emits an ordered, once-only output contract with normalized structured content', () => {
    const prompt = buildStickerInstructionPrompt({
      feature: 'sticker_original',
      brand: 'WKUA',
      productName: 'Glass Cleaner',
      sellingPoints: ['Streak-free'],
      capacity: '100ml',
      prompt: 'make it premium',
    });

    const positions = sectionNames
      .filter((section) => section !== '[VARIATION STRATEGY]')
      .map((section) => prompt.indexOf(section));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(prompt).not.toContain('[VARIATION STRATEGY]');
    expect(prompt).toContain('WKUA®');
    expect(prompt).toContain('NET: 100ML / 3.38 FL.OZ');
    expect(prompt).toContain('THE PURE-WHITE BRAND WORDMARK ITSELF MUST BE HORIZONTALLY CENTERED; put ® at that brand wordmark\'s upper-right.');

    for (const rule of [
      'EXACTLY ONE FRONT-FACING FLAT 2D RECTANGULAR LABEL',
      'LABEL ARTWORK ONLY',
      'BRAND MUST BE PURE WHITE',
      'ALL VISIBLE TEXT MUST BE NATURAL ENGLISH',
      'COMPLETE TITLE, BRAND, SELLING POINTS, SUBTITLE, NET LINE, AND DECORATIVE ELEMENTS',
      'ENGLISH-ADAPTIVE TYPOGRAPHY',
      'COMPLETE GROUP CENTERED WITH WIDE LEFT/RIGHT SAFETY MARGINS',
    ]) {
      expect(prompt.split(rule)).toHaveLength(2);
    }
  });

  it('keeps mode contracts separate and makes a color variation preserve layout', () => {
    const replica = buildStickerInstructionPrompt({ feature: 'sticker_replica' });
    const original = buildStickerInstructionPrompt({
      feature: 'sticker_original',
      images: [{ role: 'style', path: '/tmp/style.png' }],
    });
    const color = buildStickerInstructionPrompt({
      feature: 'sticker_variation',
      stickerVariationDirection: 'color',
    });

    expect(replica).toContain('DE-PERSPECTIVE AND UNWRAP THE SOURCE');
    expect(original).toContain('STYLE IMAGES ARE VISUAL-LANGUAGE REFERENCES ONLY');
    expect(original).toContain('DO NOT COPY THEIR WORDING OR LAYOUT');
    expect(color).toContain('PRESERVE: brand; layout; visible copy');
    expect(color).not.toContain('make a clearly different layout');
  });

  it('uses a supplied replica logo only for brand identification', () => {
    const withLogo = buildStickerInstructionPrompt({
      feature: 'sticker_replica',
      images: [
        { role: 'source', path: '/tmp/source.png' },
        { role: 'logo', path: '/tmp/logo.png' },
      ],
    });
    const withoutLogo = buildStickerInstructionPrompt({
      feature: 'sticker_replica',
      images: [{ role: 'source', path: '/tmp/source.png' }],
    });
    const logoRule = 'SUPPLIED LOGO IMAGE IS FOR BRAND IDENTIFICATION ONLY; do not use it as a layout, palette, style, or visual-design reference. The source label remains the relevant design source.';

    expect(withLogo).toContain(logoRule);
    expect(withoutLogo).not.toContain('SUPPLIED LOGO IMAGE IS FOR BRAND IDENTIFICATION ONLY');
  });

  it.each([
    'product', 'color', 'reverse', 'geometry', 'layout', 'background', 'fusion', 'key-element',
  ] as const)('renders the %s strategy in the variation section', (stickerVariationDirection) => {
    const prompt = buildStickerInstructionPrompt({ feature: 'sticker_variation', stickerVariationDirection });

    expect(prompt).toContain('[VARIATION STRATEGY]');
    expect(prompt).toContain(`STRATEGY: ${stickerVariationDirection}`);
  });
});
