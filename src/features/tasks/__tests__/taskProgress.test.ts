import { describe, expect, it } from 'vitest';
import type { ImageTaskRecord } from '../../../shared/domain/imageFeatureApi';
import { formatTaskBatchProgress, formatTaskProgress, getTaskBatchProgress, getTaskProgress } from '../taskProgress';

function createTask(overrides: Partial<ImageTaskRecord>): ImageTaskRecord {
  return {
    taskId: 'task-1',
    feature: 'sticker_replica',
    status: 'running',
    images: [],
    request: {
      feature: 'sticker_replica',
      count: 1,
    },
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('task progress display', () => {
  it('caps completed progress at the expected image count', () => {
    const task = createTask({
      progress: { completed: 2, total: 1 },
      images: ['/tmp/result-1.png', '/tmp/result-2.png'],
    });

    expect(getTaskProgress(task, 1)).toEqual({ completed: 1, total: 1 });
    expect(formatTaskProgress(task, 1)).toBe('1 / 1');
  });

  it('caps completed image count when restored tasks have extra output files', () => {
    const task = createTask({
      status: 'completed',
      progress: undefined,
      images: ['/tmp/result-1.png', '/tmp/result-2.png'],
    });

    expect(getTaskProgress(task, 1)).toEqual({ completed: 1, total: 1 });
  });

  it('aggregates progress across multiple one-image tasks', () => {
    const tasks = [
      createTask({
        taskId: 'task-1',
        status: 'completed',
        images: ['/tmp/result-1.png'],
        request: { feature: 'sticker_replica', count: 1 },
      }),
      createTask({
        taskId: 'task-2',
        status: 'running',
        images: [],
        request: { feature: 'sticker_replica', count: 1 },
      }),
    ];

    expect(getTaskBatchProgress(tasks, 2)).toEqual({ completed: 1, total: 2 });
    expect(formatTaskBatchProgress(tasks, 2)).toBe('1 / 2');
  });
});
