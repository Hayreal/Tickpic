import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../../src/shared/contracts/desktop.js';
import type { ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ImageTaskControllerOptions } from './imageTaskController.js';
import { createImageTaskController } from './imageTaskController.js';
import { validateImageTaskRequestForMain } from './requestSecurity.js';
import type { TaskRepository } from '../tasks/taskRepository.js';
import { syncImageTaskToProfile } from '../tasks/imageTaskProfileSync.js';

export interface RegisterImageTaskIpcOptions extends ImageTaskControllerOptions {
  authorizedRoots?: string[];
  resolveAuthorizedRoots?: () => string[] | Promise<string[]>;
  taskRepo?: TaskRepository;
}

export function registerImageTaskIpc(options: RegisterImageTaskIpcOptions = {}) {
  const controller = createImageTaskController(options);

  controller.onStatus((task) => {
    if (options.taskRepo) {
      syncImageTaskToProfile(options.taskRepo, task);
    }

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.imageTask.status, task);
    }
  });

  ipcMain.handle(IPC_CHANNELS.imageTask.submit, async (_event, request: ImageTaskRequest) => {
    const authorizedRoots = options.resolveAuthorizedRoots
      ? await Promise.resolve(options.resolveAuthorizedRoots())
      : options.authorizedRoots ?? [];

    await validateImageTaskRequestForMain({
      request,
      authorizedRoots,
    });
    return controller.submit(request);
  });

  ipcMain.handle(IPC_CHANNELS.imageTask.cancel, (_event, taskId: string) => {
    return controller.cancel(taskId);
  });

  ipcMain.handle(IPC_CHANNELS.imageTask.get, (_event, taskId: string) => {
    return controller.get(taskId);
  });
}
