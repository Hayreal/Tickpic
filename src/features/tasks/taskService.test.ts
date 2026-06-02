import { describe, expect, it } from 'vitest';
import { toTaskItem } from './taskMappers';
import type { TaskRecord } from '../../shared/domain/tasks';

describe('toTaskItem', () => {
  it('maps a task record into a profile view model', () => {
    const task: TaskRecord = {
      taskId: 'task-1',
      batchId: 'batch-1',
      category: 'sticker',
      feature: '贴纸复刻',
      status: 'Completed',
      imports: [],
      outputs: [{ id: 'o1', fileName: 'a.png', filePath: '/tmp/a.png', fileSize: 1, mimeType: 'image/png', createdAt: '2026-06-03T00:00:00.000Z' }],
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
    };

    expect(toTaskItem(task)).toEqual({
      id: 'task-1',
      category: 'sticker',
      feature: '贴纸复刻',
      status: 'Completed',
      time: '2026-06-03T00:00:00.000Z',
      batchId: 'batch-1',
      importCount: 0,
      outputCount: 1,
    });
  });
});
