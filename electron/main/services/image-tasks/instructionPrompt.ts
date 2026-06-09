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
  'Output only the extracted flat 2D sticker/label; no product body, bottle, box, jar, packaging mockup, or collage.';

const STICKER_REPLICA_FLAT_OUTPUT_PATTERN =
  /flat 2d|2d flat|packaging mockup|product body|bottle|box|jar|collage/i;

const STICKER_VARIATION_REDESIGN_SUFFIX =
  'make a clearly different layout, not a small text, icon, suit, or color swap';

const STICKER_VARIATION_REDESIGN_PATTERN =
  /clearly different layout|not a small (?:text|icon|suit|color) swap/i;

const IMAGE_GENERATION_MODEL_PATTERN = /gpt-image|flash-image|dall-?e/i;

const FEATURE_USER_TEXT_INTROS: Record<ImageFeature, string> = {
  sticker_replica: '提取上传图片中产品上的贴纸，输出独立 2D 平面贴纸。',
  sticker_variation: '参考上传的贴纸图，生成一张同品类氛围的新 2D 平面贴纸。',
  sticker_original: '根据产品信息和参考方向，生成一张原创 2D 平面包装贴纸。',
  remove_product: '参考上传的图片，移除目标产品并自然补全背景。',
  replace_product: '参考上传的图片，用目标产品替换画面中的原产品。',
  replace_logo: '参考上传的图片，只替换画面中的品牌 Logo。',
  main_image_asset_variation: '参考上传的主图素材，生成一张电商主图或广告素材变体。',
  scene_variation: '参考上传的场景图，生成一张同品类的真实使用场景变体。',
  create_new_scene: '根据产品品类和场景方向，创建一张真实的电商使用场景图。',
  prompt_only_main_asset: '根据文本提示创建一张电商主图或广告素材。',
};

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
  const lines = [FEATURE_USER_TEXT_INTROS[input.task.feature]];
  const userPrompt = request.prompt?.trim();

  if (userPrompt) {
    lines.push(`补充要求：${userPrompt}`);
  }

  lines.push(...buildStructuredParameterLines(request));

  if (input.task.feature === 'sticker_replica' && hasSeparateLogoImage(request)) {
    lines.push(
      '如果提供了单独 Logo 图，只把它作为品牌标识嵌入，不要把 Logo 图当作版式参考。',
    );
  }

  return lines.join('\n');
}

function buildStructuredParameterLines(request: ImageTaskRequest) {
  const lines: string[] = [];
  const productName = request.productName?.trim();
  const productCategory = request.productCategory?.trim();
  const logoText = request.logoText?.trim();
  const colorScheme = request.colorScheme?.trim();
  const capacity = request.capacity?.trim();
  const aspectRatio = request.aspectRatio?.trim();
  const sellingPoints = request.sellingPoints
    ?.map((point) => point.trim())
    .filter(Boolean);

  if (productName) {
    lines.push(request.feature === 'sticker_replica'
      ? `品牌名换成 ${productName}。`
      : `产品名称是 ${productName}。`);
  }

  if (productCategory) {
    lines.push(`产品品类是 ${productCategory}。`);
  }

  if (sellingPoints?.length) {
    lines.push(`卖点包括 ${sellingPoints.join('、')}。`);
  }

  if (capacity) {
    lines.push(`容量/规格是 ${capacity}。`);
  }

  if (logoText) {
    lines.push(`Logo 文案是 ${logoText}。`);
  }

  if (colorScheme) {
    lines.push(request.images?.some((image) => image.role === 'source')
      ? `整体保留原图的 ${colorScheme} 风格。`
      : `配色方向是 ${colorScheme}。`);
  }

  if (aspectRatio && aspectRatio !== 'auto') {
    lines.push(`输出比例是 ${aspectRatio}。`);
  }

  if (typeof request.showProduct === 'boolean') {
    lines.push(request.showProduct ? '需要展示产品。' : '不要展示产品。');
  }

  if (request.regions?.length) {
    lines.push(`只处理已选择的 ${request.regions.length} 个矩形区域。`);
    const regionHints = request.regions
      .map((region) => region.operationHint?.trim())
      .filter((hint): hint is string => Boolean(hint));
    if (regionHints.length) {
      lines.push(`选区要求：${regionHints.join('；')}。`);
    }
  }

  return lines;
}

function hasSeparateLogoImage(request: ImageTaskRequest) {
  return request.images?.some((image) => image.role === 'logo' || image.role === 'reference') ?? false;
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
  sticker_replica: 'Edit the source image to extract',
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

function finalizeStickerVariationInstruction(instruction: string) {
  const trimmed = instruction.trim();
  if (STICKER_VARIATION_REDESIGN_PATTERN.test(trimmed)) {
    return trimmed;
  }
  const core = trimmed.replace(/\s*\.?\s*$/, '').trim();
  return `${core}; ${STICKER_VARIATION_REDESIGN_SUFFIX}.`;
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

  if (feature === 'sticker_variation') {
    return finalizeStickerVariationInstruction(normalized);
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
