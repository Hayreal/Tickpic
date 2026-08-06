import {
  getImageFeatureDefinition,
  type ImageFeature,
  type ImageTaskRequest,
} from '../../../../src/shared/domain/imageFeatureApi.js';
import { appendEnglishOnlyVisibleTextRule } from '../../../../src/shared/domain/imageOutputRules.js';
import { getStickerVariationDirection } from '../../../../src/shared/domain/stickerPrompts.js';
import {
  resolveStickerProductRatio,
  stickerProductRatioLabel,
} from '../../../../src/shared/view/stickerProductRatioOptions.js';
import { buildStickerExecutionPrompt, isStickerFeature } from './stickerExecutionPrompt.js';
interface ExecutionPromptAssemblyInput {
  task: { feature: ImageFeature; request: ImageTaskRequest };
  plan: { mainPrompt: string };
}

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

const STICKER_REPLICA_LOGO_GUIDANCE =
  '如果提供了单独 Logo 图，只把它作为品牌标识嵌入，不要把 Logo 图当作版式参考。';

const MAIN_IMAGE_ASSET_VARIATION_REDESIGN_SUFFIX =
  'use a clearly different scene, headline layout, or hero composition from the source; not a minor color tweak, crop, or collage';

const MAIN_IMAGE_ASSET_VARIATION_REDESIGN_PATTERN =
  /明显不同|clearly different scene|not a minor color tweak|collage/i;

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

export function buildExecutionPrompt(request: ImageTaskRequest, mainPrompt: string) {
  if (isStickerFeature(request.feature)) {
    return buildStickerExecutionPrompt(request);
  }

  const lines = [mainPrompt.trim()];
  const isProductSet = isProductSetFeature(request.feature);
  const productSetLines = isProductSet ? buildProductSetControlLines(request) : [];
  const structuredLines = buildStructuredParameterLines(request);
  const variantLine = buildVariantLine(request);
  const userPrompt = request.prompt?.trim();
  const scenePrompt = request.scenePrompt?.trim();
  const negativePrompt = request.negativePrompt?.trim();

  if (isProductSet) {
    lines.push(...productSetLines, ...structuredLines);
    if (scenePrompt || userPrompt || negativePrompt) {
      lines.push(PRODUCT_SET_CONFLICT_PRIORITY_GUARD);
    }
    if (scenePrompt) {
      lines.push(`具体场景：${scenePrompt}`);
    }
    if (userPrompt) {
      lines.push(`补充要求：${userPrompt}`);
    }
    if (negativePrompt) {
      lines.push(`反向要求：避免出现以下内容：${negativePrompt}`);
    }
    if (variantLine) {
      lines.push(variantLine);
    }
  } else {
    if (userPrompt) {
      lines.push(`补充要求：${userPrompt}`);
    }
    lines.push(...structuredLines);
    if (variantLine) {
      lines.push(variantLine);
    }
  }

  if (
    request.feature === 'sticker_replica'
    && hasSeparateLogoImage(request)
    && !hasStickerReplicaLogoGuidance(mainPrompt)
  ) {
    lines.push(STICKER_REPLICA_LOGO_GUIDANCE);
  }

  return appendEnglishOnlyVisibleTextRule(lines.join('\n'));
}

export function buildInstructionUserText(input: ExecutionPromptAssemblyInput) {
  return buildExecutionPrompt(input.task.request, input.plan.mainPrompt);
}

