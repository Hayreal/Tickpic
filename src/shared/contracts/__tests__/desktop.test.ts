import { describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '../desktop';

describe('desktop contract', () => {
  it('centralizes IPC channel names used by preload and main process', () => {
    expect(IPC_CHANNELS).toEqual({
      storage: {
        saveImportBatch: 'storage:save-import-batch',
        saveTaskOutputs: 'storage:save-task-outputs',
      },
      tasks: {
        list: 'tasks:list',
        create: 'tasks:create',
        update: 'tasks:update',
      },
      settings: {
        get: 'settings:get',
        save: 'settings:save',
      },
      imageTask: {
        submit: 'image-task:submit',
        cancel: 'image-task:cancel',
        get: 'image-task:get',
        status: 'image-task:status',
      },
    });
  });
});
