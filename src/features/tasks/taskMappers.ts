import type { TaskRecord } from '../../shared/domain/tasks';
import type { TaskItem } from '../../shared/view/tasks';

export function toTaskItem(task: TaskRecord): TaskItem {
  return {
    id: task.taskId,
    category: task.category,
    feature: task.feature,
    status: task.status,
    time: formatTaskTime(task.updatedAt),
    batchId: task.batchId,
    importCount: task.imports.length,
    outputCount: task.outputs.length,
  };
}

function formatTaskTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
