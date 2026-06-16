import type {
  ImageExecutionModel,
  ImageInput,
  ImageModelProtocol,
  ImageTaskRequest,
} from './imageFeatureApi.js';
import type { OpenAIImageSize } from './imageAspectRatio.js';
import { normalizeImageAspectRatio } from './imageAspectRatio.js';
import {
  resolveStickerProductRatio,
  resolveStickerProductRatioOpenAISize,
} from '../view/stickerProductRatioOptions.js';
import {
  getExecutionImageRoles,
  getImageFeatureDefinition,
  validateImageTaskRequest,
} from './imageFeatureApi.js';

export interface ImageTaskRuntimeConfig {
  defaultModels: {
    generation: string;
    vision: string;
  };
  modelProtocol: ImageModelProtocol;
  defaultCount: number;
  maxCount: number;
}

export interface ImageExecutionStagePlan {
  kind: ImageExecutionModel;
  model: string;
  protocol: ImageModelProtocol;
}

export interface ImageTaskPlan {
  request: ImageTaskRequest;
  mainPrompt: string;
  executionStage: ImageExecutionStagePlan;
  executionImages: ImageInput[];
  outputAspectRatio?: string;
  openaiImageSize?: OpenAIImageSize;
  count: number;
}

export function buildImageTaskPlan(
  request: ImageTaskRequest,
  config: ImageTaskRuntimeConfig,
): ImageTaskPlan {
  const validated = validateImageTaskRequest(request);
  const definition = getImageFeatureDefinition(validated.feature);
  const executionModel = resolveExecutionModel(validated, definition.executionModel, config);
  if (!executionModel.trim()) {
    throw new Error('generation model is not configured in settings');
  }
  const count = validated.count ?? config.defaultCount;
  const effectiveAspectRatio = resolveEffectiveAspectRatio(validated);
  const normalizedAspectRatio = effectiveAspectRatio
    ? normalizeImageAspectRatio(effectiveAspectRatio)
    : undefined;
  const openaiImageSize = resolveOpenAIImageSize(validated, normalizedAspectRatio);

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('count must be a positive integer');
  }
  if (count > config.maxCount) {
    throw new Error(`count must be less than or equal to ${config.maxCount}`);
  }

  return {
    request: validated,
    mainPrompt: definition.mainPrompt,
    executionStage: {
      kind: definition.executionModel,
      model: executionModel,
      protocol: resolveExecutionProtocol(executionModel, validated, config),
    },
    executionImages: selectExecutionImages(validated),
    outputAspectRatio: normalizedAspectRatio?.aspectRatio,
    openaiImageSize,
    count,
  };
}

function resolveEffectiveAspectRatio(request: ImageTaskRequest): string | undefined {
  const aspectRatio = request.aspectRatio?.trim();
  const productRatio = resolveStickerProductRatio(request.productRatio);

  if (aspectRatio && aspectRatio.toLowerCase() !== 'auto') {
    return aspectRatio;
  }
  if (productRatio) {
    return productRatio;
  }
  if (aspectRatio?.toLowerCase() === 'auto') {
    return 'auto';
  }
  return undefined;
}

function resolveOpenAIImageSize(
  request: ImageTaskRequest,
  normalized?: ReturnType<typeof normalizeImageAspectRatio>,
): OpenAIImageSize | undefined {
  if (!normalized) {
    return undefined;
  }

  if (normalized.aspectRatio === 'auto') {
    return 'auto';
  }

  const aspectRatio = request.aspectRatio?.trim();
  const hasExplicitAspectRatio = Boolean(
    aspectRatio && aspectRatio.toLowerCase() !== 'auto',
  );
  const productRatioSize = resolveStickerProductRatioOpenAISize(request.productRatio);
  if (productRatioSize && !hasExplicitAspectRatio) {
    return productRatioSize as OpenAIImageSize;
  }

  return normalized.openaiSize;
}

function resolveExecutionModel(
  request: ImageTaskRequest,
  executionModel: ImageExecutionModel,
  config: ImageTaskRuntimeConfig,
) {
  if (executionModel === 'generation') {
    return request.modelOverrides?.generation ?? config.defaultModels.generation;
  }

  return request.modelOverrides?.edit ?? config.defaultModels.generation;
}

function resolveExecutionProtocol(
  model: string,
  request: ImageTaskRequest,
  config: ImageTaskRuntimeConfig,
): ImageModelProtocol {
  const override = request.modelOverrides?.protocol;
  if (override === 'openai' || override === 'gemini') {
    return override;
  }

  if (model.toLowerCase().includes('gemini')) {
    return 'gemini';
  }

  return config.modelProtocol;
}

function selectExecutionImages(request: ImageTaskRequest) {
  const executionRoles = getExecutionImageRoles(request);
  return (request.images ?? []).filter((image) => executionRoles.includes(image.role));
}
