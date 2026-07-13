import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGeminiProtocolClient,
  createOpenAIProtocolClient,
} from '../protocolClients';
import type { ModelExecutionClientInput } from '../modelGateway';
import type { ImageTaskPlan } from '../../../../../src/shared/domain/imageTaskPlan';
import type { ImageTaskRecord } from '../../../../../src/shared/domain/imageFeatureApi';

const TEST_BASE_URL = 'https://api.n1n.ai';

describe('protocolClients', () => {
  let tempDir: string;
  let imagePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'tickpic-protocol-client-'));
    imagePath = path.join(tempDir, 'input.png');
    await writeFile(imagePath, Buffer.from([137, 80, 78, 71]));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('uses OpenAI image generation when execution has no image inputs', async () => {
    const openai = {
      chat: { completions: { create: vi.fn() } },
      images: {
        generate: vi.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from('generated').toString('base64') }],
        }),
        edit: vi.fn(),
      },
    };
    const client = createOpenAIProtocolClient(openai, { baseUrl: TEST_BASE_URL });

    const result = await client.executeImage({
      ...createExecutionInput(imagePath),
      images: [],
      plan: {
        ...createPlan(imagePath),
        executionImages: [],
      },
    });

    expect(openai.images.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-image-2',
        prompt: 'final prompt',
        n: 2,
        size: '1024x1536',
        output_format: 'png',
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(openai.images.edit).not.toHaveBeenCalled();
    expect(Buffer.from(result.images[0].buffer).toString()).toBe('generated');
  });

  it('passes size auto to OpenAI image edit when aspectRatio is auto', async () => {
    const openai = {
      chat: { completions: { create: vi.fn() } },
      images: {
        generate: vi.fn(),
        edit: vi.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from('edited-auto').toString('base64') }],
        }),
      },
    };
    const client = createOpenAIProtocolClient(openai, { baseUrl: TEST_BASE_URL });

    await client.executeImage({
      ...createExecutionInput(imagePath),
      size: 'auto',
      aspectRatio: 'auto',
    });

    expect(openai.images.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        size: 'auto',
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('passes aspectRatio auto inside Gemini imageConfig', async () => {
    const gemini = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: Buffer.from('gemini auto').toString('base64'),
                    },
                  },
                ],
              },
            },
          ],
        }),
      },
    };
    const client = createGeminiProtocolClient(gemini, { baseUrl: TEST_BASE_URL });

    await client.executeImage({
      ...createExecutionInput(imagePath),
      aspectRatio: 'auto',
      size: 'auto',
    });

    expect(gemini.models.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          imageConfig: { aspectRatio: 'auto' },
        }),
      }),
    );
  });

  it('uses OpenAI image edit when execution has image inputs', async () => {
    const openai = {
      chat: { completions: { create: vi.fn() } },
      images: {
        generate: vi.fn(),
        edit: vi.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from('edited').toString('base64') }],
        }),
      },
    };
    const client = createOpenAIProtocolClient(openai, { baseUrl: TEST_BASE_URL });

    const result = await client.executeImage(createExecutionInput(imagePath));

    expect(openai.images.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-image-2',
        prompt: 'final prompt',
        n: 2,
        size: '1024x1536',
        output_format: 'png',
        input_fidelity: 'high',
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(openai.images.generate).not.toHaveBeenCalled();
    expect(Buffer.from(result.images[0].buffer).toString()).toBe('edited');
  });

  it('uses low OpenAI input fidelity for sticker variation edits', async () => {
    const openai = {
      chat: { completions: { create: vi.fn() } },
      images: {
        generate: vi.fn(),
        edit: vi.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from('varied').toString('base64') }],
        }),
      },
    };
    const client = createOpenAIProtocolClient(openai, { baseUrl: TEST_BASE_URL });

    await client.executeImage(createStickerVariationExecutionInput(imagePath));

    expect(openai.images.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        input_fidelity: 'low',
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('uses resolved strategy fidelity for color/layout variations and style-backed originals', async () => {
    const openai = {
      chat: { completions: { create: vi.fn() } },
      images: {
        generate: vi.fn(),
        edit: vi.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from('varied').toString('base64') }],
        }),
      },
    };
    const client = createOpenAIProtocolClient(openai, { baseUrl: TEST_BASE_URL });
    const color = createStickerVariationExecutionInput(imagePath);
    color.plan = { ...color.plan, resolvedVariationStrategy: 'color' };
    const layout = createStickerVariationExecutionInput(imagePath);
    layout.plan = { ...layout.plan, resolvedVariationStrategy: 'layout' };
    const original = createExecutionInput(imagePath);
    original.task = {
      ...original.task,
      feature: 'sticker_original',
      request: { feature: 'sticker_original', images: [{ role: 'style', path: imagePath, mimeType: 'image/png' }] },
    };
    original.plan = {
      ...original.plan,
      request: original.task.request,
      executionImages: original.task.request.images ?? [],
    };
    original.images = original.plan.executionImages;

    await client.executeImage(color);
    await client.executeImage(layout);
    await client.executeImage(original);

    expect(openai.images.edit.mock.calls[0][0].input_fidelity).toBe('high');
    expect(openai.images.edit.mock.calls[1][0].input_fidelity).toBe('low');
    expect(openai.images.edit.mock.calls[2][0].input_fidelity).toBe('low');
  });

  it('uses Gemini generateContent for image execution', async () => {
    const gemini = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'gemini note' },
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: Buffer.from('gemini image').toString('base64'),
                    },
                  },
                ],
              },
            },
          ],
        }),
      },
    };
    const client = createGeminiProtocolClient(gemini, { baseUrl: TEST_BASE_URL });

    const result = await client.executeImage(createExecutionInput(imagePath));

    expect(gemini.models.generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-image-2',
      config: expect.objectContaining({
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '9:16' },
      }),
    }));
    expect(result.textNotes).toEqual(['gemini note']);
    expect(Buffer.from(result.images[0].buffer).toString()).toBe('gemini image');
  });

  it('sends the sticker ratio and uppercase quality in Gemini imageConfig', async () => {
    const gemini = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [{ content: { parts: [{ inlineData: {
            mimeType: 'image/png',
            data: Buffer.from('gemini sticker').toString('base64'),
          } }] } }],
        }),
      },
    };
    const client = createGeminiProtocolClient(gemini, { baseUrl: TEST_BASE_URL });

    await client.executeImage({
      ...createExecutionInput(imagePath),
      aspectRatio: '3:2',
      imageSize: '2K',
    });

    expect(gemini.models.generateContent).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        imageConfig: { aspectRatio: '3:2', imageSize: '2K' },
      }),
    }));
  });
});

