import { describe, expect, it } from 'vitest';
import { ENGLISH_ONLY_VISIBLE_TEXT_RULE } from '../../../../../src/shared/domain/imageOutputRules';
import { createImageTaskExecutor } from '../imageTaskExecutor';
import type { ImageTaskRecord } from '../../../../../src/shared/domain/imageFeatureApi';
import type { ImageTaskRuntimeConfig } from '../../../../../src/shared/domain/imageTaskPlan';

function withEnglishOnlyRule(...lines: string[]) {
  return [...lines, ENGLISH_ONLY_VISIBLE_TEXT_RULE].join('\n');
}

describe('imageTaskExecutor', () => {
  const runtimeConfig: ImageTaskRuntimeConfig = {
    defaultModels: {
      generation: 'gemini-2.5-flash-image',
      vision: 'gpt-5.4-mini',
    },
    modelProtocol: 'gemini',
    defaultCount: 4,
    maxCount: 4,
  };

  it('assembles the execution prompt locally and runs image execution', async () => {
    const calls: string[] = [];
    const executor = createImageTaskExecutor({
      runtimeConfig,
      modelGateway: {
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
      prompt: '保持厨房台面光影',
      images: [
        { role: 'source', path: '/authorized/input/scene.png' },
        { role: 'product', path: '/authorized/input/product.png' },
      ],
    }), new AbortController().signal, (update) => {
      progressUpdates.push(update.progress?.completed ?? 0);
    });

    const expectedPrompt = withEnglishOnlyRule(
      '用目标产品替换场景原产品，保持姿势、透视、比例与光影自然。产品的品牌，产品名称，容量，色系，风格，排版等细节要严格一致，不要有任何的差异。',
      '补充要求：保持厨房台面光影',
    );

    expect(calls[0]).toBe(`begin:task-1:${expectedPrompt}`);
    expect(calls.filter((call) => call.startsWith('execute:'))).toHaveLength(4);
    expect(calls.filter((call) => call.startsWith('execute:'))[0]).toBe(
      `execute:gemini-2.5-flash-image:2:${expectedPrompt}`,
    );
    expect(calls.at(-1)).toBe('finalize:task-1');
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
