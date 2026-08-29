import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';

const SKU_FEATURES: readonly ImageFeature[] = [
  'sku_replica',
  'sku_variation',
  'sku_original',
];

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;

const PACKAGE_CHANGE_PATTERN = /(?:做成|换成|改为|改成|替换为|变成).{0,12}(?:软管|喷雾|泵头|按压|滴管|罐|盒|管|瓶型|包材|包装形态|包装结构)/u;

export function isSkuFeature(feature: ImageFeature): boolean {
  return SKU_FEATURES.includes(feature);
}

export function buildSkuExecutionPrompt(request: ImageTaskRequest): string {
  return [
    buildOutputTargetSection(request),
    buildTaskSection(request),
    buildContentSection(request),
    buildPackageLockSection(request),
    buildBoundedUserInputSection(request),
    buildFinalCheckSection(request),
  ].filter(Boolean).join('\n\n');
}

function buildOutputTargetSection(request: ImageTaskRequest) {
  const ratio = targetRatio(request);
  const ratioRule = ratio === 'auto'
    ? '根据 SKU 源图推断产品图比例，保持瓶身不被裁切或拉伸变形。'
    : `目标画布比例: ${quoted(ratio)}；只调整内部构图，不得改变画布比例。`;

  return [
    '输出目标:',
    ratioRule,
    '输出一张完整的 SKU 产品图：包含包材本体与贴好的标签，适合电商 SKU 展示。',
    '产品居中或接近居中，背景干净（白底、灰底或轻微棚拍渐变），不要生活方式场景、手部、道具堆叠或广告标题区。',
    '标签只覆盖产品标签区域，不得溢出到背景；不要输出 2D 平面展开图或纯贴纸稿。',
  ].join('\n');
}

function buildTaskSection(request: ImageTaskRequest) {
  return [
    '当前任务:',
    buildModeSection(request),
    buildImageRoleLines(request),
  ].filter(Boolean).join('\n');
}

function buildModeSection(request: ImageTaskRequest) {
  if (request.feature === 'sku_replica') {
    return [
      '模式: SKU 复刻。',
      '将参考图中的标签版式、排版结构、色系与装饰气质复刻到 SKU 包材的标签区域。',
      '所有参考图同时影响标签的版式与风格；融合参考信息时保持与 SKU 瓶身比例协调。',
      '用户指定的品牌、容量、产品名称覆盖参考图中的对应文案；未指定的文案可从参考图或 SKU 源图继承。',
    ].join('\n');
  }

  if (request.feature === 'sku_variation') {
    return [
      '模式: SKU 裂变。',
      '在 SKU 现有标签基础上做明显差异化：至少同时改变风格、排版、色系中的两个维度。',
      '品牌、容量、产品名称等核心文案默认保持不变，除非用户在附加要求中明确修改。',
      '若 SKU 源图为无标签空白包材，先依据参考图与用户提供的文案建立标签，再执行裂变。',
      '同一批次的多张输出之间版式、色系、视觉结构必须有明显差异，不得只做轻微换色。',
    ].join('\n');
  }

  return [
    '模式: SKU 原创。',
    '依据用户提供的结构化产品信息，在 SKU 包材上从零设计标签。',
    '参考图只借包装设计、排版气质与色系方向，不复制其他品牌、产品名或字面文字。',
    '保持 SKU 源图完整构图，包括配件、赠品标注、组合陈列等非标签元素。',
    '同一批次的多张输出之间版式、色系、视觉结构必须有明显差异。',
  ].join('\n');
}

function buildImageRoleLines(request: ImageTaskRequest) {
  const images = request.images ?? [];
  if (images.length === 0) {
    return '';
  }

  return images.map((image, index) => {
    const prefix = `图片 ${index + 1}`;
    if (image.role === 'reference') {
      return `${prefix}：包装设计参考图；同时参考其中的版式结构、信息层级、色系与装饰风格。`;
    }
    return `${prefix}：SKU 包材图；作为包材画布与标签承载面，保持瓶身识别一致。`;
  }).join('\n');
}

