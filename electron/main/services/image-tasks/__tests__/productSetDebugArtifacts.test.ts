import { describe, expect, it } from 'vitest';
import {
  resolveArtifactFilePrefix,
  writeProductSetDebugArtifacts,
} from '../productSetDebugArtifacts';
import type { ImageTaskRecord } from '../../../../../src/shared/domain/imageFeatureApi';
import type { ImageTaskPlan } from '../../../../../src/shared/domain/imageTaskPlan';
import { mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('productSetDebugArtifacts', () => {
  it('writes a manifest and per-output execution prompt files', async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), 'tickpic-debug-'));
    const task = createTask();
    const plan = createPlan();
    const requestJsonPath = path.join(outputDir, 'request.json');
    const imageInstructionPath = path.join(outputDir, 'image-instruction.txt');
    const outputJsonPath = path.join(outputDir, 'result-1.json');

    const { manifestPath, manifest } = await writeProductSetDebugArtifacts({
      outputDir,
      filePrefix: '',
      task,
      plan,
      visionResult: {
        visionModel: 'gpt-5.4-mini',
        rawContent: '{"instructions":[{"index":1,"variant_directive":"scene-a"},{"index":2,"variant_directive":"scene-b"}]}',
        batch: {
          instructions: [
            { index: 1, variant_directive: 'scene-a' },
            { index: 2, variant_directive: 'scene-b' },
          ],
        },
        executionPrompts: ['prompt-1', 'prompt-2'],
      },
      requestJsonPath,
      imageInstructionPath,
      outputJsonPath,
    });

    expect(manifest.count).toBe(2);
    expect(manifest.featureLabel).toBe('主图');
    expect(manifest.files.executionPrompts).toHaveLength(2);
    expect(await readFile(path.join(outputDir, 'execution-prompt-1.txt'), 'utf-8')).toBe('prompt-1');
    expect(await readFile(path.join(outputDir, 'vision-batch.json'), 'utf-8')).toContain('scene-a');
    expect(await readFile(manifestPath, 'utf-8')).toContain('howToReport');
    expect(manifest.outputs[0]?.visionInstruction.variant_directive).toBe('scene-a');
  });

  it('prefixes debug files when task belongs to a batch', () => {
    expect(resolveArtifactFilePrefix({
      taskId: 'img_task_1',
      request: { feature: 'product_main_image', outputBatchId: 'batch-abc' },
    } as ImageTaskRecord)).toBe('img_task_1-');
  });
});

function createTask(): ImageTaskRecord {
  return {
    taskId: 'img_task_1',
    feature: 'product_main_image',
    status: 'running',
    request: {
      feature: 'product_main_image',
      count: 2,
      images: [{ role: 'product', path: '/authorized/input/product.png' }],
    },
    images: [],
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T00:00:00.000Z',
  };
}

function createPlan(): ImageTaskPlan {
  return {
    request: createTask().request,
    mainPrompt: 'main',
    executionStage: {
      kind: 'edit',
      model: 'gemini-2.5-flash-image',
      protocol: 'gemini',
    },
    executionImages: [{ role: 'product', path: '/authorized/input/product.png' }],
    count: 2,
  };
}
