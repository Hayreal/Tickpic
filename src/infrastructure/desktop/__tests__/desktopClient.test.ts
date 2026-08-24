import { describe, expect, it } from 'vitest';
import { createDesktopClient } from '../desktopClient';
import type { DesktopBridgeApi } from '../../../shared/contracts/desktop';

describe('desktopClient', () => {
  it('returns undefined when the desktop bridge is unavailable', () => {
    const client = createDesktopClient(undefined);
    expect(client.isAvailable()).toBe(false);
  });

  it('delegates image task operations through the desktop bridge', async () => {
    const calls: string[] = [];
    const bridge: DesktopBridgeApi = {
      platform: 'darwin',
      saveImportBatch: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['saveImportBatch'],
      saveTaskOutputs: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['saveTaskOutputs'],
      openOutputDirectory: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['openOutputDirectory'],
      copyImageToClipboard: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['copyImageToClipboard'],
      openLocalImage: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['openLocalImage'],
      createTask: () => Promise.resolve(),
      updateTask: () => Promise.resolve(),
      listTasks: () => Promise.resolve([]),
      settings: {
        get: async () => {
          throw new Error('not used');
        },
        save: async () => {
          throw new Error('not used');
        },
        testConnection: async () => {
          throw new Error('not used');
        },
        pickWorkspaceDir: async () => null,
      },
      imageTask: {
        submit: async (request) => {
          calls.push(`submit:${request.feature}`);
          return { taskId: 'task-1', feature: request.feature, status: 'queued' };
        },
        cancel: async (taskId) => {
          calls.push(`cancel:${taskId}`);
          return {
            taskId,
            feature: 'remove_product',
            status: 'canceled',
            request: {
              feature: 'remove_product',
              images: [{ role: 'source', path: '/authorized/input/scene.png' }],
            },
            images: [],
            createdAt: '2026-06-04T00:00:00.000Z',
            updatedAt: '2026-06-04T00:00:01.000Z',
          };
        },
        get: async (taskId) => {
          calls.push(`get:${taskId}`);
          return undefined;
        },
        onStatus: () => () => undefined,
      },
      logs: {
        list: async () => [],
        onEntry: () => () => undefined,
      },
      resources: {
        listHandheldReferences: async () => [],
      },
    };

    const client = createDesktopClient(bridge);
    const submitted = await client.imageTask.submit({
      feature: 'remove_product',
      images: [{ role: 'source', path: '/authorized/input/scene.png' }],
    });
    await client.imageTask.get(submitted.taskId);
    await client.imageTask.cancel(submitted.taskId);

    expect(calls).toEqual([
      'submit:remove_product',
      'get:task-1',
      'cancel:task-1',
    ]);
  });

  it('delegates image copy through the desktop bridge', async () => {
    const calls: string[] = [];
    const bridge: DesktopBridgeApi = {
      platform: 'darwin',
      saveImportBatch: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['saveImportBatch'],
      saveTaskOutputs: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['saveTaskOutputs'],
      openOutputDirectory: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['openOutputDirectory'],
      copyImageToClipboard: async (request) => {
        calls.push(`copy:${request.filePath}`);
        return { copied: true };
      },
      openLocalImage: async (request) => {
        calls.push(`preview:${request.filePath}`);
        return { opened: true };
      },
      createTask: () => Promise.resolve(),
      updateTask: () => Promise.resolve(),
      listTasks: () => Promise.resolve([]),
      settings: {
        get: async () => {
          throw new Error('not used');
        },
        save: async () => {
          throw new Error('not used');
        },
        testConnection: async () => {
          throw new Error('not used');
        },
        pickWorkspaceDir: async () => null,
      },
      imageTask: {
        submit: async (request) => ({ taskId: 'task-1', feature: request.feature, status: 'queued' }),
        cancel: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['imageTask']['cancel'],
        get: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['imageTask']['get'],
        onStatus: () => () => undefined,
      },
      logs: {
        list: async () => [],
        onEntry: () => () => undefined,
      },
      resources: {
        listHandheldReferences: async () => [],
      },
    };

    const client = createDesktopClient(bridge);
    await client.copyImageToClipboard({ filePath: '/authorized/output/result.png' });
    await client.openLocalImage({ filePath: '/authorized/output/result.png' });

    expect(calls).toEqual([
      'copy:/authorized/output/result.png',
      'preview:/authorized/output/result.png',
    ]);
  });

  it('delegates settings operations through the desktop bridge', async () => {
    const calls: string[] = [];
    const bridge: DesktopBridgeApi = {
      platform: 'darwin',
      saveImportBatch: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['saveImportBatch'],
      saveTaskOutputs: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['saveTaskOutputs'],
      openOutputDirectory: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['openOutputDirectory'],
      copyImageToClipboard: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['copyImageToClipboard'],
      openLocalImage: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['openLocalImage'],
      createTask: () => Promise.resolve(),
      updateTask: () => Promise.resolve(),
      listTasks: () => Promise.resolve([]),
      settings: {
        get: async () => {
          calls.push('settings:get');
          return {
            schemaVersion: 1,
            baseUrl: 'https://api.n1n.ai',
            workspaceDir: '/tmp/tickpic-workspace',
            defaultModels: {
              vision: 'gemini-3.1-flash-lite',
              generation: 'gemini-2.5-flash-image',
            },
            defaultCount: 4,
            maxCount: 4,
            maxConcurrentTasks: 5,
            hasApiKey: false,
          };
        },
        save: async (settings) => {
          calls.push(`settings:save:${settings.baseUrl}`);
        },
        testConnection: async () => {
          calls.push('settings:testConnection');
          return { success: true, message: '连接成功' };
        },
        pickWorkspaceDir: async () => {
          calls.push('settings:pickWorkspaceDir');
          return '/tmp/tickpic-workspace';
        },
      },
      imageTask: {
        submit: async (request) => ({ taskId: 'task-1', feature: request.feature, status: 'queued' }),
        cancel: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['imageTask']['cancel'],
        get: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['imageTask']['get'],
        onStatus: () => () => undefined,
      },
      logs: {
        list: async () => [],
        onEntry: () => () => undefined,
      },
      resources: {
        listHandheldReferences: async () => [],
      },
    };

    const client = createDesktopClient(bridge);
    const settings = await client.settings.get();
    await client.settings.save({
      ...settings,
      n1nApiKey: 'sk-live-secret-value',
    });

    expect(calls).toEqual([
      'settings:get',
      'settings:save:https://api.n1n.ai',
    ]);
  });
});
