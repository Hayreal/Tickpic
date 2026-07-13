import { describe, expect, it, vi } from 'vitest';
import { createProtocolModelGateway } from '../modelGateway';
import type { ImageTaskPlan } from '../../../../../src/shared/domain/imageTaskPlan';
import type { ImageTaskRecord } from '../../../../../src/shared/domain/imageFeatureApi';

describe('modelGateway', () => {
  it('routes execution stage to clients by configured protocol', async () => {
    const openai = {
      executeImage: vi.fn().mockResolvedValue({
        images: [{ fileName: 'result-1.png', buffer: new Uint8Array([1]), mimeType: 'image/png' }],
        warnings: ['openai image'],
      }),
    };
    const gemini = {
      executeImage: vi.fn().mockResolvedValue({ images: [], warnings: ['gemini image'] }),
    };
    const gateway = createProtocolModelGateway({ openai, gemini });
    const task = createTask();
    const plan = createPlan();

    const abortSignal = new AbortController().signal;
    const result = await gateway.executeImage({ task, plan, finalPrompt: 'assembled prompt', abortSignal });

    expect(result.warnings).toEqual(['openai image', 'openai image']);
    expect(result.images).toHaveLength(2);
    expect(openai.executeImage).toHaveBeenCalledTimes(2);
    expect(openai.executeImage).toHaveBeenCalledWith({
      task,
      plan,
      model: 'gpt-image-2',
      finalPrompt: 'assembled prompt',
      images: plan.executionImages,
      count: 1,
      aspectRatio: '4:3',
      size: '1536x1024',
      imageSize: undefined,
      abortSignal,
    });
  });

  it('throws when a protocol client is not configured', async () => {
    const gateway = createProtocolModelGateway({
      gemini: {
        executeImage: vi.fn().mockResolvedValue({ images: [] }),
      },
    });

    await expect(gateway.executeImage({
      task: createTask(),
      plan: createPlan(),
      finalPrompt: 'assembled prompt',
      abortSignal: new AbortController().signal,
    })).rejects.toThrow('openai model client is not configured');
  });

  it('adds sticker output context when the provider rejects the requested size', async () => {
    const gateway = createProtocolModelGateway({
      openai: {
        executeImage: vi.fn().mockRejectedValue(new Error('unsupported size')),
      },
    });
    const plan: ImageTaskPlan = {
      ...createPlan(),
      request: {
        feature: 'sticker_original',
        aspectRatio: '3:2',
        outputQuality: '2K',
      },
      outputAspectRatio: '3:2',
      outputSpec: {
        aspectRatio: '3:2',
        outputQuality: '2K',
        width: 2048,
        height: 1360,
        size: '2048x1360',
      },
      openaiImageSize: '2048x1360',
    };

    await expect(gateway.executeSingleImage({
      task: {
        ...createTask(),
        feature: 'sticker_original',
        request: plan.request,
      },
      plan,
      finalPrompt: 'assembled prompt',
      abortSignal: new AbortController().signal,
    })).rejects.toThrow(
      'sticker image execution failed (provider=openai, protocol=openai, target ratio=3:2, quality=2K, target size=2048x1360): unsupported size',
    );
  });
});

function createTask(): ImageTaskRecord {
  return {
    taskId: 'task-1',
    feature: 'replace_product',
    status: 'running',
    request: {
      feature: 'replace_product',
      images: [
        { role: 'source', path: '/authorized/input/scene.png' },
        { role: 'product', path: '/authorized/input/product.png' },
      ],
    },
    images: [],
    createdAt: '2026-06-04T00:00:00.000Z',
    updatedAt: '2026-06-04T00:00:00.000Z',
  };
}

function createPlan(): ImageTaskPlan {
  return {
    request: createTask().request,
    mainPrompt: '用目标产品替换原图中的产品，并保持场景自然贴合',
    executionStage: {
      kind: 'edit',
      model: 'gpt-image-2',
      protocol: 'openai',
    },
    executionImages: [
      { role: 'source', path: '/authorized/input/scene.png' },
      { role: 'product', path: '/authorized/input/product.png' },
    ],
    outputAspectRatio: '4:3',
    openaiImageSize: '1536x1024',
    count: 2,
  };
}
