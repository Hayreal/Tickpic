import { describe, expect, it } from 'vitest';
import { buildProductImageSetRequests } from '../productImageSetRequests';

const baseMainInput = {
  subTab: 'main' as const,
  skuPaths: ['/tmp/front.png'],
  aspectRatio: '1:1' as const,
  prompt: '',
  negativePrompt: '',
  scenePrompt: '',
  productHandheldMode: 'not_handheld' as const,
  productEffectMode: 'auto' as const,
  handheldReferencePath: null,
  comparisonLayout: 'auto' as const,
  comparisonIntensity: 'medium' as const,
  showProduct: true,
  showProductByIndex: [true],
  mainImageExtraContentByIndex: [{ preset: 'auto' as const, toggles: [] }],
  multiSceneLayout: 'single' as const,
};

describe('buildProductImageSetRequests', () => {
  it('builds a single main-image request without handheld or spray controls', () => {
    const requests = buildProductImageSetRequests({
      ...baseMainInput,
      skuPaths: ['/tmp/front.png', '/tmp/back.png'],
      count: 2,
      prompt: '  bright premium composition  ',
      negativePrompt: '  no extra props  ',
      scenePrompt: '  kitchen counter  ',
      showProductByIndex: [true, false],
      mainImageExtraContentByIndex: [
        { preset: 'auto', toggles: [] },
        { preset: 'custom', toggles: ['selling_points'] },
      ],
    });

    expect(requests).toEqual([
      {
        feature: 'product_main_image',
        images: [
          { role: 'product', path: '/tmp/front.png' },
          { role: 'product', path: '/tmp/back.png' },
        ],
        count: 2,
        aspectRatio: '1:1',
        prompt: 'bright premium composition',
        negativePrompt: 'no extra props',
        scenePrompt: 'kitchen counter',
        showProductByIndex: [true, false],
        mainImageExtraContentByIndex: [
          { preset: 'auto', toggles: [] },
          { preset: 'custom', toggles: ['selling_points'] },
        ],
      },
    ]);
  });

  it('passes per-image showProductByIndex on main-image requests', () => {
    const [request] = buildProductImageSetRequests({
      ...baseMainInput,
      count: 3,
      showProductByIndex: [true, false, true],
      mainImageExtraContentByIndex: [
        { preset: 'none', toggles: [] },
        { preset: 'custom', toggles: ['mini_comparison'] },
        { preset: 'auto', toggles: [] },
      ],
    });

    expect(request.showProductByIndex).toEqual([true, false, true]);
    expect(request.mainImageExtraContentByIndex).toEqual([
      { preset: 'none', toggles: [] },
      { preset: 'custom', toggles: ['mini_comparison'] },
      { preset: 'auto', toggles: [] },
    ]);
    expect(request).not.toHaveProperty('showProduct');
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
      showProductByIndex: [],
      mainImageExtraContentByIndex: [],
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
      showProductByIndex: [true, true, true],
      mainImageExtraContentByIndex: [],
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
      ...baseMainInput,
      skuPaths: [],
      count: 1,
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
      showProductByIndex: [true],
      mainImageExtraContentByIndex: [{ preset: 'auto', toggles: [] }],
      multiSceneLayout: 'single',
    })[0]).toEqual(expect.not.objectContaining({ prompt: expect.anything(), negativePrompt: expect.anything() }));
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid generation count of %s',
    (count) => {
      expect(() => buildProductImageSetRequests({
        ...baseMainInput,
        count,
      })).toThrow('生成数量必须是正整数');
    },
  );
});
