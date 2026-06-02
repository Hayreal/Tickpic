import { ipcMain } from 'electron';
import type { TaskRepository } from './taskRepository.js';

export function registerTaskService(repo: TaskRepository) {
  ipcMain.handle('tasks:list', () => {
    return repo.list();
  });

  ipcMain.handle('tasks:create', (_event, record: Record<string, unknown>) => {
    repo.create(record);
  });

  ipcMain.handle('tasks:update', (_event, record: Record<string, unknown>) => {
    repo.update(record);
  });
}
