import { readFile } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import type { ImageInput, ImageTaskRecord } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ImageTaskPlan, ImageTaskRuntimeConfig } from '../../../../src/shared/domain/imageTaskPlan.js';
import { parseAndFormatReplaceProductExecutionPrompt } from '../../../../src/shared/domain/replaceProductExecutionPrompt.js';
import {
  parseProductSetVisionBatch,
  type ProductSetVisionBatch,
} from '../../../../src/shared/domain/productSetVisionInstructions.js';
import { isImageGenerationModel } from './instructionPrompt.js';
import { logModelRequest, logModelResponse } from './modelRequestLogger.js';
import { buildOpenAIChatCompletionsUrl } from './modelRequestUrls.js';
import { normalizeOpenAIBaseUrl } from './modelGatewayFactory.js';
import {
  buildProductSetExecutionVariantsFromVision,
  isProductSetFeature,
} from './productSetJsonPrompt.js';
import {
  buildProductSetVisionSystemPrompt,
  buildProductSetVisionUserText,
} from './productSetVisionPrompt.js';
import {
  buildSkuVisionSystemPrompt,
  buildSkuVisionUserText,
  finalizeSkuVisionInstruction,
  parseSkuVisionBatch,
} from './skuVisionPrompt.js';
import {
  buildHitMainVisionImageParts,
  buildSkuHitMainVisionSystemPrompt,
  buildSkuHitMainVisionUserText,
  finalizeSkuHitMainVisionInstruction,
  parseSkuHitMainVisionBatch,
  type SkuHitMainVisionBatch,
} from './skuHitMainVisionPrompt.js';
import { isSkuHitMainImageFeature } from './skuHitMainImagePrompt.js';
import { isSkuFeature } from './skuExecutionPrompt.js';
import {
  buildReplaceProductVisionSystemPrompt,
  buildReplaceProductVisionUserText,
} from './replaceProductVisionPrompt.js';

export interface ProductSetVisionInstructionResult {
  visionModel: string;
  rawContent: string;
  batch: ProductSetVisionBatch;
  executionPrompts: string[];
  executionHandheldReferenceRequired?: boolean[];
}

export interface SkuVisionInstructionResult {
  visionModel: string;
  rawContent: string;
  batch: import('./skuVisionPrompt.js').SkuVisionBatch;
  executionPrompts: string[];
}

export interface SkuHitMainVisionInstructionResult {
  visionModel: string;
  rawContent: string;
  batch: SkuHitMainVisionBatch;
  executionPrompts: string[];
}

export interface VisionInstructionClient {
  generateReplaceProductInstruction(input: {
    task: ImageTaskRecord;
    plan: ImageTaskPlan;
    abortSignal: AbortSignal;
  }): Promise<string>;
  generateProductSetInstructions(input: {
    task: ImageTaskRecord;
    plan: ImageTaskPlan;
    abortSignal: AbortSignal;
  }): Promise<ProductSetVisionInstructionResult>;
  generateSkuInstructions?(input: {
    task: ImageTaskRecord;
    plan: ImageTaskPlan;
    abortSignal: AbortSignal;
  }): Promise<SkuVisionInstructionResult>;
  generateSkuHitMainInstructions?(input: {
    task: ImageTaskRecord;
    plan: ImageTaskPlan;
    abortSignal: AbortSignal;
  }): Promise<SkuHitMainVisionInstructionResult>;
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

