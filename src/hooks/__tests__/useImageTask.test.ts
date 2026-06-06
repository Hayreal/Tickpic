import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ImageTaskRecord } from '../../shared/domain/imageFeatureApi';
import type { DesktopBridgeApi } from '../../shared/contracts/desktop';
import { createDesktopClient } from '../../infrastructure/desktop/desktopClient';

const runningTask: ImageTaskRecord = {
  taskId: 'task-1',
  feature: 'sticker_replica',
  status: 'running',
  request: {
    feature: 'sticker_replica',
    images: [{ role: 'source', path: '/data/imports/sticker/copy/batch/img.png' }],
  },
  images: [],
  createdAt: '2026-06-06T00:00:00.000Z',
  updatedAt: '2026-06-06T00:00:01.000Z',
};

function createMockBridge(): DesktopBridgeApi {
  const listeners = new Set<(task: ImageTaskRecord) => void>();

  return {
    platform: 'linux',
    saveImportBatch: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['saveImportBatch'],
    saveTaskOutputs: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['saveTaskOutputs'],
    openOutputDirectory: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['openOutputDirectory'],
    createTask: async () => undefined,
    updateTask: async () => undefined,
    listTasks: async () => [],
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
        listeners.forEach((listener) => listener(runningTask));
        return { taskId: 'task-1', feature: request.feature, status: 'queued' };
      },
      cancel: async () => runningTask,
      get: async () => runningTask,
      onStatus: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  };
}

vi.mock('../useDesktopClient', () => ({
  useDesktopClient: () => createDesktopClient(createMockBridge()),
}));

describe('useImageTask', () => {
  it('hydrates active task after submit even when status events fire before subscription', async () => {
    const { useImageTask } = await import('../useImageTask');
    const { result } = renderHook(() => useImageTask());

    await act(async () => {
      await result.current.submit({
        feature: 'sticker_replica',
        images: [{ role: 'source', path: '/data/imports/sticker/copy/batch/img.png' }],
      });
    });

    await waitFor(() => {
      expect(result.current.activeTask?.status).toBe('running');
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('rejects blob image paths before submitting', async () => {
    const { useImageTask } = await import('../useImageTask');
    const { result } = renderHook(() => useImageTask());

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.submit({
          feature: 'sticker_replica',
          images: [{ role: 'source', path: 'blob:http://127.0.0.1:3000/abc' }],
        });
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('图片尚未保存到本地');
    await waitFor(() => {
      expect(result.current.error).toContain('图片尚未保存到本地');
    });
    expect(result.current.isSubmitting).toBe(false);
  });
});
