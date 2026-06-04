import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import type { ImageInput } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ImageExecutionModelResult, GeneratedImageOutput } from './imageTaskExecutor.js';
import type {
  ModelExecutionClientInput,
  ModelInstructionClientInput,
  ProtocolModelClient,
} from './modelGateway.js';

type ImageResponseItem = {
  b64_json?: string;
  base64?: string;
  image_base64?: string;
  url?: string;
  [key: string]: unknown;
};

export function createOpenAIProtocolClient(openai: any): ProtocolModelClient {
  return {
    async generateInstruction(input) {
      const content: unknown[] = [
        {
          type: 'input_text',
          text: buildInstructionUserText(input),
        },
      ];

      for (const image of input.images) {
        content.push({
          type: 'input_image',
          image_url: await readImageAsDataUrl(image),
          detail: 'auto',
        });
      }

      const response = await openai.responses.create({
        model: input.model,
        instructions: input.systemPrompt,
        input: [
          {
            role: 'user',
            content,
          },
        ],
        text: {
          verbosity: 'low',
        },
      }, {
        signal: input.abortSignal,
      });

      const finalPrompt = String(response.output_text ?? '').trim();
      if (!finalPrompt) {
        throw new Error('image instruction model returned empty finalPrompt');
      }

      return finalPrompt;
    },

    async executeImage(input) {
      const response = input.images.length > 0
        ? await openai.images.edit({
          image: input.images.map((image) => fs.createReadStream(image.path)),
          model: input.model,
          prompt: input.finalPrompt,
          n: input.count,
          ...(input.size ? { size: input.size } : {}),
          quality: 'auto',
          background: 'opaque',
          output_format: 'png',
          input_fidelity: 'high',
        }, {
          signal: input.abortSignal,
        })
        : await openai.images.generate({
          model: input.model,
          prompt: input.finalPrompt,
          n: input.count,
          ...(input.size ? { size: input.size } : {}),
          quality: 'auto',
          output_format: 'png',
        }, {
          signal: input.abortSignal,
        });

      return {
        images: await extractOpenAIImages(response),
        warnings: [],
      };
    },
  };
}

export function createGeminiProtocolClient(gemini: any): ProtocolModelClient {
  return {
    async generateInstruction(input) {
      const response = await gemini.models.generateContent({
        model: input.model,
        contents: [
          {
            role: 'user',
            parts: await buildGeminiParts(buildInstructionUserText(input), input.images),
          },
        ],
        config: {
          systemInstruction: input.systemPrompt,
        },
        abortSignal: input.abortSignal,
      });

      const finalPrompt = extractGeminiText(response).trim();
      if (!finalPrompt) {
        throw new Error('image instruction model returned empty finalPrompt');
      }

      return finalPrompt;
    },

    async executeImage(input) {
      const response = await gemini.models.generateContent({
        model: input.model,
        contents: [
          {
            role: 'user',
            parts: await buildGeminiParts(input.finalPrompt, input.images),
          },
        ],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          candidateCount: input.count,
          ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
        },
        abortSignal: input.abortSignal,
      });

      return extractGeminiExecutionResult(response);
    },
  };
}

function buildInstructionUserText(input: ModelInstructionClientInput) {
  return [
    `feature: ${input.task.feature}`,
    `mainPrompt: ${input.plan.mainPrompt}`,
    `request: ${JSON.stringify(input.task.request)}`,
    'Return only the final image instruction text.',
  ].join('\n');
}

async function readImageAsDataUrl(image: ImageInput) {
  const buffer = await readFile(image.path);
  return `data:${image.mimeType ?? inferMimeType(image.path)};base64,${buffer.toString('base64')}`;
}

async function buildGeminiParts(text: string, images: ImageInput[]) {
  const parts: unknown[] = [{ text }];
  for (const image of images) {
    const buffer = await readFile(image.path);
    parts.push({
      inlineData: {
        mimeType: image.mimeType ?? inferMimeType(image.path),
        data: buffer.toString('base64'),
      },
    });
  }
  return parts;
}

async function extractOpenAIImages(response: unknown): Promise<GeneratedImageOutput[]> {
  const data = isRecord(response) && Array.isArray(response.data) ? response.data : [];
  const images: GeneratedImageOutput[] = [];

  for (const [index, item] of (data as ImageResponseItem[]).entries()) {
    const imageBase64 = item.b64_json ?? item.base64 ?? item.image_base64;
    if (imageBase64) {
      images.push({
        fileName: `result-${index + 1}.png`,
        buffer: Buffer.from(imageBase64, 'base64'),
        mimeType: 'image/png',
      });
    } else if (item.url) {
      images.push({
        fileName: `result-${index + 1}.png`,
        buffer: await downloadImage(item.url),
        mimeType: 'image/png',
      });
    }
  }

  if (images.length === 0) {
    throw new Error('image model returned no usable image output');
  }

  return images;
}

function extractGeminiExecutionResult(response: unknown): ImageExecutionModelResult {
  const parts = extractGeminiParts(response);
  const images: GeneratedImageOutput[] = [];
  const textNotes: string[] = [];

  for (const [index, part] of parts.entries()) {
    if (isRecord(part) && typeof part.text === 'string' && part.text.trim()) {
      textNotes.push(part.text.trim());
    }

    if (isRecord(part) && isRecord(part.inlineData) && typeof part.inlineData.data === 'string') {
      images.push({
        fileName: `result-${index + 1}${extensionForMimeType(String(part.inlineData.mimeType ?? 'image/png'))}`,
        buffer: Buffer.from(part.inlineData.data, 'base64'),
        mimeType: String(part.inlineData.mimeType ?? 'image/png'),
      });
    }
  }

  if (images.length === 0) {
    throw new Error('image model returned no usable image output');
  }

  return {
    images,
    textNotes,
    warnings: [],
  };
}

function extractGeminiText(response: unknown): string {
  if (isRecord(response) && typeof response.text === 'string') {
    return response.text;
  }

  return extractGeminiParts(response)
    .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n');
}

function extractGeminiParts(response: unknown): unknown[] {
  if (!isRecord(response) || !Array.isArray(response.candidates)) {
    return [];
  }

  return response.candidates.flatMap((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
      return [];
    }
    return candidate.content.parts;
  });
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`image URL download failed: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function inferMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  return '.png';
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}
