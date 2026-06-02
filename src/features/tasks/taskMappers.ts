import type { TaskRecord } from '../../shared/domain/tasks';
import type { TaskItem } from '../../shared/view/tasks';

export function toTaskItem(task: TaskRecord): TaskItem {
  return {
    id: task.taskId,
    category: task.category,
    feature: task.feature,
    status: task.status,
    time: task.updatedAt,
    batchId: task.batchId,
    importCount: task.imports.length,
    outputCount: task.outputs.length,
  };
}
