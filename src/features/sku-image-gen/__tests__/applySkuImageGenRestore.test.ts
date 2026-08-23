import { describe, expect, it } from 'vitest';
import type { TaskRecord } from '../../../shared/domain/tasks';
import { applySkuImageGenRestore } from '../applySkuImageGenRestore';

function createTask(request: NonNullable<TaskRecord['request']>): TaskRecord {
  return {
    taskId: 'task-1',
    batchId: 'batch-1',
    category: 'SKU',
    feature: 'SKU 爆款主图',
    status: 'Pending',
    imports: [],
    outputs: [],
    request,
    createdAt: '2026-08-23T00:00:00.000Z',
    updatedAt: '2026-08-23T00:00:00.000Z',
  };
}

describe('applySkuImageGenRestore', () => {
  it('restores hit-main tab with both images and form fields', () => {
    const restored = applySkuImageGenRestore(createTask({
      feature: 'sku_hit_main_image',
      images: [
        { role: 'source', path: 'C:/sku/new.png' },
        { role: 'reference', path: 'C:/refs/hit-main.png' },
      ],
      aspectRatio: '1:1',
      brand: 'wkau',
      productName: 'WHITE RADIATOR REPAIR',
      capacity: '100ml',
      prompt: '对比更强',
      negativePrompt: 'no fake english',
      variantIndex: 1,
      variantTotal: 3,
    }));

    expect(restored?.subTab).toBe('hitMain');
    expect(restored?.hitMain).toMatchObject({
      aspectRatio: '1:1',
      count: 3,
      brand: 'wkau',
      productName: 'WHITE RADIATOR REPAIR',
      capacity: '100ml',
      prompt: '对比更强',
      negativePrompt: 'no fake english',
    });
    expect(restored?.hitMain.skuBatch?.images[0]?.filePath).toBe('C:/sku/new.png');
    expect(restored?.hitMain.referenceBatch?.images[0]?.filePath).toBe('C:/refs/hit-main.png');
    expect(restored?.replica.skuBatch).toBeNull();
    expect(restored?.replica.aspectRatio).toBe('auto');
  });

  it('keeps empty hit-main defaults when restoring replica', () => {
    const restored = applySkuImageGenRestore(createTask({
      feature: 'sku_replica',
      images: [
        { role: 'source', path: 'C:/sku/a.png' },
        { role: 'reference', path: 'C:/refs/label.png' },
      ],
    }));

    expect(restored?.subTab).toBe('replica');
    expect(restored?.hitMain.aspectRatio).toBe('1:1');
    expect(restored?.hitMain.count).toBe(3);
    expect(restored?.hitMain.skuBatch).toBeNull();
  });
});
