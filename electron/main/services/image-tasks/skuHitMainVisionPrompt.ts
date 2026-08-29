import type { ImageInput, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import { stripJsonFence } from '../../../../src/shared/domain/replaceProductExecutionPrompt.js';
import { sanitizeRequestForInstruction } from './instructionPrompt.js';
import {
  isSkuHitMainImageFeature,
  orderHitMainExecutionImages,
} from './skuHitMainImagePrompt.js';

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;

export interface SkuHitMainVisionBatch {
  instructions: Array<{
    index: number;
    prompt: string;
  }>;
}

const HIT_MAIN_BATCH_DIVERSITY_DIRECTIVES = [
  'Use a different product placement and headline block layout from the other outputs while keeping the same marketing promise.',
  'Rebuild the usage scene with a new camera angle, scene depth, and before/after presentation structure.',
  'Shift the information hierarchy, background space, and product-to-scene relationship while staying within the same product use case.',
] as const;

export function buildSkuHitMainVisionSystemPrompt(): string {
  return [
    'You are the visual prompt planner for a US Temu / Amazon viral ecommerce main-image task.',
    'You will receive Image 1 = viral main-image reference and Image 2 = new SKU product image.',
    'Return ONLY one JSON object with this exact shape: {"instructions":[{"index":1,"prompt":"..."}]}.',
    'The instructions array length must equal requested_count and indexes must start at 1 and be consecutive.',
    'Study Image 1 for marketing theme, core English headline/subheadline, usage-scene type, selling logic, and before/after intent.',
    'Study Image 2 as the only allowed SKU identity. Never redesign, stretch, recolor, or reinterpret the SKU container or label.',
    'Plan a visibly new 1:1 ecommerce main image: inherit Image 1 selling points, never inherit Image 1 layout, scene objects, camera angle, or composition.',
    'Each prompt must be a complete English instruction for an image editing model, not an explanation or design memo.',
    'Each prompt must require replacing Image 1 product with Image 2 SKU, preserving Image 2 packaging exactly.',
    'Each prompt must change at least 3 differentiation dimensions such as product placement, product scale, headline placement, scene composition, camera angle, depth, before/after layout, info-block layout, background structure, or product-scene relationship.',
    'Never plan only recoloring, mirroring, swapping left/right, moving the title slightly, or reusing the same scene objects and camera angle from Image 1.',
    'Keep Image 1 usage-scene type and target object, but recreate the concrete scene assets, props, damage/repair areas, and viewpoints.',
    'If Image 1 includes before/after repair logic, preserve that marketing logic but redesign the comparison format.',
    'Keep core English marketing copy from Image 1 unless structured user fields override matching words.',
    'Every visible capacity in the planned output must use the exact prefix "NET:".',
    'Return every execution prompt in English only.',
    'For batches, return every instruction in one JSON response and follow batch_diversity_plan when provided.',
  ].join('\n');
}

export function buildSkuHitMainVisionUserText(request: ImageTaskRequest, count: number): string {
  const structuredParameters = sanitizeRequestForInstruction({
    ...request,
    count,
    variantIndex: undefined,
    variantTotal: undefined,
  });
  const batchDiversityPlan = buildSkuHitMainBatchDiversityPlan(count);

  return [
    count === 1
      ? 'Create 1 English viral-main-image execution prompt from the attached images.'
      : `Create one batch with ${count} independent English viral-main-image execution prompts from the attached images.`,
    JSON.stringify({
      feature: request.feature,
      requested_count: count,
      image_roles: [
        { index: 1, role: 'reference', purpose: 'viral main-image reference; inherit marketing copy and use-case only' },
        { index: 2, role: 'source', purpose: 'new SKU product; exact packaging identity to insert' },
      ],
      structured_parameters: Object.keys(structuredParameters).length > 0
        ? structuredParameters
        : undefined,
      ...(batchDiversityPlan ? { batch_diversity_plan: batchDiversityPlan } : {}),
    }, null, 2),
  ].join('\n\n');
}

export function buildSkuHitMainBatchDiversityPlan(count: number) {
  if (count <= 1) {
    return undefined;
  }

  return Array.from({ length: count }, (_, index) => ({
    index: index + 1,
    diversity_directive: HIT_MAIN_BATCH_DIVERSITY_DIRECTIVES[index % HIT_MAIN_BATCH_DIVERSITY_DIRECTIVES.length]!,
  }));
}

export function parseSkuHitMainVisionBatch(raw: string, expectedCount: number): SkuHitMainVisionBatch {
  const parsed = JSON.parse(stripJsonFence(raw)) as {
    instructions?: SkuHitMainVisionBatch['instructions'];
  };

  if (!Array.isArray(parsed.instructions) || parsed.instructions.length !== expectedCount) {
    throw new Error(`vision model returned invalid hit-main instruction batch; expected ${expectedCount} prompts`);
  }

  const instructions = [...parsed.instructions].sort((left, right) => left.index - right.index);
  for (let index = 0; index < expectedCount; index += 1) {
    const instruction = instructions[index];
    if (!instruction || instruction.index !== index + 1 || typeof instruction.prompt !== 'string' || !instruction.prompt.trim()) {
      throw new Error(`vision model missing hit-main prompt for index ${index + 1}`);
    }
    if (HAN_CHARACTER_PATTERN.test(instruction.prompt)) {
      throw new Error('vision model must return English-only hit-main execution prompts');
    }
  }

  return {
    instructions: instructions.map((instruction) => ({
      index: instruction.index,
      prompt: instruction.prompt.trim(),
    })),
  };
}

export function finalizeSkuHitMainVisionInstruction(
  _request: ImageTaskRequest,
  plannedInstruction: string,
): string {
  return plannedInstruction.trim();
}

export function buildHitMainVisionImageParts(executionImages: ImageInput[]) {
  const ordered = orderHitMainExecutionImages(executionImages);
  return ordered.map((image, index) => ({
    image,
    caption: index === 0
      ? 'Image 1: viral ecommerce main-image reference'
      : 'Image 2: new SKU product to insert',
  }));
}

export function assertSkuHitMainVisionFeature(feature: ImageTaskRequest['feature']) {
  if (!isSkuHitMainImageFeature(feature)) {
    throw new Error(`buildSkuHitMainVisionSystemPrompt does not support feature ${feature}`);
  }
}
