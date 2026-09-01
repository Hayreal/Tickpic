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

  it('labels reference as image 1 and source as image 2 regardless of array order', () => {
    const prompt = buildSkuHitMainImagePrompt(baseRequest);
    expect(prompt).toContain('Image 1 = reference = viral main-image reference');
    expect(prompt).toContain('Image 2 = source = new SKU product image');
    expect(prompt).not.toContain('输出一张完整的 SKU 产品图');
    expect(prompt).not.toMatch(/\p{Script=Han}/u);
    expect(prompt).toContain('Change at least 3 dimensions');
    expect(prompt).toContain('Never stretch, compress, slim, widen, or redesign Image 2');
    expect(prompt).toContain('Packaging lock applies only to the SKU itself');
    expect(prompt).toContain('scene prop styling');
    expect(prompt).toContain('comparison-region shape');
    expect(prompt).toContain('background structure');
    expect(prompt).toContain('product-to-scene relationship');
    expect(prompt).toContain('must not reuse the exact same objects, angle, and composition');
    expect(prompt).toContain('preserve that marketing logic but redesign the presentation');
    expect(prompt).toContain('realistic scale, not an oversized hero jar');
    expect(prompt).toContain('PHYSICS REALISM:');
    expect(prompt).toContain('exactly one Image 2 SKU instance');
    expect(prompt).toContain('rewrite category-conflicting copy');
    expect(prompt).toContain('Return only the final image, not analysis');

    const swapped = buildSkuHitMainImagePrompt({
      ...baseRequest,
      images: [
        { role: 'reference', path: '/tmp/hit-main.png' },
        { role: 'source', path: '/tmp/sku.png' },
      ],
    });
    expect(swapped).toContain('Image 1 = reference = viral main-image reference');
    expect(swapped).toContain('Image 2 = source = new SKU product image');
  });

  it('overrides filled brand/product/capacity including titles, and derives blank fields from image 2 label', () => {
    const filled = buildSkuHitMainImagePrompt({
      ...baseRequest,
      brand: 'wkau',
      productName: 'WHITE RADIATOR REPAIR',
      capacity: '100ml',
    });
    expect(filled).toContain('Brand: "wkau"');
    expect(filled).toContain('Product name: "WHITE RADIATOR REPAIR"');
    expect(filled).toContain('Capacity: "NET: 100ml"');
    expect(filled).toContain('Every visible capacity must start with the exact prefix "NET:"');
    expect(filled).toContain('including words that appear in headline blocks');

    const inherited = buildSkuHitMainImagePrompt(baseRequest);
    expect(inherited).toContain('derive headline and category wording from Image 2 visible label copy');
    expect(inherited).not.toContain('inherit from Image 1');
  });

  it('bounds additional prompt and requires batch composition diversity', () => {
    const prompt = buildSkuHitMainImagePrompt({
      ...baseRequest,
      prompt: 'stronger contrast, larger product',
      variantIndex: 2,
      variantTotal: 3,
    });
    expect(prompt).toContain('stronger contrast, larger product');
    expect(prompt).toContain('must not break Image 2 packaging lock');
    expect(prompt).toContain('Every output in the same batch must use a visibly different composition');
  });
});
