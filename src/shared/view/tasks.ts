import type { TaskStatus } from '../domain/tasks.js';

export interface TaskItem {
  id: string;
  category: string;
  feature: string;
  status: TaskStatus;
  time: string;
  batchId?: string;
  importCount?: number;
  outputCount?: number;
}