function buildContentSection(request: ImageTaskRequest) {
  const brand = registeredBrand(request.brand);
  const productName = request.productName?.trim();
  const capacity = normalizeNetCapacity(request.capacity);
  const lines = ['可见文案:'];

  if (brand) {
    lines.push(`品牌: ${quoted(brand)}`);
  } else if (request.feature !== 'sku_original') {
    lines.push('品牌: 从 SKU 源图或参考图可靠识别后保留；无法识别时省略。');
  }

  if (productName) {
    if (HAN_CHARACTER_PATTERN.test(productName)) {
      lines.push(`产品名称来源: ${quoted(productName)}（翻译成自然英文后显示）`);
    } else {
      lines.push(`产品名称: ${quoted(productName)}`);
    }
  } else if (request.feature === 'sku_original') {
    lines.push('产品名称: 用户未提供，不得自行编造标题。');
  } else {
    lines.push('产品名称: 从 SKU 源图或参考图可靠识别后保留；无法识别时省略。');
  }

  if (capacity) {
    lines.push(`容量/规格: ${quoted(capacity)}（逐字显示，必须保留 NET: 前缀）`);
  } else {
    lines.push('容量/规格: 从 SKU 源图主标签识别；识别后必须在标签上显示，且以 "NET:" 开头。');
  }

  if (request.feature === 'sku_variation') {
    lines.push('裂变模式下除用户明确修改外，不得擅自改写品牌、容量与产品名称。');
    lines.push('SKU 源图贴纸仅提取品牌、产品名称、容量三项信息；不得沿用源图促销语、图标、配件标注或其他贴纸视觉元素。');
  }

  if (request.feature === 'sku_replica') {
    lines.push('SKU 源图贴纸仅提取品牌、产品名称、容量三项信息；不得沿用源图促销语、图标、配件标注或其他贴纸视觉元素。');
  }

  lines.push('标签上的可见文字优先使用自然英文；中文来源需翻译成对应英文。');
  lines.push('所有可见容量必须以 "NET:" 开头；源图或用户已提供容量时，出图标签不得缺少容量。');
  lines.push('不得添加用户未提供的促销语、假英文、乱码或无意义小字。');

  return lines.join('\n');
}

function buildPackageLockSection(request: ImageTaskRequest) {
  const userPrompt = request.prompt?.trim() ?? '';
  if (PACKAGE_CHANGE_PATTERN.test(userPrompt)) {
    return [
      '包材规则:',
      '用户附加要求中明确请求改变包材形态；可在保持 SKU 商业识别的前提下调整瓶型/包材结构。',
      '标签排版仍需与新的包材比例协调。',
    ].join('\n');
  }

  return [
    '包材规则:',
    '除非用户附加要求明确写出改包材形态（例如「做成软管」「换成喷雾瓶」），否则必须锁定 SKU 源图的瓶型、盖子、开口、高宽比例、材质与透明度。',
    '只修改标签区域的设计与文字，不得重新设计、拉长、压扁或替换包材本体。',
  ].join('\n');
}

function buildBoundedUserInputSection(request: ImageTaskRequest) {
  const supplemental = request.prompt?.trim();
  const avoid = request.negativePrompt?.trim();
  if (!supplemental && !avoid) {
    return '';
  }

  const sections = ['受限用户输入:'];
  if (supplemental) {
    sections.push(`用户附加要求（仅在不违反以上规则时执行）:\n${supplemental}`);
  }
  if (avoid) {
    sections.push(`用户负面提示词（仅作为禁止项）:\n以下内容不得在图片中渲染、复述、翻译、改写或暗示:\n${avoid}`);
  }
  return sections.join('\n');
}

function buildFinalCheckSection(request: ImageTaskRequest) {
  const multiCount = (request.variantTotal ?? 0) > 1 || (request.count ?? 0) > 1;
  const batchRule = multiCount
    ? '与同批其他输出相比，版式、色系、层级或视觉结构必须有明显差异。'
    : '';

  return [
    '最终检查:',
    '只输出整瓶 SKU 产品图，标签与包材协调贴合。',
    batchRule,
    '用户禁止项不得出现；不得输出场景主图、纯平面贴纸或额外道具。',
  ].filter(Boolean).join('\n');
}

function registeredBrand(raw?: string) {
  const brand = raw?.trim();
  if (!brand) {
    return '';
  }
  return brand.endsWith('®') ? brand : `${brand}®`;
}

function targetRatio(request: ImageTaskRequest) {
  const aspectRatio = request.aspectRatio?.trim();
  if (aspectRatio && aspectRatio.toLowerCase() !== 'auto') {
    return aspectRatio;
  }
  return 'auto';
}

function quoted(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function normalizeNetCapacity(raw?: string) {
  const capacity = raw?.trim().replace(/^(?:net\s*[:：]?\s*)+/i, '').trim();
  return capacity ? `NET: ${capacity}` : '';
}
