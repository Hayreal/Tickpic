import fs from 'node:fs';
import {
  registerOpenOutputDirectoryIpc,
  registerCopyImageToClipboardIpc,
  registerOpenLocalImageIpc,
  registerImportStorageIpc,
  registerOutputStorageIpc,
} from '../services/storage/storageIpc.js';
import { registerImageTaskIpc } from '../services/image-tasks/imageTaskIpc.js';
import { createSettingsBackedImageTaskExecutor } from '../services/image-tasks/settingsBackedImageTaskExecutor.js';
import { createTaskRepository } from '../services/tasks/taskRepository.js';
import { reconcileOrphanedProfileTasks } from '../services/tasks/reconcileOrphanedTasks.js';
import { registerTaskService } from '../services/tasks/taskService.js';
import { registerSettingsService } from '../services/settings/settingsService.js';
import { createFileSettingsStore } from '../services/settings/settingsStore.js';
import { DEFAULT_CONCURRENT_TASKS, MAX_CONCURRENT_TASKS } from '../../../src/shared/domain/settings.js';
import { resolveWorkspacePaths } from '../services/storage/workspacePaths.js';
import { registerAppLogIpc } from '../services/logger/appLogIpc.js';
import { getAppLogger } from '../services/logger/appLogger.js';
import { registerProductResourcesIpc } from '../services/resources/productResourcesIpc.js';
import { resolveAppResourcesDir } from '../services/resources/productResources.js';

export interface BootstrapPaths {
  settingsFile: string;
  defaultWorkspaceDir: string;
}

function readInitialSettingsFile(
  settingsFile: string,
  defaultWorkspaceDir: string,
): { workspaceDir: string; maxConcurrentTasks: number } {
  try {
    const payload = JSON.parse(fs.readFileSync(settingsFile, 'utf-8')) as {
      workspaceDir?: string;
      maxConcurrentTasks?: number;
    };
    const workspaceDir = payload.workspaceDir?.trim() || defaultWorkspaceDir;
    const maxConcurrentTasks = Number.isInteger(payload.maxConcurrentTasks) && (payload.maxConcurrentTasks ?? 0) > 0
      ? Math.min(payload.maxConcurrentTasks as number, MAX_CONCURRENT_TASKS)
      : DEFAULT_CONCURRENT_TASKS;
    return { workspaceDir, maxConcurrentTasks };
  } catch {
    return { workspaceDir: defaultWorkspaceDir, maxConcurrentTasks: DEFAULT_CONCURRENT_TASKS };
  }
}

export interface DesktopHandlersRegistration {
  shutdownActiveTasks: (message: string) => void;
  resolveAuthorizedRoots: () => string[];
}

export function registerDesktopHandlers(bootstrap: BootstrapPaths): DesktopHandlersRegistration {
  const logger = getAppLogger();
  registerAppLogIpc(logger);
  registerProductResourcesIpc();

  const settingsStore = createFileSettingsStore(bootstrap.settingsFile, bootstrap.defaultWorkspaceDir);
  const initial = readInitialSettingsFile(bootstrap.settingsFile, bootstrap.defaultWorkspaceDir);
  let workspaceDir = initial.workspaceDir;
  let maxConcurrentTasks = initial.maxConcurrentTasks;

  logger.info('app', '桌面服务初始化', {
    settingsFile: bootstrap.settingsFile,
    workspaceDir,
  });

  function getWorkspacePathsSync() {
    return resolveWorkspacePaths(workspaceDir);
  }

  function resolveAuthorizedRoots() {
    const paths = getWorkspacePathsSync();
    return [paths.root, paths.importsDir, paths.outputsDir, resolveAppResourcesDir()];
  }

  async function refreshWorkspaceDir() {
    const settings = await settingsStore.load();
    workspaceDir = settings.workspaceDir;
    maxConcurrentTasks = settings.maxConcurrentTasks;
    logger.info('settings', '工作目录已刷新', { workspaceDir, maxConcurrentTasks });
  }

  const taskRepo = createTaskRepository(() => getWorkspacePathsSync().tasksFile);
  reconcileOrphanedProfileTasks(taskRepo);

  registerImportStorageIpc(() => getWorkspacePathsSync().importsDir);
  registerOutputStorageIpc(() => getWorkspacePathsSync().outputsDir);
  registerOpenOutputDirectoryIpc(resolveAuthorizedRoots);
  registerCopyImageToClipboardIpc(resolveAuthorizedRoots);
  registerOpenLocalImageIpc(resolveAuthorizedRoots);
  registerTaskService(taskRepo);
  const imageTaskIpc = registerImageTaskIpc({
    maxConcurrency: maxConcurrentTasks,
    resolveAuthorizedRoots,
    taskRepo,
    execute: createSettingsBackedImageTaskExecutor(settingsStore),
  });
  registerSettingsService(settingsStore, {
    onSettingsSaved: async () => {
      await refreshWorkspaceDir();
      imageTaskIpc.controller.setMaxConcurrency(maxConcurrentTasks);
    },
  });
  void refreshWorkspaceDir().then(() => {
    imageTaskIpc.controller.setMaxConcurrency(maxConcurrentTasks);
  });

  logger.info('app', '桌面 IPC 处理器注册完成');

  return {
    shutdownActiveTasks: imageTaskIpc.shutdownActiveTasks,
    resolveAuthorizedRoots,
  };
}
