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
        executeSingleImage: async ({ plan, finalPrompt }) => {
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
        executeImage: async () => {
          throw new Error('executeImage should not be called directly');
        },
      },
      artifactStore: {
        begin: async ({ task, finalPrompt }) => {
          calls.push(`begin:${task.taskId}:${finalPrompt}`);
          const imagePaths: string[] = [];
          return {
            outputDir: `/outputs/${task.taskId}`,
            requestJsonPath: `/outputs/${task.taskId}/request.json`,
            imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
            outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
            imagePaths,
            appendImage: async () => {
              const imagePath = `/outputs/${task.taskId}/result-1.png`;
              imagePaths.push(imagePath);
              calls.push(`append:${task.taskId}`);
              return imagePath;
            },
            finalize: async () => {
              calls.push(`finalize:${task.taskId}`);
              return {
                outputDir: `/outputs/${task.taskId}`,
                requestJsonPath: `/outputs/${task.taskId}/request.json`,
                imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
                outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
                images: imagePaths,
              };
            },
          };
        },
        save: async () => {
          throw new Error('save should not be called directly');
        },
      },
    });

    const progressUpdates: number[] = [];
    const result = await executor(createTask({
      feature: 'replace_product',
      images: [
        { role: 'source', path: '/authorized/input/scene.png' },
        { role: 'product', path: '/authorized/input/product.png' },
      ],
    }), new AbortController().signal, (update) => {
      progressUpdates.push(update.progress?.completed ?? 0);
    });

    expect(calls).toEqual([
      'instruction:gpt-5.4-mini:2',
      'begin:task-1:Replace the source product with the target product and keep lighting natural.',
      'execute:gemini-2.5-flash-image:2:Replace the source product with the target product and keep lighting natural.',
      'append:task-1',
      'execute:gemini-2.5-flash-image:2:Replace the source product with the target product and keep lighting natural.',
      'append:task-1',
      'execute:gemini-2.5-flash-image:2:Replace the source product with the target product and keep lighting natural.',
      'append:task-1',
      'execute:gemini-2.5-flash-image:2:Replace the source product with the target product and keep lighting natural.',
      'append:task-1',
      'finalize:task-1',
    ]);
    expect(progressUpdates).toEqual([0, 1, 2, 3, 4]);
    expect(result).toEqual({
      model: 'gemini-2.5-flash-image',
      protocol: 'gemini',
      outputDir: '/outputs/task-1',
      images: [
        '/outputs/task-1/result-1.png',
        '/outputs/task-1/result-1.png',
        '/outputs/task-1/result-1.png',
        '/outputs/task-1/result-1.png',
      ],
      progress: { completed: 4, total: 4 },
      requestJsonPath: '/outputs/task-1/request.json',
      imageInstructionPath: '/outputs/task-1/image-instruction.txt',
      outputJsonPath: '/outputs/task-1/result-1.json',
      textNotes: ['ok', 'ok', 'ok', 'ok'],
      warnings: ['draft output', 'draft output', 'draft output', 'draft output'],
    });
  });

  it('does not pass prompt-only reference images into the execution stage', async () => {
    let executionImageCount = -1;
    const executor = createImageTaskExecutor({
      runtimeConfig,
      modelGateway: {
        generateInstruction: async () => 'Create a fresh pink e-commerce cleaning asset.',
        executeSingleImage: async ({ plan }) => {
          executionImageCount = plan.executionImages.length;
          return {
            images: [{
              fileName: 'result-1.png',
              buffer: new Uint8Array([1]),
              mimeType: 'image/png',
            }],
          };
        },
        executeImage: async () => ({ images: [] }),
      },
      artifactStore: {
        begin: async ({ task }) => ({
          outputDir: `/outputs/${task.taskId}`,
          requestJsonPath: `/outputs/${task.taskId}/request.json`,
          imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
          outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
          imagePaths: [],
          appendImage: async () => `/outputs/${task.taskId}/result-1.png`,
          finalize: async () => ({
            outputDir: `/outputs/${task.taskId}`,
            requestJsonPath: `/outputs/${task.taskId}/request.json`,
            imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
            outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
            images: [],
          }),
        }),
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
