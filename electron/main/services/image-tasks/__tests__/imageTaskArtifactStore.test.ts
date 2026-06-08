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
    task.request.aspectRatio = '4:3';
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
        instructionSystemPrompt: expect.stringContaining('Feature: Sticker Replication.'),
        instructionStage: { model: 'gpt-5.4-mini', protocol: 'gemini' },
        executionStage: { kind: 'edit', model: 'gemini-2.5-flash-image', protocol: 'gemini' },
        outputAspectRatio: '4:3',
        openaiImageSize: '1536x1024',
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
        },
      ],
      textNotes: ['model note'],
      warnings: ['draft output'],
    });
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
