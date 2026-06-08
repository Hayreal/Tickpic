import {
  getImageFeatureDefinition,
  type ImageFeature,
  type ImageTaskRequest,
} from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ModelInstructionClientInput } from './modelGateway.js';

const REMOVE_PRODUCT_SPRAY_PREFIX =
  'First fully erase foreground spray/mist overlays, not only behind the bottle. ';

const REMOVE_PRODUCT_EXECUTION_SUFFIX =
  'Inpaint removed areas to match adjacent background; keep everything else unchanged.';

const LEGACY_REMOVE_PRODUCT_FRAGMENTS = [
  'First fully erase every foreground spray, mist, fog, haze, vapor trail, and droplet overlay on the scene—not only areas behind the removed bottle or hand.',
  REMOVE_PRODUCT_SPRAY_PREFIX.trim(),
  'Inpaint only the removed area to match adjacent background; keep everything else unchanged.',
  'Also remove product-emitted spray or mist; inpaint removed areas to match adjacent background; keep everything else unchanged.',
  'Erase all spray, mist, fog, haze, and droplet overlays; inpaint to match adjacent surfaces; keep headline text and surface before/after states unchanged.',
  'Then inpaint only where the product blocked the background; keep headline text and surface before/after states unchanged.',
  REMOVE_PRODUCT_EXECUTION_SUFFIX,
] as const;

const REMOVE_PRODUCT_EMISSION_PATTERN =
  /\b(?:spray|mist|foam|fog|vapor|aerosol|haze|droplets?)\b|paint stream|emitted from|from the (?:nozzle|product)|product-emitted|overlays?/i;

const REMOVE_PRODUCT_OCCLUSION_ONLY_PATTERN =
  /inpaint(?:ing)? only (?:their |the )?occluded/i;

const STICKER_REPLICA_EXECUTION_SUFFIX =
  'Output a flat 2D packaging sticker/label only; keep a similar rectangular layout from the source label; no box mockup, bottle, jar, or circular collage.';

const STICKER_REPLICA_FLAT_OUTPUT_PATTERN =
  /flat 2d|2d flat|packaging mockup|circular (?:badge|collage)|box mockup/i;

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
    const regionHints = request.regions
      .map((region) => region.operationHint?.trim())
      .filter((hint): hint is string => Boolean(hint));
    if (regionHints.length > 0) {
      lines.push(`Region hints: ${regionHints.join('; ')}`);
    }
  }

  if (input.task.feature === 'sticker_replica') {
    const hasLogoImage = request.images?.some((image) => image.role === 'logo' || image.role === 'reference');
    if (hasLogoImage) {
      lines.push(
        'The source image is the packaging/sticker layout reference; the separate logo image is only the brand mark to place—do not replicate the logo image as the sticker layout.',
      );
    }
  }

  if (Object.keys(otherParameters).length > 0) {
    lines.push(`Extra: ${JSON.stringify(otherParameters)}`);
  }

  if (isEdit) {
    lines.push(
      'The downstream model performs in-place image editing on the provided source image(s); use edit/transform/extract verbs, not create or generate.',
    );
  }

  lines.push(
    isEdit
      ? 'Return one short executable sentence only, ideally under 35 words. No markdown or explanation.'
      : 'Return one or two short executable sentences, ideally under 60 words total. No markdown or explanation.',
  );
  return lines.join('\n');
}

function stripLegacyRemoveProductFragments(instruction: string) {
  let result = instruction.trim();
  for (const fragment of LEGACY_REMOVE_PRODUCT_FRAGMENTS) {
    while (result.includes(fragment)) {
      result = result.replace(fragment, '').trim();
    }
  }
  return result.replace(/\s{2,}/g, ' ').replace(/[,.;\s]+$/, '').trim();
}

function fixOcclusionOnlyWording(instruction: string) {
  if (!REMOVE_PRODUCT_OCCLUSION_ONLY_PATTERN.test(instruction)) {
    return instruction;
  }

  return instruction.replace(
    /inpaint(?:ing)? only (?:their |the )?occluded areas/gi,
    'inpaint where the product blocked the background',
  );
}

