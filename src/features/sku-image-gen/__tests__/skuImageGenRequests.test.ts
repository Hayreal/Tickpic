import { describe, expect, it } from 'vitest';
import { buildSkuImageGenRequests } from '../skuImageGenRequests';

describe('buildSkuImageGenRequests', () => {
  it('builds replica requests with source and reference images', () => {
    const requests = buildSkuImageGenRequests({
      subTab: 'replica',
      skuPath: '/tmp/sku.png',
      referencePaths: ['/tmp/ref-a.png', '/tmp/ref-b.png'],
      aspectRatio: 'auto',
      count: 1,
      brand: 'wkau',
      productName: '',
      capacity: '45ml',
      prompt: '',
      negativePrompt: '',
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      feature: 'sku_replica',
      count: 1,
      brand: 'wkau',
      capacity: '45ml',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/ref-a.png' },
        { role: 'reference', path: '/tmp/ref-b.png' },
      ],
    });
  });

  it('builds six variation requests with variant metadata', () => {
    const requests = buildSkuImageGenRequests({
      subTab: 'variation',
      skuPath: '/tmp/sku.png',
      referencePaths: [],
      aspectRatio: 'auto',
      count: 6,
      brand: '',
      productName: '',
      capacity: '',
      prompt: '差异化再大一点',
      negativePrompt: '',
    });

    expect(requests).toHaveLength(6);
    expect(requests[0].variantIndex).toBe(1);
    expect(requests[5].variantTotal).toBe(6);
    expect(requests.every((request) => request.feature === 'sku_variation')).toBe(true);
  });

  it('requires product name for original tab', () => {
    expect(() => buildSkuImageGenRequests({
      subTab: 'original',
      skuPath: '/tmp/sku.png',
      referencePaths: [],
      aspectRatio: 'auto',
      count: 6,
      brand: 'wkau',
      productName: '',
      capacity: '45ml',
      prompt: '自由发挥',
      negativePrompt: '',
    })).toThrow('请输入产品名称');
  });

  it('requires reference images for replica tab', () => {
    expect(() => buildSkuImageGenRequests({
      subTab: 'replica',
      skuPath: '/tmp/sku.png',
      referencePaths: [],
      aspectRatio: 'auto',
      count: 1,
      brand: '',
      productName: '',
      capacity: '',
      prompt: '',
      negativePrompt: '',
    })).toThrow('请上传参考图');
  });

  it('builds hit-main requests with source then a single reference', () => {
    const requests = buildSkuImageGenRequests({
      subTab: 'hitMain',
      skuPath: '/tmp/sku.png',
      referencePaths: ['/tmp/hit-main.png'],
      aspectRatio: '1:1',
      count: 3,
      brand: 'wkau',
      productName: 'Radiator Repair',
      capacity: '100ml',
      prompt: '对比更强',
      negativePrompt: 'no fake english',
    });

    expect(requests).toHaveLength(3);
    expect(requests[0]).toMatchObject({
      feature: 'sku_hit_main_image',
      count: 1,
      aspectRatio: '1:1',
      brand: 'wkau',
      productName: 'Radiator Repair',
      capacity: '100ml',
      prompt: '对比更强',
      negativePrompt: 'no fake english',
      variantIndex: 1,
      variantTotal: 3,
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/hit-main.png' },
      ],
    });
    expect(requests[2].variantIndex).toBe(3);
  });

  it('requires exactly one hit-main reference image', () => {
    const base = {
      subTab: 'hitMain' as const,
      skuPath: '/tmp/sku.png',
      aspectRatio: '1:1' as const,
      count: 1,
      brand: '',
      productName: '',
      capacity: '',
      prompt: '',
      negativePrompt: '',
    };

    expect(() => buildSkuImageGenRequests({ ...base, referencePaths: [] }))
      .toThrow('请上传爆款主图参考');
    expect(() => buildSkuImageGenRequests({
      ...base,
      referencePaths: ['/tmp/a.png', '/tmp/b.png'],
    })).toThrow('爆款主图参考只能上传 1 张');
  });
});
