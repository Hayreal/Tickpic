import type { TaskRecord, StoredImageRecord } from '../types';

export function createPendingTask(input: {
  category: string;
  feature: string;
  batchId: string;
  imports: StoredImageRecord[];
}): TaskRecord {
  const now = new Date().toISOString();
  return {
    taskId: `task-${Date.now()}`,
    batchId: input.batchId,
    category: input.category,
    feature: input.feature,
    status: 'Pending',
    imports: input.imports,
    outputs: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function completeTask(task: TaskRecord, outputs: StoredImageRecord[]): TaskRecord {
  return {
    ...task,
    status: 'Completed',
    outputs,
    updatedAt: new Date().toISOString(),
  };
}

export function failTask(task: TaskRecord): TaskRecord {
  return {
    ...task,
    status: 'Failed',
    updatedAt: new Date().toISOString(),
  };
}

export function startTask(task: TaskRecord): TaskRecord {
  return {
    ...task,
    status: 'Running',
    updatedAt: new Date().toISOString(),
  };
}
