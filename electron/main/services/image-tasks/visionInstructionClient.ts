import { readFile } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import type { ImageInput, ImageTaskRecord } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ImageTaskPlan, ImageTaskRuntimeConfig } from '../../../../src/shared/domain/imageTaskPlan.js';
import { parseAndFormatReplaceProductExecutionPrompt } from '../../../../src/shared/domain/replaceProductExecutionPrompt.js';
import { isImageGenerationModel } from './instructionPrompt.js';
import { logModelRequest, logModelResponse } from './modelRequestLogger.js';
import { buildOpenAIChatCompletionsUrl } from './modelRequestUrls.js';
import { normalizeOpenAIBaseUrl } from './modelGatewayFactory.js';
import {
  buildReplaceProductVisionSystemPrompt,
  buildReplaceProductVisionUserText,
} from './replaceProductVisionPrompt.js';

export interface VisionInstructionClient {
  generateReplaceProductInstruction(input: {
    task: ImageTaskRecord;
    plan: ImageTaskPlan;
    abortSignal: AbortSignal;
  }): Promise<string>;
}

export interface CreateVisionInstructionClientOptions {
  apiKey: string;
  baseUrl: string;
  runtimeConfig: ImageTaskRuntimeConfig;
}

export function createVisionInstructionClient(
  options: CreateVisionInstructionClientOptions,
): VisionInstructionClient {
  const openai = new OpenAI({
    apiKey: options.apiKey,
    baseURL: normalizeOpenAIBaseUrl(options.baseUrl),
  });

  return {
    async generateReplaceProductInstruction({ task, plan, abortSignal }) {
      const visionModel = resolveVisionModel(task.request, options.runtimeConfig);
      if (!visionModel) {
        throw new Error('vision model is not configured in settings');
      }
      if (isImageGenerationModel(visionModel)) {
        throw new Error('vision model must not be an image-only model');
      }

      const scene = plan.executionImages.find((image) => image.role === 'source');
      const product = plan.executionImages.find((image) => image.role === 'product');
      if (!scene || !product) {
        throw new Error('replace_product requires source and product images for vision instruction');
      }

      const messages = [
        { role: 'system' as const, content: buildReplaceProductVisionSystemPrompt() },
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: buildReplaceProductVisionUserText(task.request) },
            ...(await buildOpenAIImageContentParts(scene, 'Image 1: scene')),
            ...(await buildOpenAIImageContentParts(product, 'Image 2: target product reference')),
          ],
        },
      ];

      logModelRequest('instruction', {
        protocol: 'openai',
        url: buildOpenAIChatCompletionsUrl(options.baseUrl),
        model: visionModel,
        messages: messages.map((message) => ({
          role: message.role,
          content: typeof message.content === 'string'
            ? message.content
            : message.content.map((part) => (
              part.type === 'text'
                ? part
                : { type: part.type, image_url: { url: '[base64 redacted]', detail: 'high' } }
            )),
        })),
      });

      const response = await openai.chat.completions.create({
        model: visionModel,
        messages,
        response_format: { type: 'json_object' },
      }, {
        signal: abortSignal,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('vision model returned empty JSON instruction');
      }

      logModelResponse('instruction', {
        protocol: 'openai',
        url: buildOpenAIChatCompletionsUrl(options.baseUrl),
        model: visionModel,
        response,
      });

      return parseAndFormatReplaceProductExecutionPrompt(content, task.request);
    },
  };
}

function resolveVisionModel(
  request: ImageTaskRecord['request'],
  runtimeConfig: ImageTaskRuntimeConfig,
): string {
  return (request.modelOverrides?.vision ?? runtimeConfig.defaultModels.vision).trim();
}

async function buildOpenAIImageContentParts(image: ImageInput, caption: string) {
  const buffer = await readFile(image.path);
  const mimeType = image.mimeType ?? inferMimeType(image.path);

  return [
    { type: 'text' as const, text: caption },
    {
      type: 'image_url' as const,
      image_url: {
        url: `data:${mimeType};base64,${buffer.toString('base64')}`,
        detail: 'high' as const,
      },
    },
  ];
}

function inferMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}
