import { describe, expect, it } from 'vitest';
import type { ImageFeature } from '../../../shared/domain/imageFeatureApi';
import type { TaskRecord } from '../../../shared/domain/tasks';
import { applyProductImageSetRestore } from '../applyProductImageSetRestore';

function createTask(request: NonNullable<TaskRecord['request']>): TaskRecord {
  return {
    taskId: 'task-1',
    batchId: 'batch-1',
    category: '套图',
    feature: '套图任务',
    status: 'Pending',
    imports: [],
    outputs: [],
    request,
    createdAt: '2026-07-31T00:00:00.000Z',
    updatedAt: '2026-07-31T00:00:00.000Z',
  };
}

function createRequest(feature: ImageFeature, overrides: Partial<NonNullable<TaskRecord['request']>> = {}) {
  return {
    feature,
    images: [{ role: 'product' as const, path: 'C:/sku/front.png' }],
    count: 1,
    ...overrides,
  };
}

describe('applyProductImageSetRestore', () => {
  it('restores every SKU image and all persisted multi-scene form fields', () => {
    const restored = applyProductImageSetRestore(createTask(createRequest('product_multi_scene', {
      images: [
        { role: 'product', path: 'C:/sku/front.png' },
        { role: 'product', path: 'C:/sku/side.png' },
        { role: 'source', path: 'C:/source/ignored.png' },
      ],
      prompt: 'bathroom and travel scenes',
      negativePrompt: 'no text',
      multiSceneLayout: 'grid',
      aspectRatio: '4:5',
      variantTotal: 2,
    })));

    expect(restored).toMatchObject({
      subTab: 'multiScene',
      prompt: 'bathroom and travel scenes',
      negativePrompt: 'no text',
      scenePrompt: '',
      multiSceneLayout: 'grid',
      aspectRatio: '4:5',
      count: 2,
    });
    expect(restored?.skuBatch?.page).toBe('productSet');
    expect(restored?.skuBatch?.images.map((image) => image.filePath))
      .toEqual(['C:/sku/front.png', 'C:/sku/side.png']);
  });

  it('restores all main-image fields', () => {
    expect(applyProductImageSetRestore(createTask(createRequest('product_main_image', {
      prompt: 'product hero',
      negativePrompt: 'no glare',
      scenePrompt: 'kitchen counter',
      productHandheldMode: 'handheld',
      productEffectMode: 'show',
    })))).toMatchObject({
      subTab: 'main',
      prompt: 'product hero',
      negativePrompt: 'no glare',
      scenePrompt: 'kitchen counter',
      productHandheldMode: 'handheld',
      productEffectMode: 'show',
    });
  });

  it('restores all comparison fields', () => {
    expect(applyProductImageSetRestore(createTask(createRequest('product_comparison_image', {
      prompt: 'credible result',
      negativePrompt: 'no exaggerated claim',
      scenePrompt: 'bathroom mirror',
      comparisonLayout: 'vertical',
      comparisonIntensity: 'heavy',
      showProduct: false,
    })))).toMatchObject({
      subTab: 'comparison',
      prompt: 'credible result',
      negativePrompt: 'no exaggerated claim',
      scenePrompt: 'bathroom mirror',
      comparisonLayout: 'vertical',
      comparisonIntensity: 'heavy',
      showProduct: false,
    });
  });

  it('uses exact defaults for old tasks without enhanced fields', () => {
    expect(applyProductImageSetRestore(createTask(createRequest('product_main_image')))).toMatchObject({
      subTab: 'main', prompt: '', negativePrompt: '', scenePrompt: '',
      productHandheldMode: 'not_handheld', productEffectMode: 'auto',
      comparisonLayout: 'auto', comparisonIntensity: 'medium', showProduct: true, multiSceneLayout: 'single',
    });
    expect(applyProductImageSetRestore(createTask(createRequest('product_comparison_image')))).toMatchObject({
      subTab: 'comparison', prompt: '', negativePrompt: '', scenePrompt: '',
      productHandheldMode: 'not_handheld', productEffectMode: 'auto',
      comparisonLayout: 'auto', comparisonIntensity: 'medium', showProduct: true, multiSceneLayout: 'single',
    });
  });

  it('prefers variantTotal and falls back safely for old task shapes', () => {
    expect(applyProductImageSetRestore(createTask(createRequest('product_main_image', {
      count: 2,
      variantTotal: 2,
    }))))
      .toMatchObject({ aspectRatio: '1:1', count: 2 });

    expect(applyProductImageSetRestore(createTask(createRequest('product_main_image', {
      count: 999,
    }))))
      .toMatchObject({ aspectRatio: '1:1', count: 1 });
  });

  it('returns null for a task outside the product image set route', () => {
    expect(applyProductImageSetRestore(createTask(createRequest('remove_product')))).toBeNull();
  });

  it('uses the final path segment for Windows SKU file names', () => {
    const restored = applyProductImageSetRestore(createTask(createRequest('product_main_image', {
      images: [{ role: 'product', path: 'C:\\sku\\front.png' }],
    })));

    expect(restored?.skuBatch?.images[0]?.fileName).toBe('front.png');
  });
});
