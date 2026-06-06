import type {
  ImageExecutionModel,
  ImageInput,
  ImageModelProtocol,
  ImageTaskRequest,
} from './imageFeatureApi.js';
import type { OpenAIImageSize } from './imageAspectRatio.js';
import { normalizeImageAspectRatio } from './imageAspectRatio.js';
import {
  getExecutionImageRoles,
  getImageFeatureDefinition,
  validateImageTaskRequest,
} from './imageFeatureApi.js';
import { buildImageInstructionSystemPrompt } from './imageInstructionPrompts.js';

export interface ImageTaskRuntimeConfig {
  defaultModels: {
    generation: string;
    vision: string;
  };
  modelProtocol: ImageModelProtocol;
  defaultCount: number;
  maxCount: number;
}

export interface ImageInstructionStagePlan {
  model: string;
  protocol: ImageModelProtocol;
}

export interface ImageExecutionStagePlan {
  kind: ImageExecutionModel;
  model: string;
  protocol: ImageModelProtocol;
}

export interface ImageTaskPlan {
  request: ImageTaskRequest;
  mainPrompt: string;
  instructionSystemPrompt: string;
  instructionStage: ImageInstructionStagePlan;
  executionStage: ImageExecutionStagePlan;
  instructionImages: ImageInput[];
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
  const visionModel = validated.modelOverrides?.vision
    ?? config.defaultModels.vision
    ?? config.defaultModels.generation;
  if (!visionModel.trim()) {
    throw new Error('vision model is not configured in settings');
  }
  if (!executionModel.trim()) {
    throw new Error('generation model is not configured in settings');
  }
  const count = validated.count ?? config.defaultCount;
  const normalizedAspectRatio = normalizeImageAspectRatio(validated.aspectRatio);

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('count must be a positive integer');
  }
  if (count > config.maxCount) {
    throw new Error(`count must be less than or equal to ${config.maxCount}`);
  }

  return {
    request: validated,
    mainPrompt: definition.mainPrompt,
    instructionSystemPrompt: buildImageInstructionSystemPrompt(validated.feature),
    instructionStage: {
      model: visionModel,
      protocol: config.modelProtocol,
    },
    executionStage: {
      kind: definition.executionModel,
      model: executionModel,
      protocol: config.modelProtocol,
    },
    instructionImages: validated.images ?? [],
    executionImages: selectExecutionImages(validated),
    outputAspectRatio: normalizedAspectRatio?.aspectRatio,
    openaiImageSize: normalizedAspectRatio?.openaiSize,
    count,
  };
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

function selectExecutionImages(request: ImageTaskRequest) {
  const executionRoles = getExecutionImageRoles(request);
  return (request.images ?? []).filter((image) => executionRoles.includes(image.role));
}
