import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import type { ImageInput } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ImageExecutionModelResult, GeneratedImageOutput } from './imageTaskExecutor.js';
import type {
  ModelExecutionClientInput,
  ProtocolModelClient,
} from './modelGateway.js';
import { logModelRequest, logModelResponse } from './modelRequestLogger.js';
import {
  buildGeminiGenerateContentUrl,
  buildOpenAIImagesEditUrl,
  buildOpenAIImagesGenerateUrl,
} from './modelRequestUrls.js';

export interface ProtocolClientOptions {
  baseUrl: string;
}

type ImageResponseItem = {
  b64_json?: string;
  base64?: string;
  image_base64?: string;
  url?: string;
  [key: string]: unknown;
};

export function createOpenAIProtocolClient(
  openai: any,
  options: ProtocolClientOptions,
): ProtocolModelClient {
  return {
    async executeImage(input) {
      const executionPayload = input.images.length > 0
        ? {
          operation: 'edit',
          image: input.images.map((image) => ({
            role: image.role,
            path: image.path,
            mimeType: image.mimeType,
          })),
          model: input.model,
          prompt: input.finalPrompt,
          n: input.count,
          ...(input.size ? { size: input.size } : {}),
          quality: 'auto',
        }
        : {
          operation: 'generate',
          model: input.model,
          prompt: input.finalPrompt,
          n: input.count,
          ...(input.size ? { size: input.size } : {}),
          quality: 'auto',
        };
      logModelRequest('execution', {
        protocol: 'openai',
        url: input.images.length > 0
          ? buildOpenAIImagesEditUrl(options.baseUrl)
          : buildOpenAIImagesGenerateUrl(options.baseUrl),
        ...executionPayload,
      });

      const response = input.images.length > 0
        ? await openai.images.edit({
          image: input.images.map((image) => fs.createReadStream(image.path)),
          model: input.model,
          prompt: input.finalPrompt,
          n: input.count,
          ...(input.size ? { size: input.size } : {}),
          quality: 'auto',
        }, {
          signal: input.abortSignal,
        })
        : await openai.images.generate({
          model: input.model,
          prompt: input.finalPrompt,
          n: input.count,
          ...(input.size ? { size: input.size } : {}),
          quality: 'auto',
        }, {
          signal: input.abortSignal,
        });

      const images = await extractOpenAIImages(response);
      logModelResponse('execution', {
        protocol: 'openai',
        url: input.images.length > 0
          ? buildOpenAIImagesEditUrl(options.baseUrl)
          : buildOpenAIImagesGenerateUrl(options.baseUrl),
        model: input.model,
        imageCount: images.length,
        images: images.map((image) => ({
          fileName: image.fileName,
          mimeType: image.mimeType,
          byteLength: image.buffer.byteLength,
        })),
        response,
      });

      return {
        images,
        warnings: [],
      };
    },
  };
}

export function createGeminiProtocolClient(
  gemini: any,
  options: ProtocolClientOptions,
): ProtocolModelClient {
  return {
    async executeImage(input) {
      const executionParts = await buildGeminiParts(input.finalPrompt, input.images);
      const executionPayload = {
        model: input.model,
        contents: [
          {
            role: 'user',
            parts: executionParts,
          },
        ],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          candidateCount: input.count,
          ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
        },
      };
      logModelRequest('execution', {
        protocol: 'gemini',
        url: buildGeminiGenerateContentUrl(options.baseUrl, input.model),
        ...executionPayload,
        images: input.images.map((image) => ({
          role: image.role,
          path: image.path,
          mimeType: image.mimeType,
        })),
      });

      const response = await gemini.models.generateContent({
        ...executionPayload,
        abortSignal: input.abortSignal,
      });

      const result = extractGeminiExecutionResult(response);
      logModelResponse('execution', {
        protocol: 'gemini',
        url: buildGeminiGenerateContentUrl(options.baseUrl, input.model),
        model: input.model,
        imageCount: result.images.length,
        textNotes: result.textNotes,
        images: result.images.map((image) => ({
          fileName: image.fileName,
          mimeType: image.mimeType,
          byteLength: image.buffer.byteLength,
        })),
        response,
      });

      return result;
    },
  };
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
