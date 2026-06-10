import type { TaskStatus } from '../domain/tasks.js';

export interface TaskItem {
  id: string;
  category: string;
  feature: string;
  status: TaskStatus;
  time: string;
  batchId?: string;
  outputBatchId?: string;
  importCount?: number;
  outputCount?: number;
}

export interface TaskListItem extends TaskItem {
  kind: 'single' | 'batch';
  subTaskCount: number;
  taskIds: string[];
}
