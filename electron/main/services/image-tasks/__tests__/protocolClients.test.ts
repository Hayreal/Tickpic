import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGeminiProtocolClient,
  createOpenAIProtocolClient,
} from '../protocolClients';
import type {
  ModelExecutionClientInput,
  ModelInstructionClientInput,
} from '../modelGateway';
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

  it('uses OpenAI chat.completions for instruction generation with image data urls', async () => {
    const openai = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'final instruction' } }],
          }),
        },
      },
      images: {
        generate: vi.fn(),
        edit: vi.fn(),
      },
    };
    const client = createOpenAIProtocolClient(openai, { baseUrl: TEST_BASE_URL });

    const result = await client.generateInstruction(createInstructionInput(imagePath));

    expect(result).toBe('final instruction');
    expect(openai.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: 'system prompt' },
          {
            role: 'user',
            content: [
              { type: 'text', text: expect.stringContaining('feature: replace_product') },
              {
                type: 'image_url',
                image_url: {
                  url: 'data:image/png;base64,iVBORw==',
                  detail: 'low',
                },
              },
            ],
          },
        ],
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('builds a local instruction when an image-only model is configured for stage 1', async () => {
    const openai = {
      chat: { completions: { create: vi.fn() } },
      images: { generate: vi.fn(), edit: vi.fn() },
    };
    const client = createOpenAIProtocolClient(openai, { baseUrl: TEST_BASE_URL });

    const result = await client.generateInstruction({
      ...createInstructionInput(imagePath),
      model: 'gpt-image-2-all',
    });

    expect(result).toContain('replace product');
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
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

  it('passes aspectRatio auto to Gemini image execution', async () => {
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
          aspectRatio: 'auto',
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

  it('uses Gemini generateContent for instruction and image execution', async () => {
    const gemini = {
      models: {
        generateContent: vi.fn()
          .mockResolvedValueOnce({ text: 'gemini instruction' })
          .mockResolvedValueOnce({
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

    await expect(client.generateInstruction(createInstructionInput(imagePath))).resolves.toBe('gemini instruction');
    const result = await client.executeImage(createExecutionInput(imagePath));

    expect(gemini.models.generateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      model: 'gpt-5.4-mini',
      config: expect.objectContaining({ systemInstruction: 'system prompt' }),
    }));
    expect(gemini.models.generateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      model: 'gpt-image-2',
      config: expect.objectContaining({
        responseModalities: ['TEXT', 'IMAGE'],
        aspectRatio: '9:16',
      }),
    }));
    expect(result.textNotes).toEqual(['gemini note']);
    expect(Buffer.from(result.images[0].buffer).toString()).toBe('gemini image');
  });
});

function createInstructionInput(imagePath: string): ModelInstructionClientInput {
  const task = createTask(imagePath);
  const plan = createPlan(imagePath);
  return {
    task,
    plan,
    model: 'gpt-5.4-mini',
    images: plan.instructionImages,
    systemPrompt: 'system prompt',
    abortSignal: new AbortController().signal,
  };
}

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
    instructionSystemPrompt: 'system prompt',
    instructionStage: {
      model: 'gpt-5.4-mini',
      protocol: 'openai',
    },
    executionStage: {
      kind: 'edit',
      model: 'gpt-image-2',
      protocol: 'openai',
    },
    instructionImages: [
      { role: 'source', path: imagePath, mimeType: 'image/png' },
    ],
    executionImages: [
      { role: 'source', path: imagePath, mimeType: 'image/png' },
      { role: 'product', path: imagePath, mimeType: 'image/png' },
    ],
    outputAspectRatio: '9:16',
    openaiImageSize: '1024x1536',
    count: 2,
  };
}
