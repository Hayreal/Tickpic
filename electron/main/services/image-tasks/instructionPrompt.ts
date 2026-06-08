import {
  getImageFeatureDefinition,
  type ImageFeature,
  type ImageTaskRequest,
} from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ModelInstructionClientInput } from './modelGateway.js';

const REMOVE_PRODUCT_EXECUTION_SUFFIX =
  'Inpaint only the removed area to match adjacent background; keep everything else unchanged.';

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
  const request = input.task.request;
  const parameters = compactInstructionParameters(request);
  const taskGoal = input.plan.mainPrompt?.trim();
  const userPrompt = typeof parameters.prompt === 'string' ? parameters.prompt.trim() : '';
  const { prompt: _prompt, ...otherParameters } = parameters;
  const isEdit = getImageFeatureDefinition(input.task.feature).executionModel === 'edit';
  const lines = [
    isEdit
      ? `Write one concise English image-edit instruction for "${input.task.feature}".`
      : `Write a concise English image-generation instruction for "${input.task.feature}".`,
  ];

  if (taskGoal) {
    lines.push(`Goal: ${taskGoal}`);
  }

  if (userPrompt) {
    lines.push(`User note: ${userPrompt}`);
  }

  if (request.regions?.length) {
    lines.push(`Selection: ${request.regions.length} rectangular region(s) provided.`);
  }

  if (Object.keys(otherParameters).length > 0) {
    lines.push(`Extra: ${JSON.stringify(otherParameters)}`);
  }

  lines.push(
    isEdit
      ? 'Return one short executable sentence only, ideally under 35 words. No markdown or explanation.'
      : 'Return one or two short executable sentences, ideally under 60 words total. No markdown or explanation.',
  );
  return lines.join('\n');
}

function buildRemoveProductDefaultInstruction(request: ImageTaskRequest) {
  if (request.prompt?.trim()) {
    return `Remove the target product (${request.prompt.trim()}) and inpaint only the occluded area.`;
  }
  if (request.regions?.length) {
    return 'Remove the product in the selected region and inpaint only the occluded area.';
  }
  return 'Remove the target product and inpaint only the occluded area.';
}

export function finalizeImageInstruction(
  feature: ImageFeature,
  instruction: string,
  request: ImageTaskRequest,
) {
  const trimmed = instruction.trim();

  if (feature === 'remove_product') {
    const target = trimmed || buildRemoveProductDefaultInstruction(request);
    if (target.includes(REMOVE_PRODUCT_EXECUTION_SUFFIX)) {
      return target;
    }
    return `${target} ${REMOVE_PRODUCT_EXECUTION_SUFFIX}`.trim();
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
