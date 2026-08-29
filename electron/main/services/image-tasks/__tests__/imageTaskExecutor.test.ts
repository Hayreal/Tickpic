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
            images: [{
              fileName: 'result-1.png',
              buffer: new Uint8Array([1, 2, 3]),
              mimeType: 'image/png',
            }],
            textNotes: ['ok'],
            warnings: ['draft output'],
          };
        },
        executeImage: async () => {
          throw new Error('executeImage should not be called for non-product-set tasks');
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
        executeImage: async () => {
          throw new Error('executeImage should not be called');
        },
      },
      artifactStore: {
        begin: async ({ task }) => {
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
              return imagePath;
            },
            finalize: async () => ({
              outputDir: `/outputs/${task.taskId}`,
              requestJsonPath: `/outputs/${task.taskId}/request.json`,
              imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
              outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
              images: imagePaths,
            }),
          };
        },
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

  it('uses sequential single-image requests for product-set multi-count tasks', async () => {
    const variantPrompts: string[] = [];
    let singleCalls = 0;
    const executor = createImageTaskExecutor({
      runtimeConfig,
      visionInstructionClient: {
        generateReplaceProductInstruction: async () => {
          throw new Error('not used');
        },
        generateProductSetInstructions: async ({ plan }) => ({
          visionModel: 'gpt-5.4-mini',
          rawContent: '{"instructions":[{"index":1},{"index":2},{"index":3}]}',
          batch: {
            instructions: [
              { index: 1, variant_directive: 'a' },
              { index: 2, variant_directive: 'b' },
              { index: 3, variant_directive: 'c' },
            ],
          },
          executionPrompts: Array.from({ length: plan.count }, (_, index) => (
            `vision-prompt-${index + 1}`
          )),
        }),
      },
      modelGateway: {
        executeImage: async () => {
          throw new Error('executeImage should not be called for product-set multi-count tasks');
        },
        executeSingleImage: async ({ plan, finalPrompt }) => {
          singleCalls += 1;
          expect(plan.count).toBe(1);
          expect(plan.request.variantIndex).toBe(singleCalls);
          expect(plan.request.variantTotal).toBe(3);
          variantPrompts.push(finalPrompt);
          return {
            images: [{
              fileName: `result-${singleCalls}.png`,
              buffer: new Uint8Array([singleCalls]),
              mimeType: 'image/png',
            }],
          };
        },
      },
      artifactStore: {
        begin: async ({ task }) => {
          const imagePaths: string[] = [];
          return {
            outputDir: `/outputs/${task.taskId}`,
            requestJsonPath: `/outputs/${task.taskId}/request.json`,
            imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
            outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
            imagePaths,
            appendImage: async () => {
              const imagePath = `/outputs/${task.taskId}/result-${imagePaths.length + 1}.png`;
              imagePaths.push(imagePath);
              return imagePath;
            },
            finalize: async () => ({
              outputDir: `/outputs/${task.taskId}`,
              requestJsonPath: `/outputs/${task.taskId}/request.json`,
              imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
              outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
              images: imagePaths,
            }),
          };
        },
        save: async () => {
          throw new Error('save should not be called directly');
        },
      },
    });

    const result = await executor(createTask({
      feature: 'product_main_image',
      count: 3,
      images: [{ role: 'product', path: '/authorized/input/product.png' }],
    }), new AbortController().signal);

    expect(singleCalls).toBe(3);
    expect(variantPrompts).toEqual(['vision-prompt-1', 'vision-prompt-2', 'vision-prompt-3']);
    expect(result.images).toHaveLength(3);
  });

  it('uses vision-generated prompt for single-count product-set tasks', async () => {
    const prompts: string[] = [];
    const executor = createImageTaskExecutor({
      runtimeConfig,
      visionInstructionClient: {
        generateReplaceProductInstruction: async () => {
          throw new Error('not used');
        },
        generateProductSetInstructions: async () => ({
          visionModel: 'gpt-5.4-mini',
          rawContent: '{"instructions":[{"index":1}]}',
          batch: { instructions: [{ index: 1, variant_directive: 'single' }] },
          executionPrompts: ['vision-single-prompt'],
        }),
      },
      modelGateway: {
        executeImage: async () => {
          throw new Error('executeImage should not be called');
        },
        executeSingleImage: async ({ finalPrompt }) => {
          prompts.push(finalPrompt);
          return {
            images: [{
              fileName: 'result-1.png',
              buffer: new Uint8Array([1]),
              mimeType: 'image/png',
            }],
          };
        },
      },
      artifactStore: {
        begin: async ({ task, finalPrompt }) => {
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
              return imagePath;
            },
            finalize: async () => ({
              outputDir: `/outputs/${task.taskId}`,
              requestJsonPath: `/outputs/${task.taskId}/request.json`,
              imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
              outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
              images: imagePaths,
            }),
          };
        },
        save: async () => {
          throw new Error('save should not be called directly');
        },
      },
    });

    await executor(createTask({
      feature: 'product_main_image',
      count: 1,
      images: [{ role: 'product', path: '/authorized/input/product.png' }],
    }), new AbortController().signal);

    expect(prompts).toEqual(['vision-single-prompt']);
  });

  it('plans an English SKU prompt before editing the SKU image', async () => {
    const prompts: string[] = [];
    const executionImageCounts: number[] = [];
    const executor = createImageTaskExecutor({
      runtimeConfig,
      visionInstructionClient: {
        generateReplaceProductInstruction: async () => {
          throw new Error('not used');
        },
        generateProductSetInstructions: async () => {
          throw new Error('not used');
        },
        generateSkuInstructions: async () => ({
          visionModel: 'gpt-5.4-mini',
          rawContent: '{"instructions":[{"index":1,"prompt":"Edit the supplied SKU image; only redesign its label."}]}',
          batch: { instructions: [{ index: 1, prompt: 'Edit the supplied SKU image; only redesign its label.' }] },
          executionPrompts: ['Edit the supplied SKU image; only redesign its label.'],
        }),
      },
      modelGateway: {
        executeImage: async () => {
          throw new Error('executeImage should not be called');
        },
        executeSingleImage: async ({ finalPrompt, plan }) => {
          prompts.push(finalPrompt);
          executionImageCounts.push(plan.executionImages.length);
          return {
            images: [{
              fileName: 'result-1.png',
              buffer: new Uint8Array([1]),
              mimeType: 'image/png',
            }],
          };
        },
      },
      artifactStore: {
        begin: async ({ task }) => {
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
              return imagePath;
            },
            finalize: async () => ({
              outputDir: `/outputs/${task.taskId}`,
              requestJsonPath: `/outputs/${task.taskId}/request.json`,
              imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
              outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
              images: imagePaths,
            }),
          };
        },
        save: async () => {
          throw new Error('save should not be called directly');
        },
      },
    });

    await executor(createTask({
      feature: 'sku_replica',
      count: 1,
      images: [
        { role: 'source', path: '/authorized/input/sku.png' },
        { role: 'reference', path: '/authorized/input/reference.png' },
      ],
    }), new AbortController().signal);

    expect(prompts).toEqual(['Edit the supplied SKU image; only redesign its label.']);
    expect(executionImageCounts).toEqual([2]);
  });

  it('passes the handheld reference only to variants that require it', async () => {
    const executionImageCounts: number[] = [];
    const executor = createImageTaskExecutor({
      runtimeConfig,
      visionInstructionClient: {
        generateReplaceProductInstruction: async () => {
          throw new Error('not used');
        },
        generateProductSetInstructions: async () => ({
          visionModel: 'gpt-5.4-mini',
          rawContent: '{"instructions":[{"index":1},{"index":2}]}',
          batch: { instructions: [{ index: 1 }, { index: 2 }] },
          executionPrompts: ['plain non-handheld prompt', 'plain handheld prompt'],
          executionHandheldReferenceRequired: [false, true],
        }),
      },
      modelGateway: {
        executeImage: async () => {
          throw new Error('executeImage should not be called');
        },
        executeSingleImage: async ({ plan }) => {
          executionImageCounts.push(plan.executionImages.length);
          return {
            images: [{
              fileName: `result-${executionImageCounts.length}.png`,
              buffer: new Uint8Array([executionImageCounts.length]),
              mimeType: 'image/png',
            }],
          };
        },
      },
      artifactStore: {
        begin: async ({ task }) => {
          const imagePaths: string[] = [];
          return {
            outputDir: `/outputs/${task.taskId}`,
            requestJsonPath: `/outputs/${task.taskId}/request.json`,
            imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
            outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
            imagePaths,
            appendImage: async () => {
              const imagePath = `/outputs/${task.taskId}/result-${imagePaths.length + 1}.png`;
              imagePaths.push(imagePath);
              return imagePath;
            },
            finalize: async () => ({
              outputDir: `/outputs/${task.taskId}`,
              requestJsonPath: `/outputs/${task.taskId}/request.json`,
              imageInstructionPath: `/outputs/${task.taskId}/image-instruction.txt`,
              outputJsonPath: `/outputs/${task.taskId}/result-1.json`,
              images: imagePaths,
            }),
          };
        },
        save: async () => {
          throw new Error('save should not be called directly');
        },
      },
    });

    await executor(createTask({
      feature: 'product_main_image',
      count: 2,
      images: [
        { role: 'product', path: '/authorized/input/product.png' },
        { role: 'reference', path: '/authorized/resources/hand-pose.png' },
      ],
    }), new AbortController().signal);

    expect(executionImageCounts).toEqual([1, 2]);
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
