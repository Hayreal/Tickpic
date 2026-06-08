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
import { resolveWorkspacePaths } from '../services/storage/workspacePaths.js';
import { registerAppLogIpc } from '../services/logger/appLogIpc.js';
import { getAppLogger } from '../services/logger/appLogger.js';

export interface BootstrapPaths {
  settingsFile: string;
  defaultWorkspaceDir: string;
}

function readInitialWorkspaceDir(settingsFile: string, defaultWorkspaceDir: string) {
  try {
    const payload = JSON.parse(fs.readFileSync(settingsFile, 'utf-8')) as { workspaceDir?: string };
    if (payload.workspaceDir?.trim()) {
      return payload.workspaceDir;
    }
  } catch {
    // fall through to default workspace
  }
  return defaultWorkspaceDir;
}

export interface DesktopHandlersRegistration {
  shutdownActiveTasks: (message: string) => void;
  resolveAuthorizedRoots: () => string[];
}

export function registerDesktopHandlers(bootstrap: BootstrapPaths): DesktopHandlersRegistration {
  const logger = getAppLogger();
  registerAppLogIpc(logger);

  const settingsStore = createFileSettingsStore(bootstrap.settingsFile, bootstrap.defaultWorkspaceDir);
  let workspaceDir = readInitialWorkspaceDir(bootstrap.settingsFile, bootstrap.defaultWorkspaceDir);

  logger.info('app', '桌面服务初始化', {
    settingsFile: bootstrap.settingsFile,
    workspaceDir,
  });

  function getWorkspacePathsSync() {
    return resolveWorkspacePaths(workspaceDir);
  }

  function resolveAuthorizedRoots() {
    const paths = getWorkspacePathsSync();
    return [paths.root, paths.importsDir, paths.outputsDir];
  }

  async function refreshWorkspaceDir() {
    const settings = await settingsStore.load();
    workspaceDir = settings.workspaceDir;
    logger.info('settings', '工作目录已刷新', { workspaceDir });
  }

  void refreshWorkspaceDir();

  const taskRepo = createTaskRepository(() => getWorkspacePathsSync().tasksFile);
  reconcileOrphanedProfileTasks(taskRepo);

  registerImportStorageIpc(() => getWorkspacePathsSync().importsDir);
  registerOutputStorageIpc(() => getWorkspacePathsSync().outputsDir);
  registerOpenOutputDirectoryIpc(resolveAuthorizedRoots);
  registerCopyImageToClipboardIpc(resolveAuthorizedRoots);
  registerOpenLocalImageIpc(resolveAuthorizedRoots);
  registerTaskService(taskRepo);
  const imageTaskIpc = registerImageTaskIpc({
    maxConcurrency: 1,
    resolveAuthorizedRoots,
    taskRepo,
    execute: createSettingsBackedImageTaskExecutor(settingsStore),
  });
  registerSettingsService(settingsStore, {
    onSettingsSaved: refreshWorkspaceDir,
  });

  logger.info('app', '桌面 IPC 处理器注册完成');

  return {
    shutdownActiveTasks: imageTaskIpc.shutdownActiveTasks,
    resolveAuthorizedRoots,
  };
}
