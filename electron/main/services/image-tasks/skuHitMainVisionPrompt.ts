import type { ImageInput, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import { stripJsonFence } from '../../../../src/shared/domain/replaceProductExecutionPrompt.js';
import { sanitizeRequestForInstruction } from './instructionPrompt.js';
import {
  buildSkuHitMainConstraintSpec,
  renderSkuHitMainExecutionPrompt,
} from './skuHitMainConstraintSpec.js';
import { isSkuHitMainImageFeature, orderHitMainExecutionImages } from './skuHitMainImagePrompt.js';

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;
const REFERENCE_COPY_WITH_HAN_PATTERN = /(?:reference|copy|headline|subheadline|marketing|text)[^.!?\n]{0,120}\p{Script=Han}/iu;

export interface SkuHitMainVisionBatch {
  instructions: Array<{
    index: number;
    prompt: string;
  }>;
}

const HIT_MAIN_BATCH_DIVERSITY_DIRECTIVES = [
  'Use a different product placement and headline block layout from the other outputs while keeping the same marketing promise.',
  'Keep the same cropped surface; only restyle the headline block and Before/After placement.',
  'Shift the information hierarchy, background space, and product-to-scene relationship while staying within the same product use case.',
] as const;

export function buildSkuHitMainVisionSystemPrompt(): string {
  return [
    'You are a US Temu / Amazon viral ecommerce main-image designer and visual prompt planner.',
    'You will receive Image 1 = new SKU product photo only and Image 2 = viral main-image reference. Do not swap them: Image 1 is never the ad layout, and Image 2 is never the product to keep.',
    'Return ONLY one JSON object with this exact shape: {"instructions":[{"index":1,"prompt":"..."}]}.',
    'The instructions array length must equal requested_count and indexes must start at 1 and be consecutive.',
    'Study Image 1 for exact SKU identity, packaging, label, brand, product name, capacity, physical appearance, and what the product is used for.',
    'Study Image 2 for before/after marketing structure, comparison intent, advertised use case, target object, general selling angle, and visible marketing copy in its original language.',
    'Image 1 controls SKU appearance and product understanding; Image 2 controls which scene objects, target, and marketing copy appear.',
    'Plan a simple 1:1 ecommerce main image: inherit Image 2 selling points and the same visible cropped surface; do not copy Image 2 layout, holding hand, or camera.',
    'Each prompt must be one English image-edit instruction in this exact order: action + target + modification detail + scope/position limit.',
    'Do not write a narrative design memo. Example when showProduct is true: Composite Image 1 SKU as a floating graphic cutout on Image 2’s visible cropped surface; keep Image 1 packaging pixel-identical without redrawing the bottle, standing it on any surface, copying the Image 2 holding hand, or adding a handheld second bottle, and add a simple Before/After of that same cropped surface; place the floating layer in unused space without covering the headline or comparison evidence.',
    'Example when showProduct is false: Remove every product bottle, brand logo, and wordmark; keep Image 2’s visible cropped surface, translated Image 2 headline, and a simple Before/After of that same surface; apply the change to the entire frame so no Image 1 packaging or logo appears.',
    'If structured_parameters.showProduct is false, do not overlay or mention a visible Image 1 SKU, brand logo, wordmark, or ® mark; otherwise composite Image 1 as one floating graphic cutout. Never stand the bottle on any surface, and never add a contact shadow under it.',
    'Read Image 1 for the product effect on that cropped surface, not to guess a larger host object. Keep the surface as a crop; do not complete it into any host object that Image 2 does not fully show.',
    'Preserve Image 2 headline meaning and use case, but render every visible word in correctly spelled English. Translate any Chinese reference or user copy to natural English. Never invent Chinese slogans or extra claims.',
    'Never borrow, merge, or transplant any cap, pump, trigger, nozzle, collar, bottle piece, label, or accessory from the Image 2 reference product; the Image 1 dispensing mechanism remains exact.',
    'Never plan a handheld bottle, a second SKU instance, or a hand gripping a redrawn product. Do not copy the Image 2 holding hand.',
    'If a hand appears, require five complete fingers, a visible thumb, and a natural wrist; the hand may only gesture or press toward the Image 2 target object.',
    'Never plan only recoloring, mirroring, swapping left/right, or moving the title slightly. Do not expand Image 2’s crop into a fuller environment.',
    'Every plan must include one simple Before/After of the same cropped surface. If Image 2 already shows a comparison, keep that logic but restyle it; if it does not, add a tight comparison of that same surface only. BEFORE problem must be obvious and AFTER improvement clear without fake material changes.',
    'Do not add extra scene objects or modules to look more designed. The headline itself must stay punchy: inherit Image 2 type energy (contrast, stack, color split, weight), not a flat single-color title.',
    'Keep the frame simple: one scene, one headline, one Before/After, and at most one SKU layer when showProduct is true. When showProduct is false, plan no SKU layer and no Image 1 brand or logo. Never plan a separate brand logo or wordmark outside the SKU cutout. Do not plan extra info blocks, icon rows, callout stacks, or collage modules.',
    'If structured_parameters.headline is present, that is the only on-image title; translate it to correctly spelled English if needed and ignore Image 2 headline wording. Otherwise use only Image 2 reference wording or explicitly supplied user copy, rendered in correctly spelled English. Match Image 2 headline energy with size, line breaks, hierarchy, weight, and color contrast; never invent Chinese headlines, extra claims, or fake English.',
    'When showProduct is true, every visible capacity must use the exact prefix "NET:". When showProduct is false, do not render capacity, brand, or logo.',
    'If structured_parameters include both prompt and negativePrompt, negativePrompt outranks prompt on conflict and must appear as forbidden elements in every plan.',
    'Return the edit instruction in English. Quoted on-image copy must also be English; translate Chinese quotes before using them.',
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
      ? 'Create 1 English image-edit instruction from the attached images, in this order: action + target + modification detail + scope/position limit.'
      : `Create one batch with ${count} independent English image-edit instructions from the attached images, each in this order: action + target + modification detail + scope/position limit.`,
    JSON.stringify({
      feature: request.feature,
      requested_count: count,
      image_roles: [
        { index: 1, role: 'source', purpose: 'new SKU product; exact packaging and physical identity authority' },
        { index: 2, role: 'reference', purpose: 'viral main-image reference; headline, advertised use case, target object, selling angle, and before/after authority' },
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

export function parseSkuHitMainVisionBatch(
  raw: string,
  expectedCount: number,
  showProduct = true,
): SkuHitMainVisionBatch {
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
  }

  return {
    instructions: instructions.map((instruction) => ({
      index: instruction.index,
      prompt: normalizeHitMainPlannerPrompt(instruction.prompt, instruction.index, showProduct),
    })),
  };
}

function normalizeHitMainPlannerPrompt(prompt: string, index: number, showProduct = true) {
  const trimmed = prompt.trim();
  if (!HAN_CHARACTER_PATTERN.test(trimmed) || REFERENCE_COPY_WITH_HAN_PATTERN.test(trimmed)) {
    return trimmed;
  }

  return showProduct
    ? `Composite Image 1 SKU as a floating graphic cutout on Image 2’s visible cropped surface for batch output ${index}; keep Image 1 packaging pixel-identical without redrawing the bottle, standing it on any surface, copying the Image 2 holding hand, or adding a handheld second bottle, and add a simple Before/After of that same cropped surface; place the floating layer in unused space without covering the headline or comparison evidence.`
    : `Remove every product bottle, brand logo, and wordmark for batch output ${index}; keep Image 2’s visible cropped surface, Image 2 headline, and a simple Before/After of that same surface; apply the change to the entire frame so no Image 1 packaging, logo, or holding hand appears.`;
}

export function finalizeSkuHitMainVisionInstruction(
  request: ImageTaskRequest,
  plannedInstruction: string,
): string {
  const spec = buildSkuHitMainConstraintSpec(request);
  return renderSkuHitMainExecutionPrompt(spec, plannedInstruction);
}

export function buildHitMainVisionImageParts(executionImages: ImageInput[]) {
  const ordered = orderHitMainExecutionImages(executionImages);
  return ordered.map((image, index) => ({
    image,
    caption: index === 0
      ? 'Image 1: new SKU product photo only, not the ad layout'
      : 'Image 2: viral ecommerce main-image reference for selling points and scene type only',
  }));
}

export function assertSkuHitMainVisionFeature(feature: ImageTaskRequest['feature']) {
  if (!isSkuHitMainImageFeature(feature)) {
    throw new Error(`buildSkuHitMainVisionSystemPrompt does not support feature ${feature}`);
  }
}
