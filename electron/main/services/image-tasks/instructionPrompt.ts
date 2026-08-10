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
    const sceneScopeLine = buildProductSetSceneScopeLine(request, scenePrompt);
    if (sceneScopeLine) {
      lines.push(sceneScopeLine);
    }
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
  if (request.variantIndex !== undefined && request.variantTotal !== undefined && isProductSetFeature(request.feature)) {
    const directionIndex = (request.variantIndex - 1) % PRODUCT_SET_FEATURE_DIRECTION_COUNT;
    const dimensionLines = buildProductSetVariantDimensionLines(request.feature, directionIndex);
    const cycle = Math.floor((request.variantIndex - 1) / PRODUCT_SET_FEATURE_DIRECTION_COUNT) + 1;
    const cycleLine = cycle > 1
      ? `这是该方向的第 ${cycle} 轮变化，必须选择此前同方向未使用的具体子场景、主体对象和构图，不得复用前一轮内容。`
      : '';
    return `这是本批次第 ${request.variantIndex}/${request.variantTotal} 张。${dimensionLines}${cycleLine}`;
  }
  if (request.variantIndex !== undefined && request.variantTotal !== undefined) {
    return `这是本批次第 ${request.variantIndex}/${request.variantTotal} 张。生成与同批其他图片明显不同的场景或构图，同时遵守当前功能的全部固定规则。`;
  }
  return undefined;
}

const PRODUCT_SET_FEATURE_DIRECTION_COUNT = 3;

const COMPARISON_VARIANT_DIMENSIONS = [
  [
    '改变目标子区域：Before/After 的核心问题区域必须从当前位置明显切换到另一处（例如从平面主体切换到边缘或缝隙区域）。',
    '改变前景物体布局：两侧的前景辅助物体或道具的位置、密度或类型必须明显不同。',
    '改变色彩基调：主导色温必须从当前基调切换到明显不同的另一基调（例如从暖黄切换到冷白，或从明亮切换到深沉）。',
    '禁止通过轻微调色、只换标题、只移动产品或只换装饰物达到差异。',
  ],
  [
    '改变空间深度：画面必须从浅景深切换到深景深，或从平实背景切换到有明显前后层次的深度空间。',
    '改变光线方向与强度：主光源必须从当前方向切换到明显的另一种方向（例如从正面光切换到侧逆光或顶光），阴影区域面积必须明显不同。',
    '改变问题表现方式：Before 的问题状态必须从一种视觉形式切换到另一种（例如从表面污渍切换到结构脏乱、从磨损痕迹切换到褪色变旧），After 必须在同一对象同一区域呈现对应的真实改善。',
    '禁止通过轻微调色、只换标题、只移动产品或只换装饰物达到差异。',
  ],
  [
    '改变前景物体布局：两侧的前景辅助物体或道具的位置、密度或类型必须明显不同。',
    '改变光线方向与强度：主光源必须从当前方向切换到明显的另一种方向（例如从正面光切换到侧逆光或顶光），阴影区域面积必须明显不同。',
    '改变问题表现方式：Before 的问题状态必须从一种视觉形式切换到另一种（例如从表面污渍切换到结构脏乱、从磨损痕迹切换到褪色变旧），After 必须在同一对象同一区域呈现对应的真实改善。',
    '禁止通过轻微调色、只换标题、只移动产品或只换装饰物达到差异。',
  ],
];

