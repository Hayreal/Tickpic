import { describe, expect, it } from 'vitest';
import { createImageTaskController } from '../imageTaskController';

describe('imageTaskController', () => {
  it('submits a valid image task as queued and returns it through get', () => {
    const controller = createImageTaskController();

    const submitted = controller.submit({
      feature: 'sticker_original',
      productCategory: 'lens cleaner',
      prompt: 'blue white technology label',
      count: 2,
    });

    expect(submitted.status).toBe('queued');

    const task = controller.get(submitted.taskId);
    expect(task).toMatchObject({
      taskId: submitted.taskId,
      feature: 'sticker_original',
      status: 'queued',
    });
    expect(task?.request.count).toBe(2);
  });

  it('cancels a queued task and emits status updates', () => {
    const controller = createImageTaskController();
    const events: string[] = [];
    controller.onStatus((task) => events.push(`${task.taskId}:${task.status}`));

    const submitted = controller.submit({
      feature: 'remove_product',
      images: [{ role: 'source', path: '/authorized/input/scene.png' }],
    });

    const canceled = controller.cancel(submitted.taskId);

    expect(canceled.status).toBe('canceled');
    expect(controller.get(submitted.taskId)?.status).toBe('canceled');
    expect(events).toEqual([
      `${submitted.taskId}:queued`,
      `${submitted.taskId}:canceled`,
    ]);
  });

  it('rejects invalid requests before creating a task id', () => {
    const controller = createImageTaskController();

    expect(() => controller.submit({
      feature: 'replace_product',
      images: [{ role: 'logo', path: '/authorized/input/logo.png' }],
    })).toThrow('replace_product does not accept image role logo');

    expect(controller.list()).toHaveLength(0);
  });

  it('runs queued tasks asynchronously and stores completed results', async () => {
    const release = createDeferred<void>();
    const controller = createImageTaskController({
      execute: async (task) => {
        await release.promise;
        return {
          model: 'gemini-2.5-flash-image',
          protocol: 'gemini',
          outputDir: `/outputs/${task.taskId}`,
          images: [`/outputs/${task.taskId}/result-1.png`],
          requestJsonPath: `/outputs/${task.taskId}/request.json`,
          imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
          outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
          textNotes: ['done'],
          warnings: [],
        };
      },
    });

    const events: string[] = [];
    controller.onStatus((task) => events.push(task.status));

    const submitted = controller.submit({
      feature: 'sticker_original',
      productCategory: 'lens cleaner',
    });

    expect(submitted.status).toBe('queued');
    await waitFor(() => controller.get(submitted.taskId)?.status === 'running');

    release.resolve();
    await waitFor(() => controller.get(submitted.taskId)?.status === 'completed');

    expect(controller.get(submitted.taskId)).toMatchObject({
      status: 'completed',
      model: 'gemini-2.5-flash-image',
      protocol: 'gemini',
      outputDir: `/outputs/${submitted.taskId}`,
      images: [`/outputs/${submitted.taskId}/result-1.png`],
      textNotes: ['done'],
    });
    expect(events).toEqual(['queued', 'running', 'completed']);
  });

  it('does not run more tasks than maxConcurrency', async () => {
    const releases = [createDeferred<void>(), createDeferred<void>(), createDeferred<void>()];
    const started: string[] = [];
    const controller = createImageTaskController({
      maxConcurrency: 2,
      execute: async (task) => {
        const index = started.length;
        started.push(task.taskId);
        await releases[index].promise;
        return {
          model: 'gemini-2.5-flash-image',
          protocol: 'gemini',
          outputDir: `/outputs/${task.taskId}`,
          images: [],
          requestJsonPath: `/outputs/${task.taskId}/request.json`,
          imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
          outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
          warnings: [],
        };
      },
    });

    const first = controller.submit({ feature: 'sticker_original', productCategory: 'one' });
    const second = controller.submit({ feature: 'sticker_original', productCategory: 'two' });
    const third = controller.submit({ feature: 'sticker_original', productCategory: 'three' });

    await waitFor(() => started.length === 2);

    expect(started).toEqual([first.taskId, second.taskId]);
    expect(controller.get(third.taskId)?.status).toBe('queued');

    releases[0].resolve();
    await waitFor(() => started.length === 3);

    expect(started).toEqual([first.taskId, second.taskId, third.taskId]);
  });

  it('marks a task failed when the executor rejects', async () => {
    const controller = createImageTaskController({
      execute: async () => {
        throw new Error('model unavailable');
      },
    });

    const submitted = controller.submit({ feature: 'sticker_original', productCategory: 'lens cleaner' });

    await waitFor(() => controller.get(submitted.taskId)?.status === 'failed');

    expect(controller.get(submitted.taskId)).toMatchObject({
      status: 'failed',
      error: {
        code: 'image_task_failed',
        message: 'model unavailable',
      },
    });
  });

  it('summarizes a Cloudflare HTML 403 instead of exposing the full response page', async () => {
    const controller = createImageTaskController({
      execute: async () => {
        throw Object.assign(new Error('403 <!DOCTYPE html><title>Attention Required!</title> Cloudflare Ray ID: abc123'), {
          status: 403,
        });
      },
    });

    const submitted = controller.submit({ feature: 'sticker_original', productCategory: 'lens cleaner' });

    await waitFor(() => controller.get(submitted.taskId)?.status === 'failed');

    expect(controller.get(submitted.taskId)).toMatchObject({
      status: 'failed',
      error: {
        code: 'image_provider_cloudflare_blocked',
        message: expect.stringContaining('Ray ID: abc123'),
      },
    });
    expect(controller.get(submitted.taskId)?.error?.message).not.toContain('<!DOCTYPE');
  });

  it('emits progressive image updates while a task is running', async () => {
    const release = createDeferred<void>();
    const controller = createImageTaskController({
      execute: async (_task, _signal, onProgress) => {
        onProgress?.({
          images: ['/outputs/task/result-1.png'],
          progress: { completed: 1, total: 4 },
        });
        await release.promise;
        return {
          model: 'gemini-2.5-flash-image',
          protocol: 'gemini',
          outputDir: '/outputs/task',
          images: ['/outputs/task/result-1.png', '/outputs/task/result-2.png'],
          progress: { completed: 2, total: 4 },
          requestJsonPath: '/outputs/task/request.json',
          imageInstructionPath: '/outputs/task/image-instruction.txt',
          outputJsonPath: '/outputs/task/result-1.json',
          warnings: [],
        };
      },
    });

    const snapshots: string[] = [];
    controller.onStatus((task) => {
      if (task.status === 'running') {
        snapshots.push(`${task.images.length}:${task.progress?.completed ?? 0}`);
      }
    });

    const submitted = controller.submit({
      feature: 'sticker_variation',
      images: [{ role: 'source', path: '/authorized/input/sticker.png' }],
      count: 4,
    });

    await waitFor(() => snapshots.length > 0);
    expect(snapshots).toContain('1:1');

    release.resolve();
    await waitFor(() => controller.get(submitted.taskId)?.status === 'completed');
  });

  it('marks queued and running tasks failed on shutdown', () => {
    const controller = createImageTaskController();
    const submitted = controller.submit({
      feature: 'sticker_original',
      productCategory: 'lens cleaner',
    });

    controller.failAllActive('应用关闭，任务已终止');

    expect(controller.get(submitted.taskId)).toMatchObject({
      status: 'failed',
      error: {
        code: 'app_shutdown',
        message: '应用关闭，任务已终止',
      },
    });
  });

  it('aborts a running task when canceled', async () => {
    let aborted = false;
    const controller = createImageTaskController({
      execute: async (_task, signal) => {
        await new Promise<void>((resolve, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
        return {
          model: 'gemini-2.5-flash-image',
          protocol: 'gemini',
          outputDir: '/outputs/task',
          images: [],
          requestJsonPath: '/outputs/task/request.json',
          imageInstructionPath: '/outputs/task/image-instruction.txt',
          outputJsonPath: '/outputs/task/result-1.json',
          warnings: [],
        };
      },
    });

    const submitted = controller.submit({ feature: 'sticker_original', productCategory: 'lens cleaner' });
    await waitFor(() => controller.get(submitted.taskId)?.status === 'running');

    const canceled = controller.cancel(submitted.taskId);

    expect(canceled.status).toBe('canceled');
    await waitFor(() => aborted);
    expect(controller.get(submitted.taskId)?.status).toBe('canceled');
  });
});

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate: () => boolean, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('condition was not met');
}
