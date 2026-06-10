import { describe, expect, it, vi } from 'vitest';
import type { ImageTaskRecord } from '../../../../src/shared/domain/imageFeatureApi';
import { imageTaskRecordToTaskRecord } from './imageTaskProfileSync';

function createImageTask(overrides: Partial<ImageTaskRecord> = {}): ImageTaskRecord {
  return {
    taskId: 'img_task_1',
    feature: 'sticker_replica',
    status: 'completed',
    request: {
      feature: 'sticker_replica',
      prompt: 'Make a sticker',
      count: 2,
      productName: 'Sample Product',
      images: [
        { role: 'source', path: '/tmp/source.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    },
    images: ['/tmp/output-1.png'],
    outputDir: '/tmp/output-dir',
    warnings: ['warning-a'],
    createdAt: '2026-06-03T10:00:00.000Z',
    updatedAt: '2026-06-03T10:05:00.000Z',
    ...overrides,
  };
}

describe('imageTaskRecordToTaskRecord', () => {
  it('persists request metadata for profile drawer', () => {
    const record = imageTaskRecordToTaskRecord(createImageTask());

    expect(record.request?.prompt).toBe('Make a sticker');
    expect(record.request?.count).toBe(2);
    expect(record.outputDir).toBe('/tmp/output-dir');
    expect(record.warnings).toEqual(['warning-a']);
    expect(record.imports).toHaveLength(2);
    expect(record.outputs).toHaveLength(1);
  });

  it('uses outputBatchId as profile batchId for grouped submissions', () => {
    const record = imageTaskRecordToTaskRecord(createImageTask({
      request: {
        feature: 'sticker_variation',
        outputBatchId: 'batch-shared',
        images: [{ role: 'source', path: '/tmp/source.png' }],
      },
    }));

    expect(record.batchId).toBe('batch-shared');
    expect(record.request?.outputBatchId).toBe('batch-shared');
  });
});
