export const STICKER_VARIATION_BASE_PROMPT =
  '参考当前图片中的贴纸设计，让它看起来像同系列的新款贴纸';

export const DEFAULT_STICKER_REPLICA_LOGO_TEXT = 'wkau';

export const DEFAULT_STICKER_BRAND = DEFAULT_STICKER_REPLICA_LOGO_TEXT;

export const STICKER_VARIATION_DIRECTION_NONE = '' as const;

export const STICKER_VARIATION_DIRECTIONS = [
  {
    value: 'product',
    label: '换品裂变',
    prompt: '允许变化：根据用户提供的信息调整产品名、品类表现和功效图形。必须保持：系列视觉语言、商业信息层级和目标品牌规则。',
  },
  {
    value: 'color',
    label: '换色裂变',
    prompt: '允许变化：只调整主色、辅助色和色彩比例。必须保持：版式、元素位置、字体层级、文案语义和装饰几何。',
  },
  {
    value: 'reverse',
    label: '反转裂变',
    prompt: '允许变化：反转主辅色关系，或互换上下、左右视觉重心。必须保持：品类识别、允许文案来源中的文字、可读性和标签边界。',
  },
  {
    value: 'geometry',
    label: '色块/矩形重组',
    prompt: '允许变化：重组标签内部几何色块的形状、方向和组合。必须保持：用户已提供的卖点语义、品牌、容量和纯平面标签规则。',
  },
  {
    value: 'layout',
    label: '排版打乱重组',
    prompt: '允许变化：重新安排允许文案来源中的文字、图形和色块的位置与组合。必须保持：全部有效文案、目标品牌、容量和清晰的信息层级。',
  },
  {
    value: 'background',
    label: '背景重组',
    prompt: '允许变化：仅调整标签内部背景的纹理、色块和功效氛围。必须保持：前景有效文字、产品信息和无外部环境的规则。',
  },
  {
    value: 'fusion',
    label: '爆款融合',
    prompt: '允许变化：融合参考图中抽象的排版、配色和装饰规律。必须保持：目标品牌和允许文案来源中的文字；不得复制其他品牌、产品或无关字面文字。',
  },
  {
    value: 'key-element',
    label: '重点元素替换',
    prompt: '允许变化：替换标题字体、标题容器、功效图或一个主要装饰元素。必须保持：其他版式区域、有效文案、目标品牌和容量。',
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
