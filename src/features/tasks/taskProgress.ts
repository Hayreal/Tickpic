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
  if (task.progress) {
    return task.progress;
  }
  if (task.status === 'completed') {
    return { completed: task.images.length, total: task.images.length || total };
  }
  return { completed: task.images.length, total };
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
