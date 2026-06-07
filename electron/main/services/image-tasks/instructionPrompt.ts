import type { ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ModelInstructionClientInput } from './modelGateway.js';

const IMAGE_GENERATION_MODEL_PATTERN = /gpt-image|flash-image|dall-?e/i;

export function isImageGenerationModel(modelId: string) {
  return IMAGE_GENERATION_MODEL_PATTERN.test(modelId);
}

export function sanitizeRequestForInstruction(request: ImageTaskRequest) {
  const { count: _count, ...rest } = request;
  return rest;
}

export function buildInstructionUserText(input: ModelInstructionClientInput) {
  return [
    `feature: ${input.task.feature}`,
    `mainPrompt: ${input.plan.mainPrompt}`,
    `request: ${JSON.stringify(sanitizeRequestForInstruction(input.task.request))}`,
    'Return only the final image instruction text for ONE standalone output image.',
  ].join('\n');
}

export function buildFallbackFinalPrompt(input: ModelInstructionClientInput) {
  const request = input.task.request;
  const segments = [input.plan.mainPrompt];

  if (request.prompt?.trim()) {
    segments.push(request.prompt.trim());
  }
  if (request.productName?.trim()) {
    segments.push(`Product name: ${request.productName.trim()}`);
  }
  if (request.productCategory?.trim()) {
    segments.push(`Product category: ${request.productCategory.trim()}`);
  }
  if (request.logoText?.trim()) {
    segments.push(`Logo text: ${request.logoText.trim()}`);
  }
  if (request.colorScheme?.trim()) {
    segments.push(`Color scheme: ${request.colorScheme.trim()}`);
  }
  if (request.aspectRatio?.trim()) {
    segments.push(`Aspect ratio: ${request.aspectRatio.trim()}`);
  }
  if (request.sellingPoints?.length) {
    segments.push(`Selling points: ${request.sellingPoints.join(', ')}`);
  }

  return segments.join(' ');
}
