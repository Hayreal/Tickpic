import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ModelInstructionClientInput } from './modelGateway.js';

const REMOVE_PRODUCT_EXECUTION_GUARDRAILS = [
  'Use the uploaded source image as the fixed base layer.',
  'Inpaint only the removed target product area.',
  'Keep every pixel outside the removed target unchanged: same background, scene, props, lighting, colors, perspective, canvas, framing, and all original text and graphics.',
  'Do not replace the background, regenerate the scene, retouch unrelated areas, crop, zoom, reframe, or add any product or object.',
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
    return `Remove only the specified product object from the source image: ${request.prompt.trim()}`;
  }
  if (request.regions?.length) {
    return 'Remove only the product object inside the user-selected rectangular region.';
  }
  return 'Remove only the specified target product from the source image.';
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
