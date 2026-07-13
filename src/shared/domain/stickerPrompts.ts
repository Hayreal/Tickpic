export const STICKER_VARIATION_BASE_PROMPT =
  'Create a commercially usable sticker variation from the source label.';

export const DEFAULT_STICKER_REPLICA_LOGO_TEXT = 'wkau';
export const DEFAULT_STICKER_BRAND = DEFAULT_STICKER_REPLICA_LOGO_TEXT;
export const STICKER_VARIATION_DIRECTION_NONE = '' as const;

export type StickerInputFidelity = 'low' | 'high';

export type StickerVariationDirection =
  | 'product'
  | 'color'
  | 'reverse'
  | 'geometry'
  | 'layout'
  | 'background'
  | 'fusion'
  | 'key-element';
export type StickerVariationDirectionSelection = StickerVariationDirection | typeof STICKER_VARIATION_DIRECTION_NONE;

export interface StickerVariationStrategy {
  value: StickerVariationDirection;
  label: string;
  change: readonly string[];
  preserve: readonly string[];
  forbid: readonly string[];
  inputFidelity: StickerInputFidelity;
}

export const STICKER_VARIATION_DIRECTIONS: readonly StickerVariationStrategy[] = [
  {
    value: 'product', label: '换品类变', inputFidelity: 'low',
    change: ['product name', 'claims', 'efficacy/product graphics', 'information hierarchy'],
    preserve: ['brand', 'registered mark', 'commercial design system'],
    forbid: ['retaining old product identity', 'unrelated categories'],
  },
  {
    value: 'color', label: '换色裂变', inputFidelity: 'high',
    change: ['primary palette', 'secondary palette', 'contrast', 'color blocks'],
    preserve: ['brand', 'layout', 'visible copy', 'graphic positions', 'capacity'],
    forbid: ['rebuilding layout', 'single-color filter', 'reduced legibility'],
  },
  {
    value: 'reverse', label: '反转裂变', inputFidelity: 'low',
    change: ['light/dark hierarchy', 'primary/secondary roles', 'visual center'],
    preserve: ['brand', 'visible copy', 'product identity'],
    forbid: ['negative-filter effect', 'mirrored text', 'broken reading order'],
  },
  {
    value: 'geometry', label: '色块/矩形重组', inputFidelity: 'low',
    change: ['internal color blocks', 'sections', 'decorative rhythm'],
    preserve: ['brand', 'visible copy', 'capacity', 'main hierarchy'],
    forbid: ['non-rectangular contour', 'only moving one minor block'],
  },
  {
    value: 'layout', label: '排版打乱重组', inputFidelity: 'low',
    change: ['layout', 'title positions', 'claim positions', 'graphic positions', 'badge positions', 'capacity positions', 'hierarchy'],
    preserve: ['brand', 'visible copy', 'product identity', 'core palette'],
    forbid: ['dropping copy', 'changing meaning', 'moving only one minor element'],
  },
  {
    value: 'background', label: '背景重组', inputFidelity: 'high',
    change: ['internal texture', 'material', 'decorative background'],
    preserve: ['brand', 'foreground text structure', 'capacity', 'core product information'],
    forbid: ['external scene', 'container', 'display stand', '3D background'],
  },
  {
    value: 'fusion', label: '爆款融合', inputFidelity: 'low',
    change: ['headline strength', 'selling point rhythm', 'mature category design language'],
    preserve: ['brand', 'visible copy', 'product identity', 'capacity'],
    forbid: ['third-party brands', 'copied labels', 'unrelated trend elements'],
  },
  {
    value: 'key-element', label: '重点元素替换', inputFidelity: 'high',
    change: ['exactly one dominant group: title container, efficacy graphic, badge, or main illustration'],
    preserve: ['brand', 'remaining layout', 'visible copy', 'palette', 'capacity'],
    forbid: ['changing multiple regions', 'full redesign'],
  },
];

export const STICKER_VARIATION_STRATEGIES = STICKER_VARIATION_DIRECTIONS;

export const STICKER_VARIATION_DIRECTION_OPTIONS = [
  { value: STICKER_VARIATION_DIRECTION_NONE, label: '不指定', prompt: '' },
  ...STICKER_VARIATION_STRATEGIES.map((strategy) => ({
    value: strategy.value,
    label: strategy.label,
    prompt: `Change: ${strategy.change.join(', ')}. Preserve: ${strategy.preserve.join(', ')}.`,
  })),
] as const;

export function getStickerVariationStrategy(value?: string): StickerVariationStrategy | undefined {
  if (!value?.trim()) return undefined;
  return STICKER_VARIATION_STRATEGIES.find((strategy) => strategy.value === value.trim());
}

export function getStickerVariationDirection(value?: string) {
  return getStickerVariationStrategy(value);
}

export function resolveStickerVariationStrategy(input: {
  direction?: string;
  productName?: string;
  sellingPoints?: readonly string[];
  colorScheme?: string;
  colorBlockLayout?: string;
}): StickerVariationStrategy {
  return getStickerVariationStrategy(input.direction)
    ?? (input.productName?.trim() || input.sellingPoints?.some((point) => point.trim())
      ? getStickerVariationStrategy('product')!
      : input.colorScheme?.trim()
        ? getStickerVariationStrategy('color')!
        : input.colorBlockLayout?.trim()
          ? getStickerVariationStrategy('layout')!
          : getStickerVariationStrategy('fusion')!);
}

export type StickerVariationPromptOptions = {
  colorScheme?: string;
  direction?: StickerVariationDirection;
  userPrompt?: string;
};

export function buildStickerVariationPrompt(options: StickerVariationPromptOptions = {}): string {
  const parts = [STICKER_VARIATION_BASE_PROMPT];
  const strategy = getStickerVariationStrategy(options.direction);
  if (strategy) parts.push(`Change: ${strategy.change.join(', ')}. Preserve: ${strategy.preserve.join(', ')}.`);
  if (options.colorScheme?.trim()) parts.push(`Color direction: ${options.colorScheme.trim()}.`);
  if (options.userPrompt?.trim()) parts.push(`Additional request: ${options.userPrompt.trim()}.`);
  return parts.join(' ');
}
