import { describe, expect, it, vi } from 'vitest';
import { toTaskItem } from '../taskMappers';
import { createRendererTaskService } from '../taskService';
import type { TaskRecord } from '../../../shared/domain/tasks';

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

describe('renderer task service', () => {
  it('creates a pending task and persists it through the desktop client', async () => {
    const desktop = {
      createTask: vi.fn().mockResolvedValue(undefined),
      updateTask: vi.fn().mockResolvedValue(undefined),
      listTasks: vi.fn().mockResolvedValue([]),
    };

    const service = createRendererTaskService(desktop as never);
    const task = await service.createTask({
      category: 'sticker',
      feature: '贴纸复刻',
      batchId: 'batch-1',
      imports: [],
    });

    expect(task.status).toBe('Pending');
    expect(desktop.createTask).toHaveBeenCalledTimes(1);
  });

  it('transitions task to running and persists the update', async () => {
    const desktop = {
      createTask: vi.fn().mockResolvedValue(undefined),
      updateTask: vi.fn().mockResolvedValue(undefined),
      listTasks: vi.fn().mockResolvedValue([]),
    };

    const service = createRendererTaskService(desktop as never);
    const pending = await service.createTask({
      category: 'sticker',
      feature: '贴纸复刻',
      batchId: 'batch-1',
      imports: [],
    });

    const running = await service.startTask(pending);
    expect(running.status).toBe('Running');
    expect(desktop.updateTask).toHaveBeenCalledTimes(1);
  });

  it('completes a task with outputs and persists', async () => {
    const desktop = {
      createTask: vi.fn().mockResolvedValue(undefined),
      updateTask: vi.fn().mockResolvedValue(undefined),
      listTasks: vi.fn().mockResolvedValue([]),
    };

    const service = createRendererTaskService(desktop as never);
    const pending = await service.createTask({
      category: 'sticker',
      feature: '贴纸复刻',
      batchId: 'batch-1',
      imports: [],
    });

    const outputs = [{ id: 'o1', fileName: 'out.png', filePath: '/tmp/out.png', fileSize: 100, mimeType: 'image/png', createdAt: '2026-06-03T00:00:00.000Z' }];
    const completed = await service.completeTask(pending, outputs);
    expect(completed.status).toBe('Completed');
    expect(completed.outputs).toEqual(outputs);
    expect(desktop.updateTask).toHaveBeenCalledTimes(1);
  });

  it('fails a task and persists', async () => {
    const desktop = {
      createTask: vi.fn().mockResolvedValue(undefined),
      updateTask: vi.fn().mockResolvedValue(undefined),
      listTasks: vi.fn().mockResolvedValue([]),
    };

    const service = createRendererTaskService(desktop as never);
    const pending = await service.createTask({
      category: 'sticker',
      feature: '贴纸复刻',
      batchId: 'batch-1',
      imports: [],
    });

    const failed = await service.failTask(pending);
    expect(failed.status).toBe('Failed');
    expect(desktop.updateTask).toHaveBeenCalledTimes(1);
  });
});
