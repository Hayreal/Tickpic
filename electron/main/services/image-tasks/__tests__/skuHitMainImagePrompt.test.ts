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
    expect(prompt).toContain('图 1 = reference = 爆款主图参考');
    expect(prompt).toContain('图 2 = source = 新 SKU 产品图');
    expect(prompt).not.toContain('输出一张完整的 SKU 产品图');
    expect(prompt).toContain('至少同时改变 3 个以上维度');
    expect(prompt).toContain('禁止拉长、压扁、变细、变宽或重设计图 2');
    expect(prompt).toContain('罐型/软管');
    expect(prompt).toContain('包材锁只作用于 SKU 本体');
    expect(prompt).toContain('场景物体款式');
    expect(prompt).toContain('对比区域形状');
    expect(prompt).toContain('背景空间结构');
    expect(prompt).toContain('产品与场景的视觉关系');
    expect(prompt).toContain('新场景不得与图 1 使用完全相同的物体、角度和构图');
    expect(prompt).toContain('必须保留该营销逻辑但重做形式');
    expect(prompt).toContain('产品必须有足够曝光，不得过小');
    expect(prompt).toContain('禁止改写核心标题、假英文、无意义小图标');
    expect(prompt).toContain('只输出最终图片，不输出分析过程');

    const swapped = buildSkuHitMainImagePrompt({
      ...baseRequest,
      images: [
        { role: 'reference', path: '/tmp/hit-main.png' },
        { role: 'source', path: '/tmp/sku.png' },
      ],
    });
    expect(swapped).toContain('图 1 = reference = 爆款主图参考');
    expect(swapped).toContain('图 2 = source = 新 SKU 产品图');
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
