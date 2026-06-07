import { describe, expect, it } from 'vitest';
import type { TaskRecord } from '../../../shared/domain/tasks';
import { sortTasksByUpdatedAtDesc } from '../sortTasks';

function makeTask(overrides: Partial<TaskRecord> & Pick<TaskRecord, 'taskId' | 'createdAt' | 'updatedAt'>): TaskRecord {
  return {
    batchId: 'batch-1',
    category: '贴纸',
    feature: '贴纸复刻',
    status: 'Completed',
    imports: [],
    outputs: [],
    ...overrides,
  };
}

describe('sortTasksByUpdatedAtDesc', () => {
  it('orders tasks by updatedAt descending', () => {
    const tasks = [
      makeTask({ taskId: 'old', createdAt: '2026-06-01T10:00:00.000Z', updatedAt: '2026-06-01T10:00:00.000Z' }),
      makeTask({ taskId: 'new', createdAt: '2026-06-03T10:00:00.000Z', updatedAt: '2026-06-03T12:00:00.000Z' }),
      makeTask({ taskId: 'middle', createdAt: '2026-06-02T10:00:00.000Z', updatedAt: '2026-06-02T10:00:00.000Z' }),
    ];

    expect(sortTasksByUpdatedAtDesc(tasks).map((task) => task.taskId)).toEqual(['new', 'middle', 'old']);
  });

  it('does not mutate the original array', () => {
    const tasks = [
      makeTask({ taskId: 'a', createdAt: '2026-06-01T10:00:00.000Z', updatedAt: '2026-06-01T10:00:00.000Z' }),
      makeTask({ taskId: 'b', createdAt: '2026-06-02T10:00:00.000Z', updatedAt: '2026-06-02T10:00:00.000Z' }),
    ];

    sortTasksByUpdatedAtDesc(tasks);
    expect(tasks.map((task) => task.taskId)).toEqual(['a', 'b']);
  });
});
