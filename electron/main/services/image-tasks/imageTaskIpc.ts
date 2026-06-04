import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../../src/shared/contracts/desktop.js';
import type { ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ImageTaskControllerOptions } from './imageTaskController.js';
import { createImageTaskController } from './imageTaskController.js';
import { validateImageTaskRequestForMain } from './requestSecurity.js';

export interface RegisterImageTaskIpcOptions extends ImageTaskControllerOptions {
  authorizedRoots?: string[];
}

export function registerImageTaskIpc(options: RegisterImageTaskIpcOptions = {}) {
  const controller = createImageTaskController(options);

  controller.onStatus((task) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.imageTask.status, task);
    }
  });

  ipcMain.handle(IPC_CHANNELS.imageTask.submit, async (_event, request: ImageTaskRequest) => {
    await validateImageTaskRequestForMain({
      request,
      authorizedRoots: options.authorizedRoots ?? [],
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
