import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

let failOnSubmit: number | undefined;
let pendingSubmitGates: Array<Promise<void>> | undefined;

function createMockBridge(): DesktopBridgeApi {
  const listeners = new Set<(task: ImageTaskRecord) => void>();
  const tasks = new Map<string, ImageTaskRecord>();
  let submitIndex = 0;

  return {
    platform: 'linux',
    saveImportBatch: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['saveImportBatch'],
    saveTaskOutputs: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['saveTaskOutputs'],
    openOutputDirectory: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['openOutputDirectory'],
    copyImageToClipboard: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['copyImageToClipboard'],
    openLocalImage: (() => Promise.reject(new Error('not used'))) as DesktopBridgeApi['openLocalImage'],
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
        submitIndex += 1;
        await pendingSubmitGates?.shift();
        if (submitIndex === failOnSubmit) {
          throw new Error(`submit ${submitIndex} failed`);
        }
        const task = {
          ...runningTask,
          taskId: `task-${submitIndex}`,
          feature: request.feature,
          request,
        };
        tasks.set(task.taskId, task);
        listeners.forEach((listener) => listener(task));
        return { taskId: task.taskId, feature: request.feature, status: 'queued' };
      },
      cancel: async () => runningTask,
      get: async (taskId) => tasks.get(taskId) ?? runningTask,
      onStatus: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    logs: {
      list: async () => [],
      onEntry: () => () => undefined,
    },
  };
}

vi.mock('../useDesktopClient', () => ({
  useDesktopClient: () => createDesktopClient(createMockBridge()),
}));

afterEach(() => {
  failOnSubmit = undefined;
  pendingSubmitGates = undefined;
});

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
      expect(result.current.getTask('sticker_replica')?.status).toBe('running');
    });
    expect(result.current.getTask('sticker_variation')).toBeNull();
    expect(result.current.getTasks('sticker_replica')).toHaveLength(1);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('tracks multiple submitted tasks for the same feature', async () => {
    const { useImageTask } = await import('../useImageTask');
    const { result } = renderHook(() => useImageTask());

    await act(async () => {
      await result.current.submitMany([
        {
          feature: 'sticker_replica',
          images: [{ role: 'source', path: '/data/imports/sticker/copy/batch/1.png' }],
          count: 1,
        },
        {
          feature: 'sticker_replica',
          images: [{ role: 'source', path: '/data/imports/sticker/copy/batch/2.png' }],
          count: 1,
        },
      ]);
    });

    await waitFor(() => {
      expect(result.current.getTasks('sticker_replica')).toHaveLength(2);
    });
    expect(result.current.getTask('sticker_replica')?.taskId).toBe('task-2');
    expect(result.current.isSubmitting).toBe(false);
  });

  it('forces an output batch ID for a single submitted request when requested', async () => {
    const { useImageTask } = await import('../useImageTask');
    const { result } = renderHook(() => useImageTask());

    await act(async () => {
      await result.current.submitMany([
        {
          feature: 'product_main_image',
          images: [{ role: 'product', path: '/data/imports/product/front.png' }],
          count: 1,
        },
      ], { forceOutputBatchId: true });
    });

    expect(result.current.getTask('product_main_image')?.request.outputBatchId).toEqual(expect.any(String));
  });

  it('uses a nonblank option batch ID only for requests without a batch ID', async () => {
    const { useImageTask } = await import('../useImageTask');
    const { result } = renderHook(() => useImageTask());

    await act(async () => {
      await result.current.submitMany([
        { feature: 'product_main_image', images: [{ role: 'product', path: '/data/imports/product/1.png' }], outputBatchId: 'request-batch' },
        { feature: 'product_main_image', images: [{ role: 'product', path: '/data/imports/product/2.png' }], outputBatchId: '   ' },
        { feature: 'product_main_image', images: [{ role: 'product', path: '/data/imports/product/3.png' }] },
      ], { outputBatchId: ' option-batch ' });
    });

    expect(result.current.getTasks('product_main_image').map((task) => task.request.outputBatchId)).toEqual([
      'request-batch',
      'option-batch',
      'option-batch',
    ]);
  });

  it('uses one generated batch ID for requests without one when forced without replacing explicit IDs', async () => {
    const { useImageTask } = await import('../useImageTask');
    const { result } = renderHook(() => useImageTask());

    await act(async () => {
      await result.current.submitMany([
        { feature: 'product_main_image', images: [{ role: 'product', path: '/data/imports/product/1.png' }], outputBatchId: 'request-batch' },
        { feature: 'product_main_image', images: [{ role: 'product', path: '/data/imports/product/2.png' }], outputBatchId: '   ' },
        { feature: 'product_main_image', images: [{ role: 'product', path: '/data/imports/product/3.png' }] },
      ], { outputBatchId: '   ', forceOutputBatchId: true });
    });

    const outputBatchIds = result.current.getTasks('product_main_image').map((task) => task.request.outputBatchId);
    expect(outputBatchIds[0]).toBe('request-batch');
    expect(outputBatchIds[1]).toEqual(expect.any(String));
    expect(outputBatchIds[2]).toBe(outputBatchIds[1]);
  });

  it('keeps isSubmitting true until every concurrent top-level submission finishes', async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    pendingSubmitGates = [
      new Promise<void>((resolve) => { resolveFirst = resolve; }),
      new Promise<void>((resolve) => { resolveSecond = resolve; }),
    ];
    const { useImageTask } = await import('../useImageTask');
    const { result } = renderHook(() => useImageTask());

    let firstSubmission!: Promise<unknown>;
    let secondSubmission!: Promise<unknown>;
    act(() => {
      firstSubmission = result.current.submit({ feature: 'sticker_replica', images: [{ role: 'source', path: '/data/imports/sticker/1.png' }] });
      secondSubmission = result.current.submit({ feature: 'sticker_replica', images: [{ role: 'source', path: '/data/imports/sticker/2.png' }] });
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(true));
    await act(async () => {
      resolveFirst();
      await firstSubmission;
    });
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      resolveSecond();
      await secondSubmission;
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('retains earlier tracked tasks when a later submitMany request fails', async () => {
    failOnSubmit = 2;
    const { useImageTask } = await import('../useImageTask');
    const { result } = renderHook(() => useImageTask());

    await act(async () => {
      await expect(result.current.submitMany([
        { feature: 'product_main_image', images: [{ role: 'product', path: '/data/imports/product/1.png' }], count: 1 },
        { feature: 'product_main_image', images: [{ role: 'product', path: '/data/imports/product/2.png' }], count: 1 },
      ])).rejects.toThrow('submit 2 failed');
    });

    expect(result.current.getTasks('product_main_image')).toHaveLength(1);
    expect(result.current.getTask('product_main_image')?.taskId).toBe('task-1');
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
      expect(result.current.getError('sticker_replica')).toContain('图片尚未保存到本地');
    });
    expect(result.current.isSubmitting).toBe(false);
  });
});
