import { describe, expect, it } from 'vitest';
import { createImageTaskExecutor } from '../imageTaskExecutor';
import type { ImageTaskRecord } from '../../../../../src/shared/domain/imageFeatureApi';
import type { ImageTaskRuntimeConfig } from '../../../../../src/shared/domain/imageTaskPlan';

describe('imageTaskExecutor', () => {
  const runtimeConfig: ImageTaskRuntimeConfig = {
    defaultModels: {
      generation: 'gemini-2.5-flash-image',
      vision: 'gpt-5.4-mini',
    },
    modelProtocol: 'gemini',
    defaultCount: 4,
    maxCount: 8,
  };

  it('runs instruction generation before image execution and returns saved artifact paths', async () => {
    const calls: string[] = [];
    const executor = createImageTaskExecutor({
      runtimeConfig,
      modelGateway: {
        generateInstruction: async ({ plan }) => {
          calls.push(`instruction:${plan.instructionStage.model}:${plan.instructionImages.length}`);
          return 'Replace the source product with the target product and keep lighting natural.';
        },
        executeImage: async ({ plan, finalPrompt }) => {
          calls.push(`execute:${plan.executionStage.model}:${plan.executionImages.length}:${finalPrompt}`);
          return {
            images: [
              {
                fileName: 'result-1.png',
                buffer: new Uint8Array([1, 2, 3]),
                mimeType: 'image/png',
              },
            ],
            textNotes: ['ok'],
            warnings: ['draft output'],
          };
        },
      },
      artifactStore: {
        save: async ({ task, finalPrompt, generated }) => {
          calls.push(`save:${task.taskId}:${finalPrompt}:${generated.images.length}`);
          return {
            outputDir: `/outputs/${task.taskId}`,
            requestJsonPath: `/outputs/${task.taskId}/request.json`,
            imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
            outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
            images: [`/outputs/${task.taskId}/result-1.png`],
          };
        },
      },
    });

    const result = await executor(createTask({
      feature: 'replace_product',
      images: [
        { role: 'source', path: '/authorized/input/scene.png' },
        { role: 'product', path: '/authorized/input/product.png' },
      ],
    }), new AbortController().signal);

    expect(calls).toEqual([
      'instruction:gpt-5.4-mini:2',
      'execute:gemini-2.5-flash-image:2:Replace the source product with the target product and keep lighting natural.',
      'save:task-1:Replace the source product with the target product and keep lighting natural.:1',
    ]);
    expect(result).toEqual({
      model: 'gemini-2.5-flash-image',
      protocol: 'gemini',
      outputDir: '/outputs/task-1',
      images: ['/outputs/task-1/result-1.png'],
      requestJsonPath: '/outputs/task-1/request.json',
      imageInstructionPath: '/outputs/task-1/image-instruction.txt',
      outputJsonPath: '/outputs/task-1/result-1.json',
      textNotes: ['ok'],
      warnings: ['draft output'],
    });
  });

  it('does not pass prompt-only reference images into the execution stage', async () => {
    let executionImageCount = -1;
    const executor = createImageTaskExecutor({
      runtimeConfig,
      modelGateway: {
        generateInstruction: async () => 'Create a fresh pink e-commerce cleaning asset.',
        executeImage: async ({ plan }) => {
          executionImageCount = plan.executionImages.length;
          return { images: [], warnings: [] };
        },
      },
      artifactStore: {
        save: async ({ task }) => ({
          outputDir: `/outputs/${task.taskId}`,
          requestJsonPath: `/outputs/${task.taskId}/request.json`,
          imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
          outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
          images: [],
        }),
      },
    });

    await executor(createTask({
      feature: 'prompt_only_main_asset',
      prompt: 'pink laundry cleaning sheet ad',
      images: [
        { role: 'reference', path: '/authorized/input/style.png' },
        { role: 'style', path: '/authorized/input/light.png' },
      ],
    }), new AbortController().signal);

    expect(executionImageCount).toBe(0);
  });
});

function createTask(request: ImageTaskRecord['request']): ImageTaskRecord {
  return {
    taskId: 'task-1',
    feature: request.feature,
    status: 'running',
    request,
    images: [],
    createdAt: '2026-06-04T00:00:00.000Z',
    updatedAt: '2026-06-04T00:00:00.000Z',
  };
}