function clarifyRemoveProductDemonstration(instruction: string) {
  const removesEmission = REMOVE_PRODUCT_EMISSION_PATTERN.test(instruction);
  const preservesDemo = /demonstration effects?/i.test(instruction);
  if (removesEmission && preservesDemo && !/spray overlays? are not/i.test(instruction)) {
    return `${instruction.replace(/\.\s*$/, '')}; spray and mist overlays are not demonstration effects`;
  }
  return instruction;
}

function buildRemoveProductDefaultInstruction(request: ImageTaskRequest) {
  if (request.prompt?.trim()) {
    return `Remove the product and any spray or mist overlays (${request.prompt.trim()}).`;
  }
  if (request.regions?.length) {
    return 'Remove the product and any spray or mist overlays in the selected region.';
  }
  return 'Remove the product and any spray or mist overlays.';
}

function mentionsSprayOverlay(instruction: string) {
  if (/\b(?:mist|foam|fog|vapor|aerosol|haze|droplets?)\b/i.test(instruction)) {
    return true;
  }
  if (/\b(?:white |foreground )(?:spray|mist|fog)\b/i.test(instruction)) {
    return true;
  }
  if (/\b(?:spray|mist|fog|haze).{0,8}overlays?\b/i.test(instruction)) {
    return true;
  }
  if (/\b(?:erase|remove) (?:all |every )?(?:foreground )?(?:spray|mist|fog|haze)\b/i.test(instruction)) {
    return true;
  }
  return /product-emitted|from the (?:nozzle|product)/i.test(instruction);
}

function needsSprayPrefix(instruction: string) {
  return !mentionsSprayOverlay(instruction);
}

const EDIT_GENERATION_VERB_PATTERN = /^(?:create|generate|design)\b/i;

const EDIT_VERB_REPLACEMENTS: Partial<Record<ImageFeature, string>> = {
  sticker_replica: 'Edit the source packaging label to extract',
  sticker_variation: 'Edit the source sticker to produce',
  remove_product: 'Edit the source image to remove',
  replace_product: 'Edit the source image to replace',
  replace_logo: 'Edit the source image to replace',
  main_image_asset_variation: 'Edit the source main image to produce',
  scene_variation: 'Edit the source scene to produce',
};

function normalizeEditInstructionVerbs(instruction: string, feature: ImageFeature) {
  if (!EDIT_GENERATION_VERB_PATTERN.test(instruction)) {
    return instruction;
  }

  const replacement = EDIT_VERB_REPLACEMENTS[feature] ?? 'Edit the source image to';
  return instruction.replace(EDIT_GENERATION_VERB_PATTERN, replacement);
}

function finalizeStickerReplicaInstruction(instruction: string) {
  const trimmed = instruction.trim();
  if (STICKER_REPLICA_FLAT_OUTPUT_PATTERN.test(trimmed)) {
    return trimmed;
  }
  const core = trimmed.replace(/\s*\.?\s*$/, '').trim();
  return `${core}. ${STICKER_REPLICA_EXECUTION_SUFFIX}`;
}

export function finalizeImageInstruction(
  feature: ImageFeature,
  instruction: string,
  request: ImageTaskRequest,
) {
  const trimmed = instruction.trim();
  const isEdit = getImageFeatureDefinition(feature).executionModel === 'edit';
  const normalized = isEdit ? normalizeEditInstructionVerbs(trimmed, feature) : trimmed;

  if (feature === 'sticker_replica') {
    return finalizeStickerReplicaInstruction(normalized);
  }

  if (feature === 'remove_product') {
    const core = clarifyRemoveProductDemonstration(
      fixOcclusionOnlyWording(
        stripLegacyRemoveProductFragments(normalized || buildRemoveProductDefaultInstruction(request)),
      ),
    );
    const prefix = needsSprayPrefix(core) ? REMOVE_PRODUCT_SPRAY_PREFIX : '';
    return `${prefix}${core}. ${REMOVE_PRODUCT_EXECUTION_SUFFIX}`.trim();
  }

  return normalized;
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
