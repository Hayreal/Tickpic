import { registerImportStorageIpc, registerOutputStorageIpc } from '../services/storage/storageIpc.js';
import { createTaskRepository } from '../services/tasks/taskRepository.js';
import { registerTaskService } from '../services/tasks/taskService.js';
import { registerSettingsService } from '../services/settings/settingsService.js';
import type { StoragePaths } from '../types.js';

export function registerDesktopHandlers(paths: StoragePaths) {
  registerImportStorageIpc(paths.importsDir);
  registerOutputStorageIpc(paths.outputsDir);
  const taskRepo = createTaskRepository(paths.tasksFile);
  registerTaskService(taskRepo);
  registerSettingsService();
}