const MULTI_SCENE_VARIANT_DIMENSIONS = [
  [
    '改变空间类型：目标场景的空间类型必须从当前位置明显切换到另一种（例如从室内台面切换到室外地面环境、从明亮空间切换到暗调空间）。',
    '改变观察距离与角度：主体场景的景别和观察角度必须明显变化（例如从近景切换到中远景、或从俯视切换到正视）。',
    '改变光影氛围：光线环境必须从当前氛围明显切换到另一种（例如从均匀商业光切换到强烈方向光、或从白天自然光切换到暖色人工光）。',
    '仅输出不同的具体目标场景、对象、表面、空间或环境状态，不得出现产品或人物。',
  ],
  [
    '改变主体对象：画面中核心展示的表面或物体必须从一种类型切换到另一种（例如从光滑瓷砖切换到纹理粗糙的木质或石质表面）。',
    '改变背景复杂度：背景环境必须从简单空旷切换到丰富多层次，或从密集杂乱切换到简洁有序，两种状态不能相同。',
    '改变空间类型：目标场景的空间类型必须从当前位置明显切换到另一种（例如从台面附近切换到墙角转折处、从开阔区域切换到狭窄区域）。',
    '仅输出不同的具体目标场景、对象、表面、空间或环境状态，不得出现产品或人物。',
  ],
  [
    '改变观察距离与角度：主体场景的景别和观察角度必须明显变化（例如从近景切换到中远景、或从俯视切换到正视）。',
    '改变主体对象：画面中核心展示的表面或物体必须从一种类型切换到另一种（例如从光滑瓷砖切换到纹理粗糙的木质或石质表面）。',
    '改变背景复杂度：背景环境必须从简单空旷切换到丰富多层次，或从密集杂乱切换到简洁有序，两种状态不能相同。',
    '仅输出不同的具体目标场景、对象、表面、空间或环境状态，不得出现产品或人物。',
  ],
];

const MAIN_VARIANT_DIMENSIONS = [
  [
    '改变目标子场景：核心展示的空间位置必须从当前位置明显切换到另一种（例如从台面切换到墙边、从室内近景切换到带窗外景的中景）。',
    '改变色彩基调：主导色温必须从当前基调切换到明显不同的另一基调（例如从暖黄切换到冷白，或从明亮切换到深沉）。',
    '改变前景层次：前景辅助元素的位置、密度或类型必须明显不同（例如从无前景切换到有前景道具、从分散元素切换到集中元素）。',
  ],
  [
    '改变空间深度：画面必须从浅景深切换到深景深，或从平实背景切换到有明显前后层次的深度空间。',
    '改变光线方向与强度：主光源必须从当前方向切换到明显的另一种方向（例如从正面光切换到侧逆光或顶光），阴影区域面积必须明显不同。',
    '改变背景元素密度：背景环境的简洁程度必须明显变化（例如从单色高光背景切换到丰富多层次环境背景，或相反）。',
  ],
  [
    '改变色彩基调：主导色温必须从当前基调切换到明显不同的另一基调（例如从暖黄切换到冷白，或从明亮切换到深沉）。',
    '改变光线方向与强度：主光源必须从当前方向切换到明显的另一种方向（例如从正面光切换到侧逆光或顶光），阴影区域面积必须明显不同。',
    '改变背景元素密度：背景环境的简洁程度必须明显变化（例如从单色高光背景切换到丰富多层次环境背景，或相反）。',
  ],
];

function buildProductSetVariantDimensionLines(feature: ImageFeature, directionIndex: number) {
  let lines: readonly string[];
  switch (feature) {
    case 'product_comparison_image':
      lines = COMPARISON_VARIANT_DIMENSIONS[directionIndex];
      break;
    case 'product_multi_scene':
      lines = MULTI_SCENE_VARIANT_DIMENSIONS[directionIndex];
      break;
    default:
      lines = MAIN_VARIANT_DIMENSIONS[directionIndex];
      break;
  }
  return lines.join('');
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
        COMPARISON_STATE_INVARIANT,
        comparisonIntensityLines[request.comparisonIntensity ?? 'medium'],
        buildComparisonProductVisibilityLine(request),
      ];
    case 'product_multi_scene':
      return [multiSceneLayoutLines[request.multiSceneLayout ?? 'single']];
    default:
      return [];
  }
}

const productHandheldModeLines = {
  handheld: '必须出现自然、完整的真人手持有或操作 SKU。手部必须五指齐全、比例正常，不得缺指、断指或多指；拇指与其余手指自然环握产品主体或握持区，产品的操作端（喷口、喷嘴、扳机、泵头、瓶口、握柄等）必须朝外，不得被握反或握错方向；手掌和手指不得遮挡产品正面主标签、品牌文字以及喷口、喷头、按键等核心结构；手部关节与腕部过渡自然，不得出现手掌反向或手部畸变。',
  not_handheld: 'SKU 不得由手持有，可放置在场景主体位置。',
} as const;