    async generateProductSetInstructions({ task, plan, abortSignal }) {
      if (!isProductSetFeature(task.feature)) {
        throw new Error(`generateProductSetInstructions does not support feature ${task.feature}`);
      }

      const visionModel = resolveVisionModel(task.request, options.runtimeConfig);
      if (!visionModel) {
        throw new Error('vision model is not configured in settings');
      }
      if (isImageGenerationModel(visionModel)) {
        throw new Error('vision model must not be an image-only model');
      }

      if (plan.executionImages.length === 0) {
        throw new Error('product-set features require at least one execution image for vision instruction');
      }

      const imageParts = [];
      for (const [index, image] of plan.executionImages.entries()) {
        const caption = image.role === 'reference'
          ? `Image ${index + 1}: handheld reference`
          : `Image ${index + 1}: SKU product reference`;
        imageParts.push(...await buildOpenAIImageContentParts(image, caption));
      }

      const messages = [
        { role: 'system' as const, content: buildProductSetVisionSystemPrompt(task.feature) },
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: buildProductSetVisionUserText(task.request, plan.count) },
            ...imageParts,
          ],
        },
      ];

      logModelRequest('instruction', {
        protocol: 'openai',
        url: buildOpenAIChatCompletionsUrl(options.baseUrl),
        model: visionModel,
        feature: task.feature,
        requestedCount: plan.count,
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
        throw new Error('vision model returned empty product-set instruction batch');
      }

      logModelResponse('instruction', {
        protocol: 'openai',
        url: buildOpenAIChatCompletionsUrl(options.baseUrl),
        model: visionModel,
        feature: task.feature,
        response,
      });

      const batch = parseProductSetVisionBatch(content, plan.count);
      const executionVariants = buildProductSetExecutionVariantsFromVision(task.request, batch);
      return {
        visionModel,
        rawContent: content,
        batch,
        executionPrompts: executionVariants.map((variant) => variant.prompt),
        executionHandheldReferenceRequired: executionVariants.map(
          (variant) => variant.requiresHandheldReference,
        ),
      };
    },

    async generateSkuInstructions({ task, plan, abortSignal }) {
      if (!isSkuFeature(task.feature)) {
        throw new Error(`generateSkuInstructions does not support feature ${task.feature}`);
      }

      const visionModel = resolveVisionModel(task.request, options.runtimeConfig);
      if (!visionModel) {
        throw new Error('vision model is not configured in settings');
      }
      if (isImageGenerationModel(visionModel)) {
        throw new Error('vision model must not be an image-only model');
      }
      if (plan.executionImages.length === 0) {
        throw new Error('SKU tasks require execution images for vision instruction');
      }

      const imageParts = [];
      for (const [index, image] of plan.executionImages.entries()) {
        const caption = image.role === 'source'
          ? `Image ${index + 1}: fixed SKU product canvas`
          : `Image ${index + 1}: label design reference only`;
        imageParts.push(...await buildOpenAIImageContentParts(image, caption));
      }

      const messages = [
        { role: 'system' as const, content: buildSkuVisionSystemPrompt(task.feature) },
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: buildSkuVisionUserText(task.request, plan.count) },
            ...imageParts,
          ],
        },
      ];

      logModelRequest('instruction', {
        protocol: 'openai',
        url: buildOpenAIChatCompletionsUrl(options.baseUrl),
        model: visionModel,
        feature: task.feature,
        requestedCount: plan.count,
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
        throw new Error('vision model returned empty SKU instruction batch');
      }

      logModelResponse('instruction', {
        protocol: 'openai',
        url: buildOpenAIChatCompletionsUrl(options.baseUrl),
        model: visionModel,
        feature: task.feature,
        response,
      });

      const batch = parseSkuVisionBatch(content, plan.count);
      return {
        visionModel,
        rawContent: content,
        batch,
        executionPrompts: batch.instructions.map((instruction) => (
          finalizeSkuVisionInstruction({
            ...task.request,
            count: 1,
            variantIndex: instruction.index,
            variantTotal: plan.count,
          }, instruction.prompt, batch.lockedCopy)
        )),
      };
    },

    async generateSkuHitMainInstructions({ task, plan, abortSignal }) {
      if (!isSkuHitMainImageFeature(task.feature)) {
        throw new Error(`generateSkuHitMainInstructions does not support feature ${task.feature}`);
      }

      const visionModel = resolveVisionModel(task.request, options.runtimeConfig);
      if (!visionModel) {
        throw new Error('vision model is not configured in settings');
      }
      if (isImageGenerationModel(visionModel)) {
        throw new Error('vision model must not be an image-only model');
      }
      if (plan.executionImages.length === 0) {
        throw new Error('hit-main tasks require execution images for vision instruction');
      }

      const imageParts = [];
      for (const { image, caption } of buildHitMainVisionImageParts(plan.executionImages)) {
        imageParts.push(...await buildOpenAIImageContentParts(image, caption));
      }

      const messages = [
        { role: 'system' as const, content: buildSkuHitMainVisionSystemPrompt() },
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: buildSkuHitMainVisionUserText(task.request, plan.count) },
            ...imageParts,
          ],
        },
      ];

      logModelRequest('instruction', {
        protocol: 'openai',
        url: buildOpenAIChatCompletionsUrl(options.baseUrl),
        model: visionModel,
        feature: task.feature,
        requestedCount: plan.count,
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
        throw new Error('vision model returned empty hit-main instruction batch');
      }

      logModelResponse('instruction', {
        protocol: 'openai',
        url: buildOpenAIChatCompletionsUrl(options.baseUrl),
        model: visionModel,
        feature: task.feature,
        response,
      });

      const batch = parseSkuHitMainVisionBatch(content, plan.count);
      return {
        visionModel,
        rawContent: content,
        batch,
        executionPrompts: batch.instructions.map((instruction) => (
          finalizeSkuHitMainVisionInstruction({
            ...task.request,
            count: 1,
            variantIndex: instruction.index,
            variantTotal: plan.count,
          }, instruction.prompt)
        )),
      };
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
