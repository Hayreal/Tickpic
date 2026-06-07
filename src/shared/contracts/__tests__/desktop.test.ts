import { describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '../desktop';

describe('desktop contract', () => {
  it('centralizes IPC channel names used by preload and main process', () => {
    expect(IPC_CHANNELS).toEqual({
      storage: {
        saveImportBatch: 'storage:save-import-batch',
        saveTaskOutputs: 'storage:save-task-outputs',
        openOutputDirectory: 'storage:open-output-directory',
      },
      tasks: {
        list: 'tasks:list',
        create: 'tasks:create',
        update: 'tasks:update',
      },
      settings: {
        get: 'settings:get',
        save: 'settings:save',
        testConnection: 'settings:test-connection',
        pickWorkspaceDir: 'settings:pick-workspace-dir',
      },
      imageTask: {
        submit: 'image-task:submit',
        cancel: 'image-task:cancel',
        get: 'image-task:get',
        status: 'image-task:status',
      },
      appLog: {
        list: 'app-log:list',
        entry: 'app-log:entry',
      },
    });
  });
});
