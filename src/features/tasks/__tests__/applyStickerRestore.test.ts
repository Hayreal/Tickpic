import { describe, expect, it } from 'vitest';
import type { TaskRecord } from '../../../shared/domain/tasks';
import { applyStickerRestore } from '../applyStickerRestore';

describe('applyStickerRestore', () => {
  it('restores explicit output ratio and quality for original stickers', () => {
    const restored = applyStickerRestore(task({
      feature: 'sticker_original',
      aspectRatio: '7:10',
      outputQuality: '2K',
      brand: 'WKUA',
    }));

    expect(restored).toMatchObject({
      subTab: 'original',
      originalAspectRatio: '7:10',
      originalOutputQuality: '2K',
      originalBrand: 'WKUA',
    });
    expect(restored).not.toHaveProperty('originalProductRatio');
  });

  it('migrates a legacy replica preset and logo text into the canonical state', () => {
    const restored = applyStickerRestore(task({
      feature: 'sticker_replica',
      aspectRatio: 'auto',
      productRatio: '21:10',
      logoText: 'LEGACY',
    }));

    expect(restored).toMatchObject({
      subTab: 'copy',
      copyAspectRatio: '21:10',
      copyOutputQuality: '1K',
      copyBrand: 'LEGACY',
    });
    expect(restored).not.toHaveProperty('copyProductRatio');
    expect(restored).not.toHaveProperty('copyLogoText');
  });
});

function task(request: Record<string, unknown>): TaskRecord {
  return {
    taskId: 'task-sticker',
    batchId: 'batch-sticker',
    category: 'sticker',
    feature: 'sticker',
    status: 'Pending',
    imports: [],
    outputs: [],
    request: request as unknown as TaskRecord['request'],
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
  };
}
