import type { ImageTaskRecord } from '../../shared/domain/imageFeatureApi';
import type { TaskRecord, TaskStatus } from '../../shared/domain/tasks';
import { sortTasksByUpdatedAtDesc } from './sortTasks';

export interface TaskListGroup {
  key: string;
  kind: 'batch' | 'single';
  tasks: TaskRecord[];
  representative: TaskRecord;
  outputBatchId?: string;
}

export function resolveTaskOutputBatchId(
  task: Pick<TaskRecord, 'request' | 'taskId'>,
): string | undefined {
  const batchId = task.request?.outputBatchId?.trim();
  return batchId || undefined;
}

export function getSharedOutputBatchId(tasks: Array<Pick<TaskRecord, 'request'>>): string | null {
  if (tasks.length <= 1) {
    return null;
  }

  const batchIds = tasks
    .map((task) => resolveTaskOutputBatchId(task))
    .filter((batchId): batchId is string => Boolean(batchId));

  if (batchIds.length !== tasks.length) {
    return null;
  }

  const unique = new Set(batchIds);
  return unique.size === 1 ? batchIds[0]! : null;
}

export function groupTasksForDisplay(tasks: TaskRecord[]): TaskListGroup[] {
  const sorted = sortTasksByUpdatedAtDesc(tasks);
  const batchMap = new Map<string, TaskRecord[]>();
  const singles: TaskRecord[] = [];

  for (const task of sorted) {
    const outputBatchId = resolveTaskOutputBatchId(task);
    if (outputBatchId) {
      const existing = batchMap.get(outputBatchId) ?? [];
      existing.push(task);
      batchMap.set(outputBatchId, existing);
      continue;
    }
    singles.push(task);
  }

  const groups: TaskListGroup[] = [];

  for (const [outputBatchId, batchTasks] of batchMap.entries()) {
    const ordered = sortTasksByUpdatedAtDesc(batchTasks);
    if (ordered.length === 1) {
      singles.push(ordered[0]!);
      continue;
    }
    groups.push({
      key: `batch:${outputBatchId}`,
      kind: 'batch',
      tasks: ordered,
      representative: ordered[0]!,
      outputBatchId,
    });
  }

  for (const task of singles) {
    groups.push({
      key: task.taskId,
      kind: 'single',
      tasks: [task],
      representative: task,
    });
  }

  return groups.sort((left, right) => (
    new Date(right.representative.updatedAt).getTime() - new Date(left.representative.updatedAt).getTime()
  ));
}

export function aggregateTaskStatuses(tasks: TaskRecord[]): TaskStatus {
  const statuses = tasks.map((task) => task.status);
  if (statuses.some((status) => status === 'Running')) {
    return 'Running';
  }
  if (statuses.some((status) => status === 'Pending')) {
    return 'Pending';
  }
  if (statuses.every((status) => status === 'Completed')) {
    return 'Completed';
  }
  if (statuses.every((status) => status === 'Failed')) {
    return 'Failed';
  }
  return 'Failed';
}

export function sumTaskOutputs(tasks: TaskRecord[]): number {
  return tasks.reduce((total, task) => total + task.outputs.length, 0);
}

export function sumTaskImports(tasks: TaskRecord[]): number {
  return tasks.reduce((total, task) => total + task.imports.length, 0);
}

export function isSharedImageTaskBatch(tasks: ImageTaskRecord[]): boolean {
  return getSharedOutputBatchId(tasks) !== null;
}
