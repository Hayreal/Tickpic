import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ModelInstructionClientInput } from './modelGateway.js';

const REMOVE_PRODUCT_EXECUTION_GUARDRAILS = [
  'Use the source image as the base.',
  'Inpaint only where the removed product blocked the scene.',
  'Match the inpainted area to the adjacent background material, texture, color, lighting, dirt, and wear.',
  'Preserve stains, wear, staged demonstration states, and before/after effects on the scene background.',
  'Do not clean, polish, restore, retouch, or beautify any unrelated area.',
  'Do not replace the background, crop, reframe, or add new objects.',
] as const;

const IMAGE_GENERATION_MODEL_PATTERN = /gpt-image|flash-image|dall-?e/i;

export function isImageGenerationModel(modelId: string) {
  return IMAGE_GENERATION_MODEL_PATTERN.test(modelId);
}

function compactInstructionParameters(request: ImageTaskRequest) {
  const {
    count: _count,
    feature: _feature,
    images: _images,
    aspectRatio,
    ...rest
  } = request;

  const parameters: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    parameters[key] = value;
  }

  if (aspectRatio && aspectRatio !== 'auto') {
    parameters.aspectRatio = aspectRatio;
  }

  return parameters;
}

export function sanitizeRequestForInstruction(request: ImageTaskRequest) {
  return compactInstructionParameters(request);
}

export function buildInstructionUserText(input: ModelInstructionClientInput) {
  const parameters = compactInstructionParameters(input.task.request);
  const lines = [`feature: ${input.task.feature}`];

  if (input.plan.mainPrompt?.trim()) {
    lines.push(`taskGoal: ${input.plan.mainPrompt.trim()}`);
  }

  if (Object.keys(parameters).length > 0) {
    lines.push(`parameters: ${JSON.stringify(parameters)}`);
  }

  lines.push('Return only the final image instruction text for ONE standalone output image.');
  return lines.join('\n');
}

function buildRemoveProductDefaultInstruction(request: ImageTaskRequest) {
  if (request.prompt?.trim()) {
    return `Remove the target product from the source image and inpaint only the occluded area: ${request.prompt.trim()}`;
  }
  if (request.regions?.length) {
    return 'Remove the product inside the user-selected region and inpaint only the occluded area behind it.';
  }
  return 'Remove the target product object and any spray or hand directly attached to it. Inpaint only the occluded area to match the adjacent background. Do not clean or restore any other part of the scene.';
}

export function finalizeImageInstruction(
  feature: ImageFeature,
  instruction: string,
  request: ImageTaskRequest,
) {
  const trimmed = instruction.trim();

  if (feature === 'remove_product') {
    const target = trimmed || buildRemoveProductDefaultInstruction(request);
    return `${target} ${REMOVE_PRODUCT_EXECUTION_GUARDRAILS.join(' ')}`.trim();
  }

  return trimmed;
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
