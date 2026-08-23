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
const MULTI_IMAGE_OPENAI_PROMPT_SUFFIX = '\n\nAPI parameter n=2 already requests 2 separate image files. Each file must be one complete standalone composition. Do not collage, stack, or layer multiple variants inside a single image canvas.';
const MULTI_IMAGE_GEMINI_PROMPT_SUFFIX = '\n\nAPI batch size is 2: return 2 separate image parts in this response. Each part must be one complete standalone image. Do not collage, stack, or layer multiple variants inside a single image canvas.';

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

  it('uses OpenAI image generation without unsupported output parameters', async () => {
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
        prompt: `final prompt${MULTI_IMAGE_OPENAI_PROMPT_SUFFIX}`,
        n: 2,
        size: '1024x1536',
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(openai.images.generate.mock.calls[0][0]).not.toHaveProperty('background');
    expect(openai.images.generate.mock.calls[0][0]).not.toHaveProperty('output_format');
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

  it('uses OpenAI image edit without unsupported optional parameters', async () => {
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
        prompt: `final prompt${MULTI_IMAGE_OPENAI_PROMPT_SUFFIX}`,
        n: 2,
        size: '1024x1536',
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(openai.images.edit.mock.calls[0][0]).not.toHaveProperty('input_fidelity');
    expect(openai.images.edit.mock.calls[0][0]).not.toHaveProperty('background');
    expect(openai.images.edit.mock.calls[0][0]).not.toHaveProperty('output_format');
    expect(openai.images.generate).not.toHaveBeenCalled();
    expect(Buffer.from(result.images[0].buffer).toString()).toBe('edited');
  });

  it('uploads OpenAI edit images as File with image MIME type, not octet-stream', async () => {
    const jpegPath = path.join(tempDir, 'input.jpg');
    await writeFile(jpegPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

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

    await client.executeImage({
      ...createExecutionInput(jpegPath),
      images: [
        { role: 'source', path: jpegPath },
        { role: 'product', path: jpegPath, mimeType: 'application/octet-stream' },
      ],
    });

    const editArgs = openai.images.edit.mock.calls[0]?.[0] as {
      image: Array<{ name: string; type: string }>;
    };
    expect(editArgs.image).toHaveLength(2);
    for (const file of editArgs.image) {
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('input.jpg');
      expect(file.type).toBe('image/jpeg');
    }
  });

  it('rejects AVIF inputs locally with a conversion hint', async () => {
    const avifPath = path.join(tempDir, 'input.avif');
    await writeFile(avifPath, Buffer.from('avif'));
    const openai = {
      chat: { completions: { create: vi.fn() } },
      images: {
        generate: vi.fn(),
        edit: vi.fn(),
      },
    };
    const client = createOpenAIProtocolClient(openai, { baseUrl: TEST_BASE_URL });

    await expect(client.executeImage({
      ...createExecutionInput(avifPath),
      images: [{ role: 'product', path: avifPath }],
    })).rejects.toThrow('AVIF 输入，请先转换为 PNG、JPG 或 WEBP');
    expect(openai.images.edit).not.toHaveBeenCalled();
  });

  it('coerces Gemini inlineData MIME away from application/octet-stream', async () => {
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

    await client.executeImage({
      ...createExecutionInput(imagePath),
      images: [{ role: 'source', path: imagePath, mimeType: 'application/octet-stream' }],
    });

    const call = gemini.models.generateContent.mock.calls[0]?.[0] as {
      contents: Array<{ parts: Array<{ inlineData?: { mimeType: string } }> }>;
    };
    const inlineData = call.contents[0].parts.find((part) => part.inlineData)?.inlineData;
    expect(inlineData?.mimeType).toBe('image/png');
  });

  it('omits input fidelity for sticker variation edits', async () => {
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

    expect(openai.images.edit.mock.calls[0][0]).not.toHaveProperty('input_fidelity');
  });

  it('extracts multiple Gemini image parts from one response', async () => {
    const gemini = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'batch note' },
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: Buffer.from('image-1').toString('base64'),
                    },
                  },
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: Buffer.from('image-2').toString('base64'),
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
      contents: [
        expect.objectContaining({
          parts: [
            expect.objectContaining({
              text: `final prompt${MULTI_IMAGE_GEMINI_PROMPT_SUFFIX}`,
            }),
            expect.objectContaining({
              inlineData: expect.objectContaining({ mimeType: 'image/png' }),
            }),
            expect.objectContaining({
              inlineData: expect.objectContaining({ mimeType: 'image/png' }),
            }),
          ],
        }),
      ],
      config: expect.not.objectContaining({
        candidateCount: expect.anything(),
      }),
    }));
    expect(result.textNotes).toEqual(['batch note']);
    expect(result.images).toHaveLength(2);
    expect(Buffer.from(result.images[0].buffer).toString()).toBe('image-1');
    expect(Buffer.from(result.images[1].buffer).toString()).toBe('image-2');
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
        aspectRatio: '9:16',
      }),
    }));
    expect(result.textNotes).toEqual(['gemini note']);
    expect(Buffer.from(result.images[0].buffer).toString()).toBe('gemini image');
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