function createExecutionInput(imagePath: string): ModelExecutionClientInput {
  const task = createTask(imagePath);
  const plan = createPlan(imagePath);
  return {
    task,
    plan,
    model: 'gpt-image-2',
    images: plan.executionImages,
    finalPrompt: 'final prompt',
    count: 2,
    aspectRatio: '9:16',
    size: '1024x1536',
    abortSignal: new AbortController().signal,
  };
}

function createStickerVariationExecutionInput(imagePath: string): ModelExecutionClientInput {
  const task: ImageTaskRecord = {
    ...createTask(imagePath),
    feature: 'sticker_variation',
    request: {
      feature: 'sticker_variation',
      images: [
        { role: 'source', path: imagePath, mimeType: 'image/png' },
      ],
    },
  };
  const plan: ImageTaskPlan = {
    ...createPlan(imagePath),
    request: task.request,
    mainPrompt: 'sticker variation',
    executionImages: task.request.images ?? [],
  };

  return {
    ...createExecutionInput(imagePath),
    task,
    plan,
    images: plan.executionImages,
  };
}

function createTask(imagePath: string): ImageTaskRecord {
  return {
    taskId: 'task-1',
    feature: 'replace_product',
    status: 'running',
    request: {
      feature: 'replace_product',
      images: [
        { role: 'source', path: imagePath, mimeType: 'image/png' },
        { role: 'product', path: imagePath, mimeType: 'image/png' },
      ],
    },
    images: [],
    createdAt: '2026-06-04T00:00:00.000Z',
    updatedAt: '2026-06-04T00:00:00.000Z',
  };
}

function createPlan(imagePath: string): ImageTaskPlan {
  return {
    request: createTask(imagePath).request,
    mainPrompt: 'replace product',
    executionStage: {
      kind: 'edit',
      model: 'gpt-image-2',
      protocol: 'openai',
    },
    executionImages: [
      { role: 'source', path: imagePath, mimeType: 'image/png' },
      { role: 'product', path: imagePath, mimeType: 'image/png' },
    ],
    outputAspectRatio: '9:16',
    openaiImageSize: '1024x1536',
    count: 2,
  };
}
