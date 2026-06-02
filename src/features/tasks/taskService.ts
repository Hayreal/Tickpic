import type { TaskRecord } from '../../shared/domain/tasks';
import type { StoredImageRecord } from '../../shared/domain/images';
import { createPendingTask, startTask, completeTask, failTask } from '../../lib/taskState';

export interface TaskPersistenceClient {
  createTask(record: TaskRecord): Promise<void>;
  updateTask(record: TaskRecord): Promise<void>;
  listTasks(): Promise<TaskRecord[]>;
}

export type RendererTaskService = ReturnType<typeof createRendererTaskService>;

export function createRendererTaskService(desktop: TaskPersistenceClient) {
  return {
    async createTask(input: {
      category: string;
      feature: string;
      batchId: string;
      imports: StoredImageRecord[];
    }) {
      const task = createPendingTask(input);
      await desktop.createTask(task);
      return task;
    },

    async startTask(task: TaskRecord) {
      const next = startTask(task);
      await desktop.updateTask(next);
      return next;
    },

    async completeTask(task: TaskRecord, outputs: StoredImageRecord[]) {
      const next = completeTask(task, outputs);
      await desktop.updateTask(next);
      return next;
    },

    async failTask(task: TaskRecord) {
      const next = failTask(task);
      await desktop.updateTask(next);
      return next;
    },

    async updateTask(task: TaskRecord) {
      await desktop.updateTask(task);
      return task;
    },
  };
}
