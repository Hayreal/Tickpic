import fs from 'node:fs';
import path from 'node:path';

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export interface TaskRepository {
  list(): unknown[];
  create(record: Record<string, unknown>): void;
  update(record: Record<string, unknown>): void;
}

export function createTaskRepository(resolveTasksFile: () => string): TaskRepository {
  function readTasks() {
    const tasksFile = resolveTasksFile();
    ensureDir(path.dirname(tasksFile));
    if (!fs.existsSync(tasksFile)) {
      fs.writeFileSync(tasksFile, '[]', 'utf-8');
    }
    return JSON.parse(fs.readFileSync(tasksFile, 'utf-8')) as unknown[];
  }

  function writeTasks(tasks: unknown[]) {
    const tasksFile = resolveTasksFile();
    ensureDir(path.dirname(tasksFile));
    fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2), 'utf-8');
  }

  return {
    list() {
      return readTasks();
    },

    create(record: Record<string, unknown>) {
      const tasks = readTasks();
      tasks.push(record);
      writeTasks(tasks);
    },

    update(record: Record<string, unknown>) {
      const tasks = readTasks() as Record<string, unknown>[];
      const idx = tasks.findIndex((t) => t.taskId === record.taskId);
      if (idx >= 0) {
        tasks[idx] = record;
      } else {
        tasks.push(record);
      }
      writeTasks(tasks);
    },
  };
}
