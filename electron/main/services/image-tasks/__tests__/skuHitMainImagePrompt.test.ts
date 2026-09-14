import { describe, expect, it } from 'vitest';
import { buildSkuHitMainImagePrompt, isSkuHitMainImageFeature } from '../skuHitMainImagePrompt';
import { isSkuFeature } from '../skuExecutionPrompt';

const baseRequest = {
  feature: 'sku_hit_main_image' as const,
  images: [
    { role: 'source' as const, path: '/tmp/sku.png' },
    { role: 'reference' as const, path: '/tmp/hit-main.png' },
  ],
};

describe('skuHitMainImagePrompt', () => {
  it('is not classified as a bottle SKU feature', () => {
    expect(isSkuHitMainImageFeature('sku_hit_main_image')).toBe(true);
    expect(isSkuFeature('sku_hit_main_image')).toBe(false);
  });

  it('renders a compact overlay instruction instead of a bottle SKU prompt', () => {
    const prompt = buildSkuHitMainImagePrompt(baseRequest);
    expect(prompt).toContain('Composite Image 1 SKU as a floating graphic cutout');
    expect(prompt).toContain('do not stand it on any surface');
    expect(prompt).toContain('Understand Image 1 for the product effect');
    expect(prompt).toContain('do not complete the crop into objects Image 2 does not fully show');
    expect(prompt).toContain('do not copy Image 2 layout, holding hand, or camera');
    expect(prompt).toContain('five complete fingers');
    expect(prompt).toContain('Always show one simple Before/After of the same cropped surface');
    expect(prompt).toContain('Image 1 is the new SKU product photo only');
    expect(prompt).toContain('Keep the frame simple');
    expect(prompt).toContain('Give the headline Image 2’s type energy');
    expect(prompt).not.toContain('IMAGE ROLES:');
    expect(prompt).not.toContain('输出一张完整的 SKU 产品图');
    expect(prompt).toContain('All visible text must be English');
    expect(prompt).not.toMatch(/\p{Script=Han}/u);
    expect(prompt).not.toContain('secondary product display');

    const hidden = buildSkuHitMainImagePrompt({
      ...baseRequest,
      showProduct: false,
      brand: 'wkau',
    });
    expect(hidden).toContain('Remove every product bottle, brand logo, wordmark, and packaging');
    expect(hidden).toContain('Do not overlay or render Image 1 SKU, packaging, bottle, brand logo');
    expect(hidden).toContain('Do not render Image 1 brand, logo, product name, or capacity anywhere');
    expect(hidden).not.toContain('Brand: "wkau"');
    expect(hidden).not.toContain('Composite Image 1 SKU as a floating graphic cutout');
  });

  it('overrides SKU fields without replacing reference marketing copy', () => {
    const filled = buildSkuHitMainImagePrompt({
      ...baseRequest,
      brand: 'wkau',
      headline: 'Melt Ice Fast',
    });
    expect(filled).toContain('apply "wkau" only on the Image 1 cutout label');
    expect(filled).toContain('Never add a standalone brand logo');
    expect(filled).not.toContain('Brand: "wkau"');
    expect(filled).toContain('On-image headline: "Melt Ice Fast"');
    expect(filled).not.toContain('Product name:');
    expect(filled).toContain('All visible text must be English');
    expect(filled).not.toMatch(/\p{Script=Han}/u);

    const inherited = buildSkuHitMainImagePrompt(baseRequest);
    expect(inherited).toContain('translate Image 2 headlines');
    expect(inherited).not.toContain('On-image headline:');
  });

  it('bounds additional prompt and requires batch composition diversity', () => {
    const prompt = buildSkuHitMainImagePrompt({
      ...baseRequest,
      prompt: 'stronger contrast, larger product',
      variantIndex: 2,
      variantTotal: 3,
    });
    expect(prompt).toContain('stronger contrast, larger product');
    expect(prompt).toContain('batch output 2/3');
  });
});