const productEffectModeLines = {
  auto: '根据 SKU 类型决定是否展示具体作用效果；若展示效果，作用物必须从产品真实开口发出，且使用动作必须符合产品真实物理结构。',
  show: '必须明确表现与 SKU 对应的作用过程或效果，且使用动作必须符合产品真实物理结构与真实使用方式。喷射类（喷雾、喷剂、香水）：作用物必须从真实喷口/喷嘴口部喷出，不得从瓶身、喷头侧面、瓶底或空中凭空出现；喷头/扳机/泵头必须处于展开或按压状态，喷射方向沿喷口指向方向，雾团从喷口发散。泵压/按压类：泵头、压嘴、瓶盖朝向必须正确，作用物从出口或瓶口流出。不得出现产品结构无法支撑的动作或效果，作用物不得从产品不存在的开口出现。',
  hide: '只展示产品和适用环境，不展示作用过程或效果演示。',
} as const;

const comparisonLayoutLines = {
  auto: '根据比例和构图选择左右或上下布局。',
  horizontal: 'Before 左、After 右。',
  vertical: 'Before 上、After 下。',
} as const;

const COMPARISON_STATE_INVARIANT = 'Before 与 After 必须保持同一场景、对象、机位、尺度、材质与结构。';

function buildProductSetSceneScopeLine(
  request: ImageTaskRequest,
  scenePrompt: string | undefined,
) {
  if (request.feature === 'product_multi_scene') {
    return '若用户补充要求指定了目标场景，所有变体必须保持在该同类目标场景范围内，只能通过不同子场景、对象、空间位置、构图、机位和光线形成差异，不得扩展到无关场景；若未指定目标场景，则根据 SKU 品类选择与本批其他方向不同但真实适用的目标场景。';
  }
  if (request.feature !== 'product_main_image' && request.feature !== 'product_comparison_image') {
    return undefined;
  }
  if (scenePrompt) {
    return `所有变体必须保持在“${scenePrompt}”的同类目标场景范围内，只能通过不同子场景、对象、空间位置、构图、机位和光线形成差异，不得扩展到无关场景。`;
  }
  return '未指定具体场景时，根据 SKU 品类选择与本批其他方向不同但真实适用的目标场景。';
}

function buildComparisonProductVisibilityLine(request: ImageTaskRequest) {
  if (request.showProduct === false) {
    return '整张图不展示 SKU，只使用 Before 与 After 的场景状态表达改善效果。';
  }

  const placement = {
    auto: '选择布局后，产品必须按对应方向跨在分界线中央。',
    horizontal: '产品必须垂直跨在左右分界线中央。',
    vertical: '产品必须水平跨在上下分界线中央。',
  } as const;
  return `展示 SKU 时，只展示一个产品实例，并将其作为独立于 Before 和 After 面板的前景商品层；两个面板内部不得重复出现 SKU，产品不得遮挡核心问题区域或 BEFORE、AFTER 标签。${placement[request.comparisonLayout ?? 'auto']}`;
}

const comparisonIntensityLines = {
  light: '轻度对比：Before 与 After 必须存在可辨认但自然克制的小范围状态改善，不能几乎一致。',
  medium: '中度对比：Before 的核心问题区域必须清晰可见，After 必须在同一区域呈现直接、明确且可信的改善，无需仔细观察即可理解变化。',
  heavy: '重度对比：Before 的核心问题必须大面积、显著且一眼可见，After 必须在同一对象、同一区域呈现强烈、明确且可信的改善；不得更换或改变场景、对象、机位、材质或结构，也不得仅靠压暗 Before、提高 After 饱和度或增加效果光制造反差。',
} as const;

const multiSceneLayoutLines = {
  single: '每张只展示一个完整目标场景，包含可观察的前中后景层次和具体的材质、物体、光影细节；同一批次的不同输出必须使用不同的具体场景。',
  collage: '将画布分为 4 个不规则区域作为独立面板，至少包含 2 种不同的宽高比，面板之间必须有清晰可见的边界线或分隔线；每个面板展示一个完整的、与其他面板不同的目标场景；不同面板之间不得选用色调相近或内容雷同的场景；同一批次的不同输出不得复用同一组面板场景组合。',
  grid: '将画布划分为 2 行 × 2 列共 4 个等大小单元格，单元格之间必须有清晰可见的分隔线或边框；每个单元格展示一个完整的、与其他单元格不同的目标场景；不得用纯色或相近色调填满所有单元格导致网格边界消失；同一批次的不同输出不得复用同一格场景组合。',
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
