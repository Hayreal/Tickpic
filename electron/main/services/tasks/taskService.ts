import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../../src/shared/contracts/desktop.js';
import type { TaskRepository } from './taskRepository.js';

export function registerTaskService(repo: TaskRepository) {
  ipcMain.handle(IPC_CHANNELS.tasks.list, () => {
    return repo.list();
  });

  ipcMain.handle(IPC_CHANNELS.tasks.create, (_event, record: Record<string, unknown>) => {
    repo.create(record);
  });

  ipcMain.handle(IPC_CHANNELS.tasks.update, (_event, record: Record<string, unknown>) => {
    repo.update(record);
  });
}
