import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';

export function isSkuHitMainImageFeature(feature: ImageFeature): boolean {
  return feature === 'sku_hit_main_image';
}

export function buildSkuHitMainImagePrompt(request: ImageTaskRequest): string {
  return [
    buildImageRolesSection(),
    buildKeepSection(),
    buildProductReplaceSection(),
    buildDifferentiationSection(request),
    buildCopySection(request),
    buildBoundedUserInputSection(request),
    buildOutputSection(),
  ].filter(Boolean).join('\n\n');
}

function buildImageRolesSection() {
  return [
    '图片角色:',
    '图 1：爆款主图参考。继承营销主题、核心英文文案、产品用途 / 使用场景类型、卖点逻辑。不是包装贴标参考。',
    '图 2：新 SKU 产品图。产品本体唯一标准。必须完整替换图 1 原产品。',
    '按角色标注，不按上传数组顺序猜测。',
  ].join('\n');
}

function buildKeepSection() {
  return [
    '必须保留:',
    '保留图 1 的营销主题、核心英文标题/副标题与明确营销文案，原则上原文字保留。',
    '保留图 1 的产品用途和使用场景类型，不改要解决的问题。',
    '图 1 若限定具体对象，裂变后仍围绕该对象。',
  ].join('\n');
}

function buildProductReplaceSection() {
  return [
    '产品替换（最高优先级）:',
    '删除图 1 原产品，换成图 2 SKU。',
    '锁定图 2 的包材结构、高宽比、瓶型、盖子、开口、材质、颜色、透明度、标签视觉与整体识别。',
    '禁止拉长、压扁、变细、变宽或重设计图 2。',
    '整体广告配色优先从图 2 标签提取。本任务不是整瓶白底 SKU 出图。',
  ].join('\n');
}

function buildDifferentiationSection(request: ImageTaskRequest) {
  const lines = [
    '大差异化:',
    '禁止复制图 1 构图。每次至少同时改变 3 个以上维度。',
    '维度包括产品位置、产品大小比例、标题位置与分行、场景构图、拍摄角度、远近景、Before/After 表现、信息区布局。',
    '禁止只做换色、左右翻转、产品左右互换、只移动标题、原场景复刻、原图换 SKU。',
    '保持图 1 的使用场景类型，但重新生成具体素材、角度和构图。',
  ];

  if (request.variantTotal && request.variantTotal > 1) {
    lines.push('同批多张之间构图必须互异，不得只换色。');
  }

  return lines.join('\n');
}

function buildCopySection(request: ImageTaskRequest) {
  const brand = request.brand?.trim();
  const productName = request.productName?.trim();
  const capacity = request.capacity?.trim();
  const lines = ['文字与字段覆盖:'];

  if (brand) {
    lines.push(`品牌: ${quoted(brand)}`);
  }
  if (productName) {
    lines.push(`产品名称: ${quoted(productName)}`);
  }
  if (capacity) {
    lines.push(`容量: ${quoted(capacity)}`);
  }

  if (brand || productName || capacity) {
    lines.push('用户填写的品牌、产品名、容量覆盖图 1 中对应文案，包括标题区里出现的对应词。');
  }

  if (!brand || !productName || !capacity) {
    lines.push('未填写的品牌、产品名、容量从图 1 继承；无法识别时省略，不得编造。');
  }

  lines.push('画面可见营销文字优先自然英文；中文来源译成对应英文。');
  return lines.join('\n');
}

function buildBoundedUserInputSection(request: ImageTaskRequest) {
  const supplemental = request.prompt?.trim();
  const avoid = request.negativePrompt?.trim();
  if (!supplemental && !avoid) {
    return '';
  }

  const sections = ['受限用户输入:'];
  if (supplemental) {
    sections.push(`用户附加要求（仅在不违反以上规则时执行，不得推翻图 2 包材锁，也不得把任务改成整瓶白底图）:\n${supplemental}`);
  }
  if (avoid) {
    sections.push(`用户负面提示词（仅作为禁止项）:\n${avoid}`);
  }
  return sections.join('\n');
}

function buildOutputSection() {
  return [
    '输出目标:',
    '输出一张用户所选比例的欧美 Temu / Amazon 高点击电商主图。',
    '继承图 1 的卖点，不继承图 1 的画面。只输出最终图片。',
  ].join('\n');
}

function quoted(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}
