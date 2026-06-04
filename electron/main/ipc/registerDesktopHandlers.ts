import { registerImportStorageIpc, registerOutputStorageIpc } from '../services/storage/storageIpc.js';
import { registerImageTaskIpc } from '../services/image-tasks/imageTaskIpc.js';
import { createSettingsBackedImageTaskExecutor } from '../services/image-tasks/settingsBackedImageTaskExecutor.js';
import { createTaskRepository } from '../services/tasks/taskRepository.js';
import { registerTaskService } from '../services/tasks/taskService.js';
import { registerSettingsService } from '../services/settings/settingsService.js';
import { createFileSettingsStore } from '../services/settings/settingsStore.js';
import type { StoragePaths } from '../types.js';

export function registerDesktopHandlers(paths: StoragePaths) {
  registerImportStorageIpc(paths.importsDir);
  registerOutputStorageIpc(paths.outputsDir);
  const taskRepo = createTaskRepository(paths.tasksFile);
  const settingsStore = createFileSettingsStore(paths.settingsFile, paths.storageBase);
  registerTaskService(taskRepo);
  registerImageTaskIpc({
    maxConcurrency: 5,
    authorizedRoots: [paths.importsDir, paths.outputsDir, paths.storageBase],
    execute: createSettingsBackedImageTaskExecutor(settingsStore),
  });
  registerSettingsService(settingsStore);
}
