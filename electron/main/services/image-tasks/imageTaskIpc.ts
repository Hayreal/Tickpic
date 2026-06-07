import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../../src/shared/contracts/desktop.js';
import type { ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ImageTaskControllerOptions } from './imageTaskController.js';
import { createImageTaskController } from './imageTaskController.js';
import { validateImageTaskRequestForMain } from './requestSecurity.js';
import type { TaskRepository } from '../tasks/taskRepository.js';
import { syncImageTaskToProfile } from '../tasks/imageTaskProfileSync.js';
import { getAppLogger } from '../logger/appLogger.js';

export interface RegisterImageTaskIpcOptions extends ImageTaskControllerOptions {
  authorizedRoots?: string[];
  resolveAuthorizedRoots?: () => string[] | Promise<string[]>;
  taskRepo?: TaskRepository;
}

export interface ImageTaskIpcRegistration {
  controller: ReturnType<typeof createImageTaskController>;
  shutdownActiveTasks: (message: string) => void;
}

export function registerImageTaskIpc(options: RegisterImageTaskIpcOptions = {}): ImageTaskIpcRegistration {
  const logger = getAppLogger();
  const controller = createImageTaskController(options);
  const lastLoggedStatus = new Map<string, string>();

  controller.onStatus((task) => {
    const previousStatus = lastLoggedStatus.get(task.taskId);
    if (previousStatus !== task.status) {
      lastLoggedStatus.set(task.taskId, task.status);
      logger.info('image-task', `任务状态变更: ${task.status}`, {
        taskId: task.taskId,
        feature: task.feature,
        progress: task.progress,
        error: task.error,
      });
    }

    if (options.taskRepo) {
      syncImageTaskToProfile(options.taskRepo, task);
    }

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.imageTask.status, task);
    }
  });

  ipcMain.handle(IPC_CHANNELS.imageTask.submit, async (_event, request: ImageTaskRequest) => {
    logger.info('image-task', '收到图片任务提交', {
      feature: request.feature,
      imageCount: request.images?.length ?? 0,
      count: request.count,
    });

    const authorizedRoots = options.resolveAuthorizedRoots
      ? await Promise.resolve(options.resolveAuthorizedRoots())
      : options.authorizedRoots ?? [];

    await validateImageTaskRequestForMain({
      request,
      authorizedRoots,
    });
    const result = controller.submit(request);
    logger.info('image-task', '图片任务已入队', result);
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.imageTask.cancel, (_event, taskId: string) => {
    logger.info('image-task', '收到取消请求', { taskId });
    return controller.cancel(taskId);
  });

  ipcMain.handle(IPC_CHANNELS.imageTask.get, (_event, taskId: string) => {
    return controller.get(taskId);
  });

  return {
    controller,
    shutdownActiveTasks: (message: string) => {
      logger.warn('image-task', '关闭时终止活动任务', { message });
      controller.failAllActive(message);
    },
  };
}
