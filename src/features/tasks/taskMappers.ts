import type { TaskRecord } from '../../shared/domain/tasks';
import type { TaskItem, TaskListItem } from '../../shared/view/tasks';
import {
  aggregateTaskStatuses,
  sumTaskImports,
  sumTaskOutputs,
  type TaskListGroup,
} from './taskBatchGrouping';

export function toTaskItem(task: TaskRecord): TaskItem {
  return {
    id: task.taskId,
    category: task.category,
    feature: task.feature,
    status: task.status,
    time: formatTaskTime(task.updatedAt),
    batchId: task.batchId,
    outputBatchId: task.request?.outputBatchId,
    importCount: task.imports.length,
    outputCount: task.outputs.length,
  };
}

export function toTaskListItem(group: TaskListGroup): TaskListItem {
  if (group.kind === 'single') {
    const task = group.representative;
    return {
      ...toTaskItem(task),
      kind: 'single',
      subTaskCount: 1,
      taskIds: [task.taskId],
    };
  }

  const representative = group.representative;
  return {
    id: `batch:${group.outputBatchId}`,
    category: representative.category,
    feature: representative.feature,
    status: aggregateTaskStatuses(group.tasks),
    time: formatTaskTime(representative.updatedAt),
    batchId: group.outputBatchId,
    outputBatchId: group.outputBatchId,
    importCount: sumTaskImports(group.tasks),
    outputCount: sumTaskOutputs(group.tasks),
    kind: 'batch',
    subTaskCount: group.tasks.length,
    taskIds: group.tasks.map((task) => task.taskId),
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
