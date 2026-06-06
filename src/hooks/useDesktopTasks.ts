import { useState, useEffect, useMemo, useCallback } from 'react';
import type { TaskRecord } from '../shared/domain/tasks';
import type { TaskPersistenceClient, RendererTaskService } from '../features/tasks/taskService';
import { createRendererTaskService } from '../features/tasks/taskService';
import type { createDesktopClient } from '../infrastructure/desktop/desktopClient';

const noopClient: TaskPersistenceClient = {
  createTask: async () => {},
  updateTask: async () => {},
  listTasks: async () => [],
};

type DesktopClient = ReturnType<typeof createDesktopClient>;

export function useDesktopTasks(desktop: DesktopClient | undefined) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);

  const persistenceClient: TaskPersistenceClient = desktop?.isAvailable()
    ? desktop
    : noopClient;

  const taskService: RendererTaskService = useMemo(() => {
    const base = createRendererTaskService(persistenceClient);
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
  }, [persistenceClient]);

  const refresh = useCallback(() => {
    if (desktop?.isAvailable()) {
      desktop.listTasks().then(setTasks).catch(console.error);
    }
  }, [desktop]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!desktop?.isAvailable()) return;

    const unsubscribe = desktop.imageTask.onStatus(() => {
      refresh();
    });

    return unsubscribe;
  }, [desktop, refresh]);

  return { tasks, taskService, refresh };
}
