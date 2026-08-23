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
    expect(prompt).toContain('图 1');
    expect(prompt).toContain('爆款主图参考');
    expect(prompt).toContain('图 2');
    expect(prompt).toContain('新 SKU');
    expect(prompt).not.toContain('输出一张完整的 SKU 产品图');
    expect(prompt).toContain('至少同时改变 3 个以上维度');
    expect(prompt).toContain('禁止拉长、压扁、变细、变宽或重设计图 2');
  });

  it('overrides filled brand/product/capacity including titles, and inherits blank fields from image 1', () => {
    const filled = buildSkuHitMainImagePrompt({
      ...baseRequest,
      brand: 'wkau',
      productName: 'WHITE RADIATOR REPAIR',
      capacity: '100ml',
    });
    expect(filled).toContain('品牌: "wkau"');
    expect(filled).toContain('产品名称: "WHITE RADIATOR REPAIR"');
    expect(filled).toContain('容量: "100ml"');
    expect(filled).toContain('包括标题区里出现的对应词');

    const inherited = buildSkuHitMainImagePrompt(baseRequest);
    expect(inherited).toContain('未填写的品牌、产品名、容量从图 1 继承');
    expect(inherited).not.toContain('品牌: "');
  });

  it('bounds additional prompt and requires batch composition diversity', () => {
    const prompt = buildSkuHitMainImagePrompt({
      ...baseRequest,
      prompt: '对比更强，产品再大一点',
      variantIndex: 2,
      variantTotal: 3,
    });
    expect(prompt).toContain('对比更强，产品再大一点');
    expect(prompt).toContain('不得推翻图 2 包材锁');
    expect(prompt).toContain('同批多张之间构图必须互异');
  });
});
