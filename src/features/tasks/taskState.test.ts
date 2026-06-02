import { describe, expect, it } from 'vitest';
import { createPendingTask } from './taskState';

describe('createPendingTask', () => {
  it('creates a pending task from an import batch only when generation starts', () => {
    const task = createPendingTask({
      category: 'sticker',
      feature: '贴纸复刻',
      batchId: 'batch-1',
      imports: [],
    });

    expect(task.status).toBe('Pending');
    expect(task.batchId).toBe('batch-1');
    expect(task.outputs).toEqual([]);
  });
});
