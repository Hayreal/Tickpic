import { createRuntimeConfigFromSettings } from '../../../../src/shared/domain/settings.js';
import type { SettingsStore } from '../settings/settingsStore.js';
import { createFileImageTaskArtifactStore } from './imageTaskArtifactStore.js';
import { createImageTaskExecutor, type ImageTaskModelGateway } from './imageTaskExecutor.js';
import type { ImageTaskExecutor } from './imageTaskController.js';
import { createModelGatewayFromSettings } from './modelGatewayFactory.js';
import { getAppLogger } from '../logger/appLogger.js';

export function createSettingsBackedImageTaskExecutor(
  settingsStore: SettingsStore,
  modelGatewayFactory: (settings: Awaited<ReturnType<SettingsStore['load']>>) => ImageTaskModelGateway = createModelGatewayFromSettings,
): ImageTaskExecutor {
  return async (task, abortSignal, onProgress) => {
    const settings = await settingsStore.load();
    getAppLogger().info('image-task', '已加载任务执行配置', {
      taskId: task.taskId,
      workspaceDir: settings.workspaceDir,
      baseUrl: settings.baseUrl,
    });
    const executor = createImageTaskExecutor({
      runtimeConfig: createRuntimeConfigFromSettings(settings),
      modelGateway: modelGatewayFactory(settings),
      artifactStore: createFileImageTaskArtifactStore(settings.workspaceDir),
    });

    return executor(task, abortSignal, onProgress);
  };
}
