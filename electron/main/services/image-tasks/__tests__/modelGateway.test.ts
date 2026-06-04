import { describe, expect, it, vi } from 'vitest';
import { createProtocolModelGateway } from '../modelGateway';
import type { ImageTaskPlan } from '../../../../../src/shared/domain/imageTaskPlan';
import type { ImageTaskRecord } from '../../../../../src/shared/domain/imageFeatureApi';

describe('modelGateway', () => {
  it('routes instruction and execution stages to clients by configured protocol', async () => {
    const openai = {
      generateInstruction: vi.fn().mockResolvedValue('openai instruction'),
      executeImage: vi.fn().mockResolvedValue({ images: [], warnings: ['openai image'] }),
    };
    const gemini = {
      generateInstruction: vi.fn().mockResolvedValue('gemini instruction'),
      executeImage: vi.fn().mockResolvedValue({ images: [], warnings: ['gemini image'] }),
    };
    const gateway = createProtocolModelGateway({ openai, gemini });
    const task = createTask();
    const plan = createPlan();

    const abortSignal = new AbortController().signal;
    const finalPrompt = await gateway.generateInstruction({ task, plan, abortSignal });
    const result = await gateway.executeImage({ task, plan, finalPrompt, abortSignal });

    expect(finalPrompt).toBe('gemini instruction');
    expect(result.warnings).toEqual(['openai image']);
    expect(gemini.generateInstruction).toHaveBeenCalledWith({
      task,
      plan,
      model: 'gemini-3.1-flash-lite',
      images: plan.instructionImages,
      systemPrompt: plan.instructionSystemPrompt,
      abortSignal,
    });
    expect(openai.executeImage).toHaveBeenCalledWith({
      task,
      plan,
      model: 'gpt-image-2',
      finalPrompt: 'gemini instruction',
      images: plan.executionImages,
      count: 2,
      aspectRatio: '4:3',
      size: '1536x1024',
      abortSignal,
    });
  });

  it('throws when a protocol client is not configured', async () => {
    const gateway = createProtocolModelGateway({
      gemini: {
        generateInstruction: vi.fn().mockResolvedValue('instruction'),
        executeImage: vi.fn().mockResolvedValue({ images: [] }),
      },
    });

    await expect(gateway.executeImage({
      task: createTask(),
      plan: createPlan(),
      finalPrompt: 'instruction',
      abortSignal: new AbortController().signal,
    })).rejects.toThrow('openai model client is not configured');
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
    instructionSystemPrompt: 'system prompt',
    instructionStage: {
      model: 'gemini-3.1-flash-lite',
      protocol: 'gemini',
    },
    executionStage: {
      kind: 'edit',
      model: 'gpt-image-2',
      protocol: 'openai',
    },
    instructionImages: [
      { role: 'source', path: '/authorized/input/scene.png' },
      { role: 'product', path: '/authorized/input/product.png' },
    ],
    executionImages: [
      { role: 'source', path: '/authorized/input/scene.png' },
      { role: 'product', path: '/authorized/input/product.png' },
    ],
    outputAspectRatio: '4:3',
    openaiImageSize: '1536x1024',
    count: 2,
  };
}
