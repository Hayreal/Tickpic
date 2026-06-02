import type { StoredImageRecord } from './images.js';

export type TaskStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';

export interface TaskRecord {
  taskId: string;
  batchId: string;
  category: string;
  feature: string;
  status: TaskStatus;
  imports: StoredImageRecord[];
  outputs: StoredImageRecord[];
  createdAt: string;
  updatedAt: string;
}
