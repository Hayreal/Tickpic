import { describe, expect, it } from 'vitest';
import { buildProductImageSetRequests } from '../productImageSetRequests';

describe('buildProductImageSetRequests', () => {
  it('builds a single main-image request with count and optional handheld reference', () => {
    const requests = buildProductImageSetRequests({
      subTab: 'main',
      skuPaths: ['/tmp/front.png', '/tmp/back.png'],
      aspectRatio: '1:1',
      count: 2,
      prompt: '  bright premium composition  ',
      negativePrompt: '  no extra props  ',
      scenePrompt: '  kitchen counter  ',
      productHandheldMode: 'handheld',
      productEffectMode: 'show',
      handheldReferencePath: '/resources/product/handheld-pump-foam.png',
      comparisonLayout: 'auto',
      comparisonIntensity: 'medium',
      showProduct: true,
      multiSceneLayout: 'single',
    });

    expect(requests).toEqual([
      {
        feature: 'product_main_image',
        images: [
          { role: 'product', path: '/tmp/front.png' },
          { role: 'product', path: '/tmp/back.png' },
          { role: 'reference', path: '/resources/product/handheld-pump-foam.png' },
        ],
        count: 2,
        aspectRatio: '1:1',
        prompt: 'bright premium composition',
        negativePrompt: 'no extra props',
        scenePrompt: 'kitchen counter',
        productHandheldMode: 'handheld',
        productEffectMode: 'show',
      },
    ]);
  });

  it('omits handheld reference when handheld mode is not_handheld', () => {
    const [request] = buildProductImageSetRequests({
      subTab: 'main',
      skuPaths: ['/tmp/front.png'],
      aspectRatio: '1:1',
      count: 1,
      prompt: '',
      negativePrompt: '',
      scenePrompt: '',
      productHandheldMode: 'not_handheld',
      productEffectMode: 'auto',
      handheldReferencePath: '/resources/product/handheld-pump-foam.png',
      comparisonLayout: 'auto',
      comparisonIntensity: 'medium',
      showProduct: true,
      multiSceneLayout: 'single',
    });

    expect(request.images).toEqual([{ role: 'product', path: '/tmp/front.png' }]);
  });

  it('includes handheld reference in auto mode when a pose is selected', () => {
    const [request] = buildProductImageSetRequests({
      subTab: 'main',
      skuPaths: ['/tmp/front.png'],
      aspectRatio: '1:1',
      count: 1,
      prompt: '',
      negativePrompt: '',
      scenePrompt: '',
      productHandheldMode: 'auto',
      productEffectMode: 'auto',
      handheldReferencePath: '/resources/product/handheld-spray-side-press.png',
      comparisonLayout: 'auto',
      comparisonIntensity: 'medium',
      showProduct: true,
      multiSceneLayout: 'single',
    });

    expect(request.images).toEqual([
      { role: 'product', path: '/tmp/front.png' },
      { role: 'reference', path: '/resources/product/handheld-spray-side-press.png' },
    ]);
  });

  it('builds comparison requests with only its applicable fields', () => {
    const [request] = buildProductImageSetRequests({
      subTab: 'comparison',
      skuPaths: ['/tmp/product.png'],
      aspectRatio: '4:3',
      count: 1,
      prompt: '  clear result  ',
      negativePrompt: '  no claims  ',
      scenePrompt: '  bathroom mirror  ',
      productHandheldMode: 'not_handheld',
      productEffectMode: 'auto',
      comparisonLayout: 'vertical',
      comparisonIntensity: 'heavy',
      showProduct: false,
      multiSceneLayout: 'grid',
    });

    expect(request).toEqual(expect.objectContaining({
      feature: 'product_comparison_image',
      count: 1,
      prompt: 'clear result',
      negativePrompt: 'no claims',
      scenePrompt: 'bathroom mirror',
      comparisonLayout: 'vertical',
      comparisonIntensity: 'heavy',
      showProduct: false,
    }));
    expect(request).not.toHaveProperty('productHandheldMode');
    expect(request).not.toHaveProperty('productEffectMode');
    expect(request).not.toHaveProperty('multiSceneLayout');
  });

  it('builds multi-scene requests with an optional trimmed prompt and its layout', () => {
    const [request] = buildProductImageSetRequests({
      subTab: 'multiScene',
      skuPaths: ['/tmp/product.png'],
      aspectRatio: '3:2',
      count: 3,
      prompt: '  a kitchen counter in morning light  ',
      negativePrompt: '  marketing text  ',
      scenePrompt: '  ignored  ',
      productHandheldMode: 'handheld',
      productEffectMode: 'show',
      comparisonLayout: 'horizontal',
      comparisonIntensity: 'light',
      showProduct: true,
      multiSceneLayout: 'collage',
    });

    expect(request).toMatchObject({
      feature: 'product_multi_scene',
      count: 3,
      prompt: 'a kitchen counter in morning light',
      negativePrompt: 'marketing text',
      multiSceneLayout: 'collage',
    });
    expect(request).not.toHaveProperty('scenePrompt');
    expect(request).not.toHaveProperty('productHandheldMode');
    expect(request).not.toHaveProperty('comparisonLayout');
    expect(request).not.toHaveProperty('showProduct');
  });

  it('rejects requests without SKU product images', () => {
    expect(() => buildProductImageSetRequests({
      subTab: 'main',
      skuPaths: [],
      aspectRatio: 'auto',
      count: 1,
      prompt: '',
      negativePrompt: '',
      scenePrompt: '',
      productHandheldMode: 'not_handheld',
      productEffectMode: 'auto',
      comparisonLayout: 'auto',
      comparisonIntensity: 'medium',
      showProduct: true,
      multiSceneLayout: 'single',
    })).toThrow('请上传 SKU 产品图');
  });

  it('allows a multi-scene request with an empty prompt', () => {
    expect(buildProductImageSetRequests({
      subTab: 'multiScene',
      skuPaths: ['/tmp/product.png'],
      aspectRatio: 'auto',
      count: 1,
      prompt: '   ',
      negativePrompt: '   ',
      scenePrompt: '   ',
      productHandheldMode: 'not_handheld',
      productEffectMode: 'auto',
      comparisonLayout: 'auto',
      comparisonIntensity: 'medium',
      showProduct: true,
      multiSceneLayout: 'single',
    })[0]).toEqual(expect.not.objectContaining({ prompt: expect.anything(), negativePrompt: expect.anything() }));
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid generation count of %s',
    (count) => {
      expect(() => buildProductImageSetRequests({
        subTab: 'main',
        skuPaths: ['/tmp/product.png'],
        aspectRatio: 'auto',
        count,
        prompt: '',
        negativePrompt: '',
        scenePrompt: '',
        productHandheldMode: 'not_handheld',
        productEffectMode: 'auto',
        comparisonLayout: 'auto',
        comparisonIntensity: 'medium',
        showProduct: true,
        multiSceneLayout: 'single',
      })).toThrow('生成数量必须是正整数');
    },
  );
});
