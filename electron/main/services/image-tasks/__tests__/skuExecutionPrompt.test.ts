import { describe, expect, it } from 'vitest';
import { buildSkuExecutionPrompt } from '../skuExecutionPrompt';

describe('skuExecutionPrompt', () => {
  it('builds replica prompt that references layout and style from all reference images', () => {
    const prompt = buildSkuExecutionPrompt({
      feature: 'sku_replica',
      brand: 'wkau',
      capacity: '45ml',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/ref-a.png' },
        { role: 'reference', path: '/tmp/ref-b.png' },
      ],
    });

    expect(prompt).toContain('模式: SKU 复刻。');
    expect(prompt).toContain('版式结构、信息层级、色系与装饰风格');
    expect(prompt).toContain('图片 2');
    expect(prompt).toContain('图片 3');
    expect(prompt).toContain('输出一张完整的 SKU 产品图');
    expect(prompt).toContain('容量/规格: "NET: 45ml"');
  });

  it('locks package unless user asks to change packaging form', () => {
    const locked = buildSkuExecutionPrompt({
      feature: 'sku_variation',
      images: [{ role: 'source', path: '/tmp/sku.png' }],
    });
    const unlocked = buildSkuExecutionPrompt({
      feature: 'sku_variation',
      prompt: '做成软管',
      images: [{ role: 'source', path: '/tmp/sku.png' }],
    });

    expect(locked).toContain('必须锁定 SKU 源图的瓶型');
    expect(locked).toContain('SKU 源图贴纸仅提取品牌、产品名称、容量三项信息');
    expect(unlocked).toContain('明确请求改变包材形态');
  });

  it('requires visible differentiation for multi-image batches', () => {
    const prompt = buildSkuExecutionPrompt({
      feature: 'sku_original',
      productName: '墙面修补膏',
      variantIndex: 2,
      variantTotal: 6,
      images: [{ role: 'source', path: '/tmp/sku.png' }],
    });

    expect(prompt).toContain('模式: SKU 原创。');
    expect(prompt).toContain('保持 SKU 源图完整构图');
    expect(prompt).toContain('产品名称来源: "墙面修补膏"');
    expect(prompt).toContain('与同批其他输出相比');
  });
});
