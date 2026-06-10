import { describe, expect, it } from 'vitest';
import type { TaskRecord } from '../../../shared/domain/tasks';
import {
  aggregateTaskStatuses,
  getSharedOutputBatchId,
  groupTasksForDisplay,
} from '../taskBatchGrouping';
import { toTaskListItem } from '../taskMappers';

function createTask(
  taskId: string,
  overrides: Partial<TaskRecord> = {},
): TaskRecord {
  return {
    taskId,
    batchId: taskId,
    category: '贴纸',
    feature: '贴纸裂变',
    status: 'Completed',
    imports: [],
    outputs: [{ id: `out-${taskId}`, fileName: `${taskId}.png`, filePath: `/tmp/${taskId}.png`, fileSize: 1, mimeType: 'image/png', createdAt: '2026-06-08T10:00:00.000Z' }],
    request: { feature: 'sticker_variation' },
    createdAt: '2026-06-08T10:00:00.000Z',
    updatedAt: '2026-06-08T10:00:00.000Z',
    ...overrides,
  };
}

describe('taskBatchGrouping', () => {
  it('groups tasks with the same outputBatchId into one list entry', () => {
    const groups = groupTasksForDisplay([
      createTask('task-1', { request: { feature: 'sticker_variation', outputBatchId: 'batch-a' } }),
      createTask('task-2', { request: { feature: 'sticker_variation', outputBatchId: 'batch-a' } }),
      createTask('task-3'),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.kind === 'batch')?.tasks).toHaveLength(2);
    expect(groups.find((group) => group.kind === 'single')?.tasks[0]?.taskId).toBe('task-3');
  });

  it('aggregates batch status and output counts for list display', () => {
    const group = groupTasksForDisplay([
      createTask('task-1', { status: 'Completed', request: { feature: 'sticker_variation', outputBatchId: 'batch-a' } }),
      createTask('task-2', { status: 'Running', request: { feature: 'sticker_variation', outputBatchId: 'batch-a' }, outputs: [] }),
    ]).find((entry) => entry.kind === 'batch')!;

    const item = toTaskListItem(group);
    expect(item.kind).toBe('batch');
    expect(item.subTaskCount).toBe(2);
    expect(item.outputCount).toBe(1);
    expect(item.status).toBe('Running');
    expect(aggregateTaskStatuses(group.tasks)).toBe('Running');
  });

  it('detects shared output batch ids across active image tasks', () => {
    expect(getSharedOutputBatchId([
      { request: { feature: 'sticker_variation', outputBatchId: 'batch-a' } },
      { request: { feature: 'sticker_variation', outputBatchId: 'batch-a' } },
    ])).toBe('batch-a');
    expect(getSharedOutputBatchId([
      { request: { feature: 'sticker_variation', outputBatchId: 'batch-a' } },
      { request: { feature: 'sticker_variation' } },
    ])).toBeNull();
  });
});
