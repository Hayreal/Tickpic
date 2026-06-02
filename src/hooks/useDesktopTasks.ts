import { useState, useEffect, useMemo, useCallback } from 'react';
import type { TaskRecord } from '../shared/domain/tasks';
import type { TaskPersistenceClient, RendererTaskService } from '../features/tasks/taskService';
import { createRendererTaskService } from '../features/tasks/taskService';

const noopClient: TaskPersistenceClient = {
  createTask: async () => {},
  updateTask: async () => {},
  listTasks: async () => [],
};

export function useDesktopTasks(desktop: TaskPersistenceClient | undefined) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);

  const taskService: RendererTaskService = useMemo(() => {
    const base = createRendererTaskService(desktop ?? noopClient);
    return {
      async createTask(input) {
        const task = await base.createTask(input);
        setTasks((prev) => [task, ...prev]);
        return task;
      },
      async startTask(task: TaskRecord) {
        const next = await base.startTask(task);
        setTasks((prev) => prev.map((t) => (t.taskId === next.taskId ? next : t)));
        return next;
      },
      async completeTask(task: TaskRecord, outputs) {
        const next = await base.completeTask(task, outputs);
        setTasks((prev) => prev.map((t) => (t.taskId === next.taskId ? next : t)));
        return next;
      },
      async failTask(task: TaskRecord) {
        const next = await base.failTask(task);
        setTasks((prev) => prev.map((t) => (t.taskId === next.taskId ? next : t)));
        return next;
      },
      async updateTask(task: TaskRecord) {
        const next = await base.updateTask(task);
        setTasks((prev) => prev.map((t) => (t.taskId === next.taskId ? next : t)));
        return next;
      },
    };
  }, [desktop]);

  useEffect(() => {
    if (desktop) {
      desktop.listTasks().then(setTasks).catch(console.error);
    }
  }, [desktop]);

  const refresh = useCallback(() => {
    if (desktop) {
      desktop.listTasks().then(setTasks).catch(console.error);
    }
  }, [desktop]);

  return { tasks, taskService, refresh };
}
