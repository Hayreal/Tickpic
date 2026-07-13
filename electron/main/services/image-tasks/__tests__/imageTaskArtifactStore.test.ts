import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildImageTaskPlan } from '../../../../../src/shared/domain/imageTaskPlan';
import type { ImageTaskRecord } from '../../../../../src/shared/domain/imageFeatureApi';
import { createFileImageTaskArtifactStore } from '../imageTaskArtifactStore';

describe('imageTaskArtifactStore', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'tickpic-image-task-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('saves request summary, image instruction, output image, and output json', async () => {
    const store = createFileImageTaskArtifactStore(tempDir);
    const task = createTask();
    task.request.aspectRatio = '3:2';
    task.request.outputQuality = '2K';
    const plan = buildImageTaskPlan(task.request, {
      defaultModels: {
        generation: 'gemini-2.5-flash-image',
        vision: 'gpt-5.4-mini',
      },
      modelProtocol: 'gemini',
      defaultCount: 4,
      maxCount: 4,
    });

    const saved = await store.save({
      task,
      plan,
      finalPrompt: 'Create an independent 2D flat sticker design.',
      generated: {
        images: [
          {
            fileName: 'model-output.png',
            buffer: new Uint8Array([137, 80, 78, 71]),
            mimeType: 'image/png',
            width: 2048,
            height: 1360,
          },
        ],
        textNotes: ['model note'],
        warnings: ['draft output'],
      },
    });

    expect(saved.outputDir).toBe(path.join(tempDir, 'outputs', '20260604', 'task-1'));
    expect(saved.images).toEqual([path.join(saved.outputDir, 'result-1.png')]);
    expect(saved.requestJsonPath).toBe(path.join(saved.outputDir, 'request.json'));
    expect(saved.imageInstructionPath).toBe(path.join(saved.outputDir, 'image-instruction.txt'));
    expect(saved.outputJsonPath).toBe(path.join(saved.outputDir, 'result-1.json'));

    const requestJson = JSON.parse(await readFile(saved.requestJsonPath, 'utf-8'));
    expect(requestJson).toMatchObject({
      taskId: 'task-1',
      feature: 'sticker_replica',
      request: {
        feature: 'sticker_replica',
        images: [{ role: 'source', path: '/authorized/input/package.png' }],
      },
      plan: {
        mainPrompt: expect.stringContaining('直角矩形'),
        executionStage: { kind: 'edit', model: 'gemini-2.5-flash-image', protocol: 'gemini' },
        outputAspectRatio: '3:2',
        outputSpec: {
          aspectRatio: '3:2',
          outputQuality: '2K',
          width: 2048,
          height: 1360,
          size: '2048x1360',
        },
        openaiImageSize: '2048x1360',
      },
    });
    expect(await readFile(saved.imageInstructionPath, 'utf-8')).toBe('Create an independent 2D flat sticker design.');
    expect(Array.from(await readFile(saved.images[0]))).toEqual([137, 80, 78, 71]);

    const outputJson = JSON.parse(await readFile(saved.outputJsonPath, 'utf-8'));
    expect(outputJson).toMatchObject({
      taskId: 'task-1',
      feature: 'sticker_replica',
      finalPrompt: 'Create an independent 2D flat sticker design.',
      outputs: [
        {
          path: path.join(saved.outputDir, 'result-1.png'),
          mimeType: 'image/png',
          bytes: 4,
          width: 2048,
          height: 1360,
        },
      ],
      textNotes: ['model note'],
      warnings: ['draft output'],
    });
  });

  it('saves batch tasks into one shared output folder with task-prefixed artifact files', async () => {
    const store = createFileImageTaskArtifactStore(tempDir);
    const batchId = 'batch-shared';
    const plan = buildImageTaskPlan(createTask().request, {
      defaultModels: {
        generation: 'gemini-2.5-flash-image',
        vision: 'gpt-5.4-mini',
      },
      modelProtocol: 'gemini',
      defaultCount: 1,
      maxCount: 4,
    });
    const generated = {
      images: [
        {
          fileName: 'model-output.png',
          buffer: new Uint8Array([137, 80, 78, 71]),
          mimeType: 'image/png',
        },
      ],
    };

    const first = await store.save({
      task: {
        ...createTask(),
        taskId: 'task-1',
        request: {
          ...createTask().request,
          outputBatchId: batchId,
        },
      },
      plan,
      finalPrompt: 'first prompt',
      generated,
    });
    const second = await store.save({
      task: {
        ...createTask(),
        taskId: 'task-2',
        request: {
          ...createTask().request,
          outputBatchId: batchId,
        },
      },
      plan,
      finalPrompt: 'second prompt',
      generated,
    });

    const sharedDir = path.join(tempDir, 'outputs', '20260604', 'batch-batch-shared');
    expect(first.outputDir).toBe(sharedDir);
    expect(second.outputDir).toBe(sharedDir);
    expect(first.images).toEqual([path.join(sharedDir, 'task-1-result-1.png')]);
    expect(second.images).toEqual([path.join(sharedDir, 'task-2-result-1.png')]);
    expect(first.requestJsonPath).toBe(path.join(sharedDir, 'task-1-request.json'));
    expect(second.requestJsonPath).toBe(path.join(sharedDir, 'task-2-request.json'));
  });

  it('persists the resolved sticker variation strategy in the request artifact plan', async () => {
    const store = createFileImageTaskArtifactStore(tempDir);
    const task = {
      ...createTask(),
      feature: 'sticker_variation' as const,
      request: {
        feature: 'sticker_variation' as const,
        colorScheme: 'blue and silver',
        images: [{ role: 'source' as const, path: '/authorized/input/sticker.png' }],
      },
    };
    const plan = buildImageTaskPlan(task.request, {
      defaultModels: { generation: 'gemini-2.5-flash-image', vision: 'gpt-5.4-mini' },
      modelProtocol: 'gemini', defaultCount: 1, maxCount: 4,
    });

    const saved = await store.save({
      task, plan, finalPrompt: 'variation prompt',
      generated: { images: [{ fileName: 'result.png', buffer: new Uint8Array([1]), mimeType: 'image/png' }] },
    });

    const artifact = JSON.parse(await readFile(saved.requestJsonPath, 'utf-8'));
    expect(artifact.plan.resolvedVariationStrategy).toBe('color');
  });
});

function createTask(): ImageTaskRecord {
  return {
    taskId: 'task-1',
    feature: 'sticker_replica',
    status: 'running',
    request: {
      feature: 'sticker_replica',
      images: [{ role: 'source', path: '/authorized/input/package.png' }],
    },
    images: [],
    createdAt: '2026-06-04T09:30:00.000Z',
    updatedAt: '2026-06-04T09:30:00.000Z',
  };
}
