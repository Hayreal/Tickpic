import { describe, expect, it } from 'vitest';
import type { ImageFeature } from '../../../shared/domain/imageFeatureApi';
import type { TaskRecord } from '../../../shared/domain/tasks';
import { applyProductRestore } from '../applyProductRestore';

function createTask(request: NonNullable<TaskRecord['request']>): TaskRecord {
  return {
    taskId: 'task-1',
    batchId: 'batch-1',
    category: '产品处理',
    feature: '产品处理',
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
    images: [{ role: 'source' as const, path: 'C:/source/main.png' }],
    count: 1,
    ...overrides,
  };
}

describe('applyProductRestore', () => {
  it('restores the main-image variation negative prompt', () => {
    const restored = applyProductRestore(createTask(createRequest('main_image_asset_variation', {
      prompt: 'premium lifestyle composition',
      negativePrompt: 'no badges, no extra products',
      sellingPoints: ['Easy to pack'],
    })));

    expect(restored).toMatchObject({
      subTab: 'theme',
      themePrompt: 'premium lifestyle composition',
      themeNegativePrompt: 'no badges, no extra products',
      themeSellingPoints: 'Easy to pack',
    });
  });
});
