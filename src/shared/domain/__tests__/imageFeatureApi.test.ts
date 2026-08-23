import { describe, expect, it } from 'vitest';
import {
  getImageFeatureDefinition,
  getExecutionImageRoles,
  validateImageTaskRequest,
} from '../imageFeatureApi';

describe('image feature API contract', () => {
  it('routes prompt-only main asset as generation without second-stage image inputs', () => {
    const definition = getImageFeatureDefinition('prompt_only_main_asset');

    expect(definition.executionModel).toBe('generation');
    expect(getExecutionImageRoles({
      feature: 'prompt_only_main_asset',
      prompt: 'Create a pink laundry cleaning sheet ad asset',
      images: [
        { role: 'reference', path: '/authorized/input/style.png' },
        { role: 'style', path: '/authorized/input/light.png' },
      ],
    })).toEqual([]);
  });

  it('accepts replace logo only when source and logo images are present', () => {
    const request = validateImageTaskRequest({
      feature: 'replace_logo',
      images: [
        { role: 'source', path: '/authorized/input/original.png' },
        { role: 'logo', path: '/authorized/input/logo.png' },
      ],
      regions: [
        {
          id: 'logo',
          imageRole: 'source',
          x: 10,
          y: 20,
          width: 100,
          height: 50,
        },
      ],
    });

    expect(request.feature).toBe('replace_logo');
  });

  it('rejects image roles outside the feature contract', () => {
    expect(() => validateImageTaskRequest({
      feature: 'replace_logo',
      images: [
        { role: 'source', path: '/authorized/input/original.png' },
        { role: 'product', path: '/authorized/input/product.png' },
      ],
    })).toThrow('replace_logo does not accept image role product');
  });

  it('rejects invalid counts and negative region dimensions before queuing', () => {
    expect(() => validateImageTaskRequest({
      feature: 'remove_product',
      count: 0,
      images: [{ role: 'source', path: '/authorized/input/scene.png' }],
    })).toThrow('count must be a positive integer');

    expect(() => validateImageTaskRequest({
      feature: 'remove_product',
      images: [{ role: 'source', path: '/authorized/input/scene.png' }],
      regions: [
        {
          id: 'bad-region',
          x: 0,
          y: 0,
          width: -1,
          height: 20,
        },
      ],
    })).toThrow('region bad-region width must be a non-negative number');
  });

  it('routes sticker replica logo images to execution as logo role', () => {
    const roles = getExecutionImageRoles({
      feature: 'sticker_replica',
      images: [
        { role: 'source', path: '/authorized/input/package.png' },
        { role: 'logo', path: '/authorized/input/logo.png' },
      ],
    });

    expect(roles).toEqual(['source', 'logo']);
  });

  it('routes sticker original style images into execution', () => {
    expect(getExecutionImageRoles({
      feature: 'sticker_original',
      images: [{ role: 'style', path: '/authorized/input/style.png' }],
    })).toEqual(['style']);
  });

  it('rejects negative prompts longer than 500 characters', () => {
    expect(() => validateImageTaskRequest({
      feature: 'sticker_original',
      negativePrompt: 'x'.repeat(501),
    })).toThrow('negativePrompt must be at most 500 characters');
  });

  it('defines sticker replica as product-sticker extraction without fixed aspect ratio', () => {
    const definition = getImageFeatureDefinition('sticker_replica');

    expect(definition.mainPrompt).toBe(
      '从当前产品图中提取产品表面的贴纸/标签，展开为正视角 2D 平面贴纸图。可以按内容判断横竖比例，但外轮廓必须输出为直角矩形，不按原图圆角、弧边或瓶身曲面轮廓出图。若输入是侧拍、斜拍、弧面或可见包装侧面，必须将可见贴纸/包装版面去透视并拉平成连续平面展开稿，不保留盒体侧面、厚度、折角、阴影、反光或 3D 透视。只输出贴纸本身，不输出产品容器或背景。保留原贴纸的排版、色系、风格、装饰元素和图案位置；画面文字须为英文，若原图文字为中文则翻译为对应英文后呈现。若提供单独 Logo 图，仅作为品牌标识嵌入到对应位置，不作为版式、配色或风格参考。所有贴纸输出都必须是直角矩形平面贴纸：四角为 90 度直角，边缘为水平/垂直直线；不要圆角、弧边、圆形、椭圆、异形、模切边或瓶身弧面轮廓。',
    );
  });

  it('requires every sticker feature to output sharp-corner rectangular stickers', () => {
    for (const feature of ['sticker_replica', 'sticker_variation', 'sticker_original'] as const) {
      const prompt = getImageFeatureDefinition(feature).mainPrompt;

      expect(prompt).toContain('直角矩形');
      expect(prompt).toContain('90 度直角');
      expect(prompt).toContain('不要圆角、弧边');
    }
  });

  it('defines remove-product as a local in-place edit', () => {
    const definition = getImageFeatureDefinition('remove_product');

    expect(definition.mainPrompt).toContain('喷雾/雾气');
    expect(definition.mainPrompt).toContain('表面状态');
    expect(definition.mainPrompt).toContain('不顺带清洁');
  });

  it('defines main image asset variation with concise dual-input e-commerce prompt', () => {
    const definition = getImageFeatureDefinition('main_image_asset_variation');

    expect(definition.defaultShowProduct).toBe(true);
    expect(definition.mainPrompt).toContain('基于输入图生成跨境电商主图');
    expect(definition.mainPrompt).toContain('白底/孤立产品图');
    expect(definition.mainPrompt).toContain('生活方式场景、英文标题、卖点卡片');
    expect(definition.mainPrompt).toContain('明显不同的场景、标题排版或主视觉构图');
  });

  it('defines product-set features as product-only edit operations', () => {
    const expectations = [
      [
        'product_main_image',
        ['US Temu ecommerce main product image', 'single primary SKU', 'JSON execution prompt'],
        true,
      ],
      [
        'product_comparison_image',
        ['before/after comparison', 'single primary SKU', 'JSON execution prompt'],
        true,
      ],
      [
        'product_multi_scene',
        ['multi-application-scope', 'Never render the SKU body', 'JSON execution prompt'],
        false,
      ],
    ] as const;

    for (const [feature, promptContents, defaultShowProduct] of expectations) {
      const definition = getImageFeatureDefinition(feature);

      if (feature === 'product_main_image') {
        expect(definition.acceptedImageRoles).toEqual(['product', 'reference']);
        expect(definition.executionImageRoles).toEqual(['product', 'reference']);
      } else {
        expect(definition.acceptedImageRoles).toEqual(['product']);
        expect(definition.executionImageRoles).toEqual(['product']);
      }
      expect(definition.requiredImageRoles).toEqual(['product']);
      expect(definition.executionModel).toBe('edit');
      expect(definition.defaultShowProduct).toBe(defaultShowProduct);
      for (const promptContent of promptContents) {
        expect(definition.mainPrompt).toContain(promptContent);
      }
    }
  });

  it('uses the product image once for multi-scene execution', () => {
    const roles = getExecutionImageRoles({
      feature: 'product_multi_scene',
      images: [
        { role: 'product', path: '/authorized/input/product-front.png' },
        { role: 'product', path: '/authorized/input/product-side.png' },
      ],
    });

    expect(roles).toEqual(['product']);
  });

  it('requires a product image for each product-set feature', () => {
    for (const feature of ['product_main_image', 'product_comparison_image', 'product_multi_scene'] as const) {
      expect(() => validateImageTaskRequest({ feature })).toThrow(
        `${feature} requires image role product`,
      );
    }
  });

  it('accepts product multi-scene requests without a prompt', () => {
    const request = {
      feature: 'product_multi_scene' as const,
      images: [{ role: 'product' as const, path: '/authorized/input/product.png' }],
    };

    expect(validateImageTaskRequest(request)).toMatchObject(request);
    expect(validateImageTaskRequest({ ...request, prompt: '   ' }).prompt).toBe('   ');
    expect(validateImageTaskRequest({ ...request, prompt: 'Kitchen countertop cleaning' }).prompt).toBe(
      'Kitchen countertop cleaning',
    );
  });

  it('accepts handheld reference images on product main image in handheld mode', () => {
    const request = validateImageTaskRequest({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      images: [
        { role: 'product', path: '/authorized/input/product.png' },
        { role: 'reference', path: '/authorized/resources/product/handheld-pump-foam.png' },
      ],
    });

    expect(request.images).toHaveLength(2);
  });

  it('rejects handheld reference images on product main image outside handheld mode', () => {
    expect(() => validateImageTaskRequest({
      feature: 'product_main_image',
      productHandheldMode: 'not_handheld',
      images: [
        { role: 'product', path: '/authorized/input/product.png' },
        { role: 'reference', path: '/authorized/resources/product/handheld-pump-foam.png' },
      ],
    })).toThrow('product_main_image accepts reference images only in handheld mode');
  });

  it('accepts every product-set control for its owning feature', () => {
    const productImage = [{ role: 'product' as const, path: '/authorized/input/product.png' }];

    for (const productHandheldMode of ['handheld', 'not_handheld'] as const) {
      for (const productEffectMode of ['auto', 'show', 'hide'] as const) {
        expect(validateImageTaskRequest({
          feature: 'product_main_image',
          images: productImage,
          productHandheldMode,
          productEffectMode,
          prompt: 'generic prompt',
          negativePrompt: 'no text',
          scenePrompt: 'kitchen counter',
        })).toMatchObject({ productHandheldMode, productEffectMode });
      }
    }

    for (const comparisonLayout of ['auto', 'horizontal', 'vertical'] as const) {
      for (const comparisonIntensity of ['light', 'medium', 'heavy'] as const) {
        for (const showProduct of [true, false]) {
          expect(validateImageTaskRequest({
            feature: 'product_comparison_image',
            images: productImage,
            comparisonLayout,
            comparisonIntensity,
            showProduct,
            prompt: 'generic prompt',
            negativePrompt: 'no text',
            scenePrompt: 'kitchen counter',
          })).toMatchObject({ comparisonLayout, comparisonIntensity, showProduct });
        }
      }
    }

    for (const multiSceneLayout of ['single', 'collage', 'grid'] as const) {
      expect(validateImageTaskRequest({
        feature: 'product_multi_scene',
        images: productImage,
        multiSceneLayout,
        prompt: 'generic prompt',
        negativePrompt: 'no text',
      })).toMatchObject({ multiSceneLayout });
    }
  });

  it('rejects unknown product-set enum values and controls owned by another feature', () => {
    const request = {
      feature: 'product_main_image' as const,
      images: [{ role: 'product' as const, path: '/authorized/input/product.png' }],
    };

    expect(() => validateImageTaskRequest({ ...request, productHandheldMode: 'held_by_robot' as never })).toThrow(
      'productHandheldMode must be one of handheld, not_handheld',
    );
    expect(() => validateImageTaskRequest({ ...request, productEffectMode: 'sometimes' as never })).toThrow(
      'productEffectMode must be one of auto, show, hide',
    );
    expect(() => validateImageTaskRequest({ ...request, comparisonLayout: 'diagonal' as never })).toThrow(
      'comparisonLayout must be one of auto, horizontal, vertical',
    );
    expect(() => validateImageTaskRequest({ ...request, comparisonIntensity: 'extreme' as never })).toThrow(
      'comparisonIntensity must be one of light, medium, heavy',
    );
    expect(() => validateImageTaskRequest({ ...request, multiSceneLayout: 'split' as never })).toThrow(
      'multiSceneLayout must be one of single, collage, grid',
    );
    expect(() => validateImageTaskRequest({ ...request, comparisonLayout: 'horizontal' })).toThrow(
      'comparisonLayout is not supported by product_main_image',
    );
    expect(() => validateImageTaskRequest({
      ...request,
      feature: 'product_comparison_image',
      productEffectMode: 'show',
    })).toThrow('productEffectMode is not supported by product_comparison_image');
    expect(() => validateImageTaskRequest({
      ...request,
      feature: 'product_multi_scene',
      scenePrompt: 'kitchen counter',
    })).toThrow('scenePrompt is not supported by product_multi_scene');

  });

  it.each([
    ['main_image_asset_variation', [{ role: 'source' as const, path: '/authorized/input/main-image.png' }]],
    ['scene_variation', [{ role: 'source' as const, path: '/authorized/input/scene.png' }]],
    ['create_new_scene', []],
  ] as const)('accepts boolean showProduct for %s', (feature, images) => {
    for (const showProduct of [true, false]) {
      expect(validateImageTaskRequest({ feature, images: [...images], showProduct }).showProduct).toBe(showProduct);
    }
  });

  it('validates showProduct at runtime before feature ownership', () => {
    for (const showProduct of ['true', 1] as unknown as boolean[]) {
      expect(() => validateImageTaskRequest({
        feature: 'scene_variation',
        images: [{ role: 'source', path: '/authorized/input/scene.png' }],
        showProduct,
      })).toThrow('showProduct must be a boolean');
    }
  });

  it('limits showProduct to its supported features', () => {
    const productRequest = {
      images: [{ role: 'product' as const, path: '/authorized/input/product.png' }],
    };

    expect(validateImageTaskRequest({
      feature: 'product_comparison_image',
      ...productRequest,
      showProduct: true,
    }).showProduct).toBe(true);
    expect(validateImageTaskRequest({
      feature: 'product_comparison_image',
      ...productRequest,
      showProduct: false,
    }).showProduct).toBe(false);
    expect(() => validateImageTaskRequest({
      feature: 'product_comparison_image',
      ...productRequest,
      showProduct: 'true' as never,
    })).toThrow('showProduct must be a boolean');
    expect(() => validateImageTaskRequest({
      feature: 'remove_product',
      images: [{ role: 'source', path: '/authorized/input/scene.png' }],
      showProduct: true,
    })).toThrow('showProduct is not supported by remove_product');
    expect(() => validateImageTaskRequest({
      feature: 'sticker_variation',
      images: [{ role: 'source', path: '/authorized/input/sticker.png' }],
      showProduct: false,
    })).toThrow('showProduct is not supported by sticker_variation');
    expect(() => validateImageTaskRequest({
      feature: 'product_main_image',
      ...productRequest,
      showProduct: true,
    })).toThrow('showProduct is not supported by product_main_image');
    expect(() => validateImageTaskRequest({
      feature: 'product_multi_scene',
      ...productRequest,
      showProduct: false,
    })).toThrow('showProduct is not supported by product_multi_scene');
  });

  it('accepts complete positive variant metadata', () => {
    const request = validateImageTaskRequest({
      feature: 'product_main_image',
      images: [{ role: 'product', path: '/authorized/input/product.png' }],
      variantIndex: 2,
      variantTotal: 3,
    });

    expect(request.variantIndex).toBe(2);
    expect(request.variantTotal).toBe(3);
  });

  it('rejects incomplete or invalid variant metadata', () => {
    const request = {
      feature: 'product_main_image' as const,
      images: [{ role: 'product' as const, path: '/authorized/input/product.png' }],
    };

    expect(() => validateImageTaskRequest({ ...request, variantIndex: 1 })).toThrow(
      'variantIndex and variantTotal must be provided together',
    );
    expect(() => validateImageTaskRequest({ ...request, variantIndex: 0, variantTotal: 1 })).toThrow(
      'variantIndex must be a positive integer',
    );
    expect(() => validateImageTaskRequest({ ...request, variantIndex: 1, variantTotal: 0 })).toThrow(
      'variantTotal must be a positive integer',
    );
    expect(() => validateImageTaskRequest({ ...request, variantIndex: 2, variantTotal: 1 })).toThrow(
      'variantIndex must be less than or equal to variantTotal',
    );
  });

  it('defines sku features as source-based edit operations', () => {
    const replica = getImageFeatureDefinition('sku_replica');
    const variation = getImageFeatureDefinition('sku_variation');
    const original = getImageFeatureDefinition('sku_original');

    expect(replica.requiredImageRoles).toEqual(['source', 'reference']);
    expect(variation.requiredImageRoles).toEqual(['source']);
    expect(original.requiredImageRoles).toEqual(['source']);
    expect(replica.executionImageRoles).toEqual(['source', 'reference']);
    expect(variation.executionImageRoles).toEqual(['source', 'reference']);
    expect(original.executionImageRoles).toEqual(['source', 'reference']);
  });

  it('accepts sku replica requests with source and reference images', () => {
    const request = validateImageTaskRequest({
      feature: 'sku_replica',
      images: [
        { role: 'source', path: '/authorized/input/sku.png' },
        { role: 'reference', path: '/authorized/input/ref.png' },
      ],
    });

    expect(request.feature).toBe('sku_replica');
  });

  it('defines sku hit main image as a two-image edit that is not a bottle SKU shot', () => {
    const definition = getImageFeatureDefinition('sku_hit_main_image');

    expect(definition.acceptedImageRoles).toEqual(['source', 'reference']);
    expect(definition.requiredImageRoles).toEqual(['source', 'reference']);
    expect(definition.executionModel).toBe('edit');
    expect(definition.executionImageRoles).toEqual(['source', 'reference']);
    expect(definition.mainPrompt).toContain('爆款主图');
    expect(definition.mainPrompt).toContain('不继承原画面');
    expect(definition.mainPrompt).not.toContain('输出整瓶 SKU 产品图');
  });

  it('requires exactly one source and one reference for sku hit main image', () => {
    const valid = {
      feature: 'sku_hit_main_image' as const,
      images: [
        { role: 'source' as const, path: '/authorized/input/sku.png' },
        { role: 'reference' as const, path: '/authorized/input/hit-main.png' },
      ],
    };

    expect(validateImageTaskRequest(valid).feature).toBe('sku_hit_main_image');

    expect(() => validateImageTaskRequest({
      ...valid,
      images: [{ role: 'source', path: '/authorized/input/sku.png' }],
    })).toThrow('sku_hit_main_image requires image role reference');

    expect(() => validateImageTaskRequest({
      ...valid,
      images: [{ role: 'reference', path: '/authorized/input/hit-main.png' }],
    })).toThrow('sku_hit_main_image requires image role source');

    expect(() => validateImageTaskRequest({
      ...valid,
      images: [
        { role: 'source', path: '/authorized/input/sku.png' },
        { role: 'source', path: '/authorized/input/sku-2.png' },
        { role: 'reference', path: '/authorized/input/hit-main.png' },
      ],
    })).toThrow('sku_hit_main_image requires exactly one source image');

    expect(() => validateImageTaskRequest({
      ...valid,
      images: [
        { role: 'source', path: '/authorized/input/sku.png' },
        { role: 'reference', path: '/authorized/input/hit-main.png' },
        { role: 'reference', path: '/authorized/input/hit-main-2.png' },
      ],
    })).toThrow('sku_hit_main_image requires exactly one reference image');
  });

  it('rejects product-set controls on sku hit main image', () => {
    const request = {
      feature: 'sku_hit_main_image' as const,
      images: [
        { role: 'source' as const, path: '/authorized/input/sku.png' },
        { role: 'reference' as const, path: '/authorized/input/hit-main.png' },
      ],
    };

    expect(() => validateImageTaskRequest({ ...request, productHandheldMode: 'handheld' })).toThrow(
      'productHandheldMode is not supported by sku_hit_main_image',
    );
    expect(() => validateImageTaskRequest({ ...request, showProduct: true })).toThrow(
      'showProduct is not supported by sku_hit_main_image',
    );
  });
});
