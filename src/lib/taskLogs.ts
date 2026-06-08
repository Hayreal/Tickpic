import type { AppLogEntry } from '../shared/domain/appLog';
import type { ImageTaskRecord } from '../shared/domain/imageFeatureApi';

const TASK_RELATED_SOURCES = new Set<AppLogEntry['source']>(['image-task', 'model', 'storage']);

function entryReferencesTaskId(entry: AppLogEntry, taskId: string) {
  return entry.details?.includes(taskId) ?? false;
}

export function filterLogsForTasks(logs: AppLogEntry[], tasks: ImageTaskRecord[]): AppLogEntry[] {
  if (tasks.length === 0) {
    return [];
  }

  const taskIds = tasks.map((task) => task.taskId);
  const startedAt = Math.min(...tasks.map((task) => new Date(task.createdAt).getTime()));
  const latestUpdate = Math.max(...tasks.map((task) => new Date(task.updatedAt).getTime()));
  const hasActiveTask = tasks.some((task) => task.status === 'queued' || task.status === 'running');

  return logs.filter((entry) => {
    if (!TASK_RELATED_SOURCES.has(entry.source)) {
      return false;
    }

    const entryTime = new Date(entry.timestamp).getTime();
    if (Number.isNaN(entryTime) || entryTime < startedAt) {
      return false;
    }

    if (entry.source === 'image-task') {
      return taskIds.some((taskId) => entryReferencesTaskId(entry, taskId));
    }

    if (taskIds.some((taskId) => entryReferencesTaskId(entry, taskId))) {
      return true;
    }

    if (hasActiveTask) {
      return true;
    }

    return entryTime <= latestUpdate + 120_000;
  });
}
