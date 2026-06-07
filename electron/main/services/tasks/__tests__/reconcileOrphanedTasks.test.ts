import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TaskRecord } from '../../../../src/shared/domain/tasks.js';
import { createTaskRepository } from '../taskRepository.js';
import { reconcileOrphanedProfileTasks } from '../reconcileOrphanedTasks.js';

describe('reconcileOrphanedProfileTasks', () => {
  let tempDir: string;
  let tasksFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'tickpic-tasks-'));
    tasksFile = path.join(tempDir, 'tasks.json');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('marks pending and running tasks as failed after app restart', async () => {
    const repo = createTaskRepository(() => tasksFile);
    const task: TaskRecord = {
      taskId: 'task-1',
      batchId: 'batch-1',
      category: '贴纸',
      feature: '贴纸复刻',
      status: 'Running',
      imports: [],
      outputs: [],
      createdAt: '2026-06-04T00:00:00.000Z',
      updatedAt: '2026-06-04T00:00:00.000Z',
    };
    repo.create(task as unknown as Record<string, unknown>);

    reconcileOrphanedProfileTasks(repo);

    const stored = JSON.parse(await readFile(tasksFile, 'utf-8')) as TaskRecord[];
    expect(stored[0]).toMatchObject({
      status: 'Failed',
      error: {
        code: 'app_shutdown',
        message: '应用意外退出，任务已终止',
      },
    });
  });
});
