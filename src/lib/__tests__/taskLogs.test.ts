import { describe, expect, it } from 'vitest';
import type { AppLogEntry } from '../../shared/domain/appLog';
import type { ImageTaskRecord } from '../../shared/domain/imageFeatureApi';
import { filterLogsForTasks } from '../taskLogs';

function makeTask(overrides: Partial<ImageTaskRecord> = {}): ImageTaskRecord {
  return {
    taskId: 'task-1',
    feature: 'remove_product',
    status: 'running',
    images: [],
    request: { feature: 'remove_product', count: 1 },
    createdAt: '2026-06-08T10:00:00.000Z',
    updatedAt: '2026-06-08T10:00:05.000Z',
    ...overrides,
  };
}

function makeLog(overrides: Partial<AppLogEntry> = {}): AppLogEntry {
  return {
    id: 'log-1',
    timestamp: '2026-06-08T10:00:01.000Z',
    level: 'info',
    source: 'image-task',
    message: '任务状态变更: running',
    details: JSON.stringify({ taskId: 'task-1', feature: 'remove_product' }),
    ...overrides,
  };
}

describe('filterLogsForTasks', () => {
  it('keeps image-task logs that reference tracked task ids', () => {
    const logs = [
      makeLog(),
      makeLog({
        id: 'log-2',
        message: '其他任务',
        details: JSON.stringify({ taskId: 'task-2' }),
      }),
    ];

    expect(filterLogsForTasks(logs, [makeTask()])).toHaveLength(1);
  });

  it('includes model logs during active tasks after task start', () => {
    const logs = [
      makeLog({
        id: 'log-model',
        source: 'model',
        message: '模型请求 (instruction)',
        details: '{"model":"gpt-5.4-mini"}',
        timestamp: '2026-06-08T10:00:02.000Z',
      }),
      makeLog({
        id: 'log-old',
        source: 'model',
        message: '旧日志',
        timestamp: '2026-06-08T09:59:00.000Z',
      }),
    ];

    expect(filterLogsForTasks(logs, [makeTask()])).toHaveLength(1);
  });

  it('drops unrelated app logs', () => {
    const logs = [
      makeLog({
        source: 'app',
        message: 'Electron 应用已就绪',
        details: undefined,
      }),
    ];

    expect(filterLogsForTasks(logs, [makeTask()])).toHaveLength(0);
  });
});
