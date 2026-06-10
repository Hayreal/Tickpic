export const STICKER_VARIATION_BASE_PROMPT =
  '参考当前图片中的贴纸设计，让它看起来像同系列的新款贴纸';

export const DEFAULT_STICKER_REPLICA_LOGO_TEXT = 'wkau';

export const DEFAULT_STICKER_BRAND = DEFAULT_STICKER_REPLICA_LOGO_TEXT;

export const STICKER_VARIATION_DIRECTION_NONE = '' as const;

export const STICKER_VARIATION_DIRECTIONS = [
  {
    value: 'product',
    label: '换品裂变',
    prompt: '将原爆款贴纸的版式、卖点表达和视觉冲击力迁移到相关产品上，产品形态和功效方向要有明显变化。',
  },
  {
    value: 'color',
    label: '换色裂变',
    prompt: '保留原有产品、文字层级和商业风格，重新设计主色系和辅助色，让它看起来像同系列的新款爆品。',
  },
  {
    value: 'reverse',
    label: '反转裂变',
    prompt: '通过颜色、结构和视觉重心的反转形成新视觉，如黑白反转、主辅色互换、上下或左右结构互换。',
  },
  {
    value: 'geometry',
    label: '色块/矩形重组',
    prompt: '用横向、竖向、斜切、圆角矩形、圆形或三角形等几何色块重新组织画面，保留核心卖点但明显改变结构。',
  },
  {
    value: 'layout',
    label: '排版打乱重组',
    prompt: '将原本的文字、产品图、功效图、色块和装饰元素重新安排，形成新的贴纸版式。',
  },
  {
    value: 'background',
    label: '背景重组',
    prompt: '保留产品主体、核心卖点和商业风格，重新设计简约几何背景、功效感背景或差异明显的材质/场景背景。',
  },
  {
    value: 'fusion',
    label: '爆款融合',
    prompt: '拆解参考贴纸与同类爆款的文字排版、背景结构、主色系、产品展示方式和装饰元素，重新融合成成熟爆款设计。',
  },
  {
    value: 'key-element',
    label: '重点元素替换',
    prompt: '替换大标题字体、标题容器、功效图、装饰图、徽章或标签等高占比元素，同时保留原有识别点。',
  },
] as const;

export type StickerVariationDirection = typeof STICKER_VARIATION_DIRECTIONS[number]['value'];

export type StickerVariationDirectionSelection = StickerVariationDirection | typeof STICKER_VARIATION_DIRECTION_NONE;

export const STICKER_VARIATION_DIRECTION_OPTIONS = [
  {
    value: STICKER_VARIATION_DIRECTION_NONE,
    label: '不指定',
    prompt: '',
  },
  ...STICKER_VARIATION_DIRECTIONS,
] as const;

export function getStickerVariationDirection(value?: string) {
  if (!value?.trim()) {
    return undefined;
  }
  return STICKER_VARIATION_DIRECTIONS.find((direction) => direction.value === value);
}

export type StickerVariationPromptOptions = {
  colorScheme?: string;
  direction?: StickerVariationDirection;
  userPrompt?: string;
};

export function buildStickerVariationPrompt(options: StickerVariationPromptOptions = {}): string {
  const parts = [STICKER_VARIATION_BASE_PROMPT];
  const colorScheme = options.colorScheme?.trim();
  const direction = getStickerVariationDirection(options.direction);
  const userPrompt = options.userPrompt?.trim();

  if (direction) {
    parts.push(`裂变方向：${direction.label}，${direction.prompt}`);
  }

  if (colorScheme) {
    parts.push(`色调方向：${colorScheme}`);
  }

  if (userPrompt) {
    parts.push(`附加要求：${userPrompt}`);
  }

  return parts.join('。');
}
