import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../../src/shared/contracts/desktop.js';
import type { TaskRepository } from './taskRepository.js';
import { getAppLogger } from '../logger/appLogger.js';

export function registerTaskService(repo: TaskRepository) {
  const logger = getAppLogger();

  ipcMain.handle(IPC_CHANNELS.tasks.list, () => {
    return repo.list();
  });

  ipcMain.handle(IPC_CHANNELS.tasks.create, (_event, record: Record<string, unknown>) => {
    logger.info('task', '创建任务记录', {
      taskId: record.taskId,
      feature: record.feature,
      status: record.status,
    });
    repo.create(record);
  });

  ipcMain.handle(IPC_CHANNELS.tasks.update, (_event, record: Record<string, unknown>) => {
    logger.info('task', '更新任务记录', {
      taskId: record.taskId,
      feature: record.feature,
      status: record.status,
    });
    repo.update(record);
  });
}
