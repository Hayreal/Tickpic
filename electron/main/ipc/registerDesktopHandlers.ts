import fs from 'node:fs';
import {
  registerOpenOutputDirectoryIpc,
  registerImportStorageIpc,
  registerOutputStorageIpc,
} from '../services/storage/storageIpc.js';
import { registerImageTaskIpc } from '../services/image-tasks/imageTaskIpc.js';
import { createSettingsBackedImageTaskExecutor } from '../services/image-tasks/settingsBackedImageTaskExecutor.js';
import { createTaskRepository } from '../services/tasks/taskRepository.js';
import { registerTaskService } from '../services/tasks/taskService.js';
import { registerSettingsService } from '../services/settings/settingsService.js';
import { createFileSettingsStore } from '../services/settings/settingsStore.js';
import { resolveWorkspacePaths } from '../services/storage/workspacePaths.js';

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

export function registerDesktopHandlers(bootstrap: BootstrapPaths) {
  const settingsStore = createFileSettingsStore(bootstrap.settingsFile, bootstrap.defaultWorkspaceDir);
  let workspaceDir = readInitialWorkspaceDir(bootstrap.settingsFile, bootstrap.defaultWorkspaceDir);

  function getWorkspacePathsSync() {
    return resolveWorkspacePaths(workspaceDir);
  }

  async function refreshWorkspaceDir() {
    const settings = await settingsStore.load();
    workspaceDir = settings.workspaceDir;
  }

  void refreshWorkspaceDir();

  const taskRepo = createTaskRepository(() => getWorkspacePathsSync().tasksFile);

  registerImportStorageIpc(() => getWorkspacePathsSync().importsDir);
  registerOutputStorageIpc(() => getWorkspacePathsSync().outputsDir);
  registerOpenOutputDirectoryIpc(() => {
    const paths = getWorkspacePathsSync();
    return [paths.root, paths.importsDir, paths.outputsDir];
  });
  registerTaskService(taskRepo);
  registerImageTaskIpc({
    maxConcurrency: 1,
    resolveAuthorizedRoots: () => {
      const paths = getWorkspacePathsSync();
      return [paths.root, paths.importsDir, paths.outputsDir];
    },
    taskRepo,
    execute: createSettingsBackedImageTaskExecutor(settingsStore),
  });
  registerSettingsService(settingsStore, {
    onSettingsSaved: refreshWorkspaceDir,
  });
}