function buildStructuredParameterLines(request: ImageTaskRequest) {
  const lines: string[] = [];
  const productName = request.productName?.trim();
  const productCategory = request.productCategory?.trim();
  const brand = request.brand?.trim();
  const logoText = request.logoText?.trim();
  const material = request.material?.trim();
  const style = request.style?.trim();
  const colorBlockLayout = request.colorBlockLayout?.trim();
  const colorScheme = request.colorScheme?.trim();
  const stickerVariationDirection = getStickerVariationDirection(request.stickerVariationDirection);
  const capacity = request.capacity?.trim();
  const sellingPoints = request.sellingPoints
    ?.map((point) => point.trim())
    .filter(Boolean);

  if (brand) {
    lines.push(`品牌是 ${brand}。`);
  }

  if (productName) {
    lines.push(`产品名称是 ${productName}。`);
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

  if (material) {
    lines.push(`素材要求是 ${material}。`);
  }

  if (style) {
    lines.push(`风格是 ${style}。`);
  }

  if (colorBlockLayout) {
    lines.push(`色块排版要求是 ${colorBlockLayout}。`);
  }

  if (request.feature === 'sticker_variation' && stickerVariationDirection) {
    lines.push(`贴纸裂变方向是${stickerVariationDirection.label}。`);
    lines.push(stickerVariationDirection.prompt);
  }

  if (logoText) {
    lines.push(`Logo 文案是 ${logoText}。`);
  }

  if (colorScheme) {
    lines.push(request.images?.some((image) => image.role === 'source')
      ? `整体保留原图的 ${colorScheme} 风格。`
      : `配色方向是 ${colorScheme}。`);
  }

  const productRatio = resolveStickerProductRatio(request.productRatio);
  if (productRatio) {
    lines.push(`输出的产品包装图长宽比是 ${productRatio}（${stickerProductRatioLabel(productRatio)}）。`);
  }

  if (typeof request.showProduct === 'boolean' && !isProductSetFeature(request.feature)) {
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

const PRODUCT_SET_CONFLICT_PRIORITY_GUARD = '优先级规则：用户具体场景、补充要求和反向要求仅执行不与前述功能硬规则及结构化控制项冲突的部分；发生冲突时必须忽略用户冲突内容，以前述规则为准。';

function buildVariantLine(request: ImageTaskRequest) {
  if (request.variantIndex !== undefined && request.variantTotal !== undefined) {
    return `这是本批次第 ${request.variantIndex}/${request.variantTotal} 张。生成与同批其他图片明显不同的场景或构图，同时遵守当前功能的全部固定规则。`;
  }
  return undefined;
}

function isProductSetFeature(feature: ImageFeature) {
  return feature === 'product_main_image'
    || feature === 'product_comparison_image'
    || feature === 'product_multi_scene';
}

function buildProductSetControlLines(request: ImageTaskRequest) {
  switch (request.feature) {
    case 'product_main_image':
      return [
        productHandheldModeLines[request.productHandheldMode ?? 'not_handheld'],
        productEffectModeLines[request.productEffectMode ?? 'auto'],
      ];
    case 'product_comparison_image':
      return [
        comparisonLayoutLines[request.comparisonLayout ?? 'auto'],
        comparisonIntensityLines[request.comparisonIntensity ?? 'medium'],
        request.showProduct === false ? 'After 只展示改善效果，不展示 SKU。' : 'After 必须展示 SKU。',
      ];
    case 'product_multi_scene':
      return [multiSceneLayoutLines[request.multiSceneLayout ?? 'single']];
    default:
      return [];
  }
}

const productHandheldModeLines = {
  handheld: '必须出现自然的人手持有或操作 SKU。',
  not_handheld: 'SKU 不得由手持有，可放置在场景主体位置。',
} as const;

const productEffectModeLines = {
  auto: '根据 SKU 类型决定是否展示具体作用效果。',
  show: '必须明确表现与 SKU 对应的作用过程或效果。',
  hide: '只展示产品和适用环境，不展示作用过程或效果演示。',
} as const;

const comparisonLayoutLines = {
  auto: '根据比例和构图选择左右或上下布局。',
  horizontal: 'Before 左、After 右。',
  vertical: 'Before 上、After 下。',
} as const;

const comparisonIntensityLines = {
  light: '前后差异自然克制。',
  medium: '前后差异清晰且可信。',
  heavy: '强化视觉反差，但不得虚构产品无法支持的效果。',
} as const;

const multiSceneLayoutLines = {
  single: '每张只展示一个完整场景。',
  collage: '一张图组合多个适用场景，允许不规则拼贴，各区域边界清晰。',
  grid: '一张图使用规则网格展示多个适用场景。',
} as const;

function hasSeparateLogoImage(request: ImageTaskRequest) {
  return request.images?.some((image) => image.role === 'logo' || image.role === 'reference') ?? false;
}

function hasStickerReplicaLogoGuidance(text: string) {
  return text.includes('Logo 图') && text.includes('品牌标识') && text.includes('版式');
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
  product_main_image: 'Edit the SKU reference images to produce',
  product_comparison_image: 'Edit the SKU reference images to produce',
  product_multi_scene: 'Edit the SKU reference images to produce',
};

function normalizeEditInstructionVerbs(instruction: string, feature: ImageFeature) {
  if (!EDIT_GENERATION_VERB_PATTERN.test(instruction)) {
    return instruction;
  }

  const replacement = EDIT_VERB_REPLACEMENTS[feature] ?? 'Edit the source image to';
  return instruction.replace(EDIT_GENERATION_VERB_PATTERN, replacement);
}

function finalizeMainImageAssetVariationInstruction(instruction: string) {
  const trimmed = instruction.trim();
  if (MAIN_IMAGE_ASSET_VARIATION_REDESIGN_PATTERN.test(trimmed)) {
    return trimmed;
  }
  const core = trimmed.replace(/\s*\.?\s*$/, '').trim();
  return `${core}; ${MAIN_IMAGE_ASSET_VARIATION_REDESIGN_SUFFIX}.`;
}

export function finalizeImageInstruction(
  feature: ImageFeature,
  instruction: string,
  request: ImageTaskRequest,
) {
  const trimmed = instruction.trim();
  const isEdit = getImageFeatureDefinition(feature).executionModel === 'edit';
  const normalized = isEdit ? normalizeEditInstructionVerbs(trimmed, feature) : trimmed;

  if (feature === 'main_image_asset_variation') {
    return finalizeMainImageAssetVariationInstruction(normalized);
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

export function buildFallbackFinalPrompt(input: ExecutionPromptAssemblyInput) {
  return buildExecutionPrompt(input.task.request, input.plan.mainPrompt);
}
