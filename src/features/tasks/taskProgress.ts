import type { ImageTaskProgress, ImageTaskRecord } from '../../shared/domain/imageFeatureApi';

export function getExpectedImageCount(task: ImageTaskRecord | null, fallbackCount: number): number {
  if (!task) return fallbackCount;
  if (task.progress?.total) return task.progress.total;
  if (task.request.count) return task.request.count;
  return fallbackCount;
}

export function getTaskProgress(
  task: ImageTaskRecord | null,
  fallbackCount: number,
): ImageTaskProgress {
  const total = getExpectedImageCount(task, fallbackCount);
  if (!task) {
    return { completed: 0, total };
  }
  const normalizeCompleted = (completed: number) => Math.min(Math.max(completed, 0), Math.max(total, 0));
  if (task.progress) {
    return {
      completed: normalizeCompleted(task.progress.completed),
      total,
    };
  }
  if (task.status === 'completed') {
    return { completed: normalizeCompleted(task.images.length), total };
  }
  return { completed: normalizeCompleted(task.images.length), total };
}

export function hasPartialOrCompleteResults(task: ImageTaskRecord | null): boolean {
  return !!task && task.images.length > 0;
}

export function isTaskInProgress(task: ImageTaskRecord | null): boolean {
  return !!task && (task.status === 'queued' || task.status === 'running');
}

export function formatTaskProgress(task: ImageTaskRecord | null, fallbackCount: number): string {
  const { completed, total } = getTaskProgress(task, fallbackCount);
  return `${completed} / ${total}`;
}

export function getTaskBatchProgress(
  tasks: ImageTaskRecord[],
  fallbackCount: number,
): ImageTaskProgress {
  if (tasks.length === 0) {
    return { completed: 0, total: fallbackCount };
  }

  return tasks.reduce<ImageTaskProgress>((progress, task) => {
    const taskProgress = getTaskProgress(task, task.request.count ?? 1);
    return {
      completed: progress.completed + taskProgress.completed,
      total: progress.total + taskProgress.total,
    };
  }, { completed: 0, total: 0 });
}

export function hasPartialOrCompleteBatchResults(tasks: ImageTaskRecord[]): boolean {
  return tasks.some((task) => hasPartialOrCompleteResults(task));
}

export function isTaskBatchInProgress(tasks: ImageTaskRecord[]): boolean {
  return tasks.some((task) => isTaskInProgress(task));
}

export function formatTaskBatchProgress(tasks: ImageTaskRecord[], fallbackCount: number): string {
  const { completed, total } = getTaskBatchProgress(tasks, fallbackCount);
  return `${completed} / ${total}`;
}
