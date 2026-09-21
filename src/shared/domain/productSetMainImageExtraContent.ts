export const MAIN_IMAGE_EXTRA_CONTENT_MODES = [
  'auto',
  'none',
  'selling_points',
  'mini_comparison',
] as const;

/** @deprecated Legacy single-value mode; migrated to {@link MainImageExtraContentSelection}. */
export type MainImageExtraContentMode = typeof MAIN_IMAGE_EXTRA_CONTENT_MODES[number];

export const MAIN_IMAGE_EXTRA_CONTENT_TOGGLES = [
  'selling_points',
  'mini_comparison',
] as const;

export type MainImageExtraContentToggle = typeof MAIN_IMAGE_EXTRA_CONTENT_TOGGLES[number];

export interface MainImageExtraContentSelection {
  preset: 'auto' | 'none' | 'custom';
  toggles: readonly MainImageExtraContentToggle[];
}

export interface ResolvedMainImageExtraContentFlags {
  sellingPoints: boolean;
  miniComparison: boolean;
}

export function defaultMainImageExtraContentSelection(): MainImageExtraContentSelection {
  return { preset: 'auto', toggles: [] };
}

export function isMainImageExtraContentMode(value: unknown): value is MainImageExtraContentMode {
  return typeof value === 'string'
    && (MAIN_IMAGE_EXTRA_CONTENT_MODES as readonly string[]).includes(value);
}

export function isMainImageExtraContentToggle(value: unknown): value is MainImageExtraContentToggle {
  return typeof value === 'string'
    && (MAIN_IMAGE_EXTRA_CONTENT_TOGGLES as readonly string[]).includes(value);
}

export function isMainImageExtraContentSelection(value: unknown): value is MainImageExtraContentSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as MainImageExtraContentSelection;
  if (record.preset !== 'auto' && record.preset !== 'none' && record.preset !== 'custom') {
    return false;
  }
  if (!Array.isArray(record.toggles)) {
    return false;
  }
  return record.toggles.every((toggle) => isMainImageExtraContentToggle(toggle));
}

export function sanitizeMainImageExtraContentSelection(
  selection: MainImageExtraContentSelection,
): MainImageExtraContentSelection {
  if (selection.preset === 'auto' || selection.preset === 'none') {
    return { preset: selection.preset, toggles: [] };
  }
  const toggles = [...new Set(selection.toggles.filter((toggle) => isMainImageExtraContentToggle(toggle)))];
  if (toggles.length === 0) {
    return { preset: 'none', toggles: [] };
  }
  return { preset: 'custom', toggles };
}

export function migrateLegacyExtraContentMode(mode: MainImageExtraContentMode): MainImageExtraContentSelection {
  if (mode === 'auto') {
    return { preset: 'auto', toggles: [] };
  }
  if (mode === 'none') {
    return { preset: 'none', toggles: [] };
  }
  return { preset: 'custom', toggles: [mode] };
}

export function normalizeMainImageExtraContentByIndexEntry(
  value: unknown,
): MainImageExtraContentSelection {
  if (isMainImageExtraContentSelection(value)) {
    return sanitizeMainImageExtraContentSelection(value);
  }
  if (isMainImageExtraContentMode(value)) {
    return migrateLegacyExtraContentMode(value);
  }
  return defaultMainImageExtraContentSelection();
}

export function resizeMainImageExtraContentByIndex(
  current: unknown[] | undefined,
  count: number,
  fallback: MainImageExtraContentSelection = defaultMainImageExtraContentSelection(),
): MainImageExtraContentSelection[] {
  return Array.from({ length: count }, (_, index) => (
    normalizeMainImageExtraContentByIndexEntry(current?.[index] ?? fallback)
  ));
}

const SELECTION_LABELS: Record<MainImageExtraContentMode, string> = {
  auto: 'AI 自动',
  none: '无',
  selling_points: '卖点(1–3)',
  mini_comparison: '小对比图',
};

export function formatMainImageExtraContentSelection(selection: MainImageExtraContentSelection): string {
  const normalized = sanitizeMainImageExtraContentSelection(selection);
  if (normalized.preset === 'auto') {
    return SELECTION_LABELS.auto;
  }
  if (normalized.preset === 'none') {
    return SELECTION_LABELS.none;
  }
  return normalized.toggles.map((toggle) => SELECTION_LABELS[toggle]).join(' + ');
}

export function formatMainImageExtraContentByIndex(
  values: readonly MainImageExtraContentSelection[],
): string {
  return values.map((value, index) => `图${index + 1}：${formatMainImageExtraContentSelection(value)}`).join('、');
}

export function restoreMainImageExtraContentByIndex(
  count: number,
  byIndex: unknown[] | undefined,
): MainImageExtraContentSelection[] {
  if (byIndex?.length) {
    return resizeMainImageExtraContentByIndex(byIndex, count, { preset: 'none', toggles: [] });
  }
  return Array.from({ length: count }, () => ({ preset: 'none' as const, toggles: [] }));
}

export function resolveMainImageExtraContentSelection(
  request: { mainImageExtraContentByIndex?: MainImageExtraContentSelection[]; variantIndex?: number },
  index = request.variantIndex ?? 1,
): MainImageExtraContentSelection {
  const byIndex = request.mainImageExtraContentByIndex;
  if (Array.isArray(byIndex) && byIndex.length >= index) {
    return normalizeMainImageExtraContentByIndexEntry(byIndex[index - 1]);
  }
  return { preset: 'none', toggles: [] };
}

export function parseVisionExtraContent(
  visionExtra?: MainImageExtraContentToggle[] | MainImageExtraContentMode | 'none',
): ResolvedMainImageExtraContentFlags {
  if (!visionExtra || visionExtra === 'none') {
    return { sellingPoints: false, miniComparison: false };
  }
  if (Array.isArray(visionExtra)) {
    return {
      sellingPoints: visionExtra.includes('selling_points'),
      miniComparison: visionExtra.includes('mini_comparison'),
    };
  }
  return {
    sellingPoints: visionExtra === 'selling_points',
    miniComparison: visionExtra === 'mini_comparison',
  };
}

export function resolveEffectiveMainImageExtraContentFlags(
  selection: MainImageExtraContentSelection,
  visionExtra?: MainImageExtraContentToggle[] | MainImageExtraContentMode | 'none',
): ResolvedMainImageExtraContentFlags {
  const normalized = sanitizeMainImageExtraContentSelection(selection);
  if (normalized.preset === 'none') {
    return { sellingPoints: false, miniComparison: false };
  }
  if (normalized.preset === 'custom') {
    return {
      sellingPoints: normalized.toggles.includes('selling_points'),
      miniComparison: normalized.toggles.includes('mini_comparison'),
    };
  }
  const parsed = parseVisionExtraContent(visionExtra);
  if (parsed.sellingPoints || parsed.miniComparison) {
    return parsed;
  }
  return { sellingPoints: true, miniComparison: false };
}

export function toggleMainImageExtraContentOption(
  current: MainImageExtraContentSelection,
  option: MainImageExtraContentMode,
): MainImageExtraContentSelection {
  if (option === 'auto') {
    return { preset: 'auto', toggles: [] };
  }
  if (option === 'none') {
    return { preset: 'none', toggles: [] };
  }
  const toggle = option as MainImageExtraContentToggle;
  if (current.preset === 'auto' || current.preset === 'none') {
    return { preset: 'custom', toggles: [toggle] };
  }
  const hasToggle = current.toggles.includes(toggle);
  const toggles = hasToggle
    ? current.toggles.filter((item) => item !== toggle)
    : [...current.toggles, toggle];
  return sanitizeMainImageExtraContentSelection({ preset: 'custom', toggles });
}

export function isMainImageExtraContentOptionActive(
  selection: MainImageExtraContentSelection,
  option: MainImageExtraContentMode,
): boolean {
  const normalized = sanitizeMainImageExtraContentSelection(selection);
  if (option === 'auto') {
    return normalized.preset === 'auto';
  }
  if (option === 'none') {
    return normalized.preset === 'none';
  }
  return normalized.preset === 'custom' && normalized.toggles.includes(option as MainImageExtraContentToggle);
}

export const MAIN_IMAGE_DISPLAY_TAGS = [
  'product',
  'selling_points',
  'mini_comparison',
] as const;

export type MainImageDisplayTag = typeof MAIN_IMAGE_DISPLAY_TAGS[number];

export const MAIN_IMAGE_DISPLAY_TAG_LABELS: Record<MainImageDisplayTag, string> = {
  product: '产品',
  selling_points: '卖点(1-3)',
  mini_comparison: '对比图',
};

export function isMainImageDisplayTag(value: unknown): value is MainImageDisplayTag {
  return typeof value === 'string'
    && (MAIN_IMAGE_DISPLAY_TAGS as readonly string[]).includes(value);
}

export function mainImageDisplayTagsFromFields(
  showProduct: boolean,
  extra: MainImageExtraContentSelection,
): MainImageDisplayTag[] {
  const tags: MainImageDisplayTag[] = [];
  if (showProduct) {
    tags.push('product');
  }
  const normalized = sanitizeMainImageExtraContentSelection(extra);
  if (normalized.preset === 'custom') {
    for (const toggle of normalized.toggles) {
      tags.push(toggle);
    }
  }
  return tags;
}

export function applyMainImageDisplayTags(
  tags: readonly MainImageDisplayTag[],
): { showProduct: boolean; extra: MainImageExtraContentSelection } {
  const hasSelling = tags.includes('selling_points');
  const hasMini = tags.includes('mini_comparison');
  return {
    showProduct: tags.includes('product'),
    extra: hasSelling || hasMini
      ? {
        preset: 'custom',
        toggles: [
          ...(hasSelling ? ['selling_points' as const] : []),
          ...(hasMini ? ['mini_comparison' as const] : []),
        ],
      }
      : { preset: 'none', toggles: [] },
  };
}

export function toggleMainImageDisplayTag(
  tags: readonly MainImageDisplayTag[],
  tag: MainImageDisplayTag,
): MainImageDisplayTag[] {
  return tags.includes(tag)
    ? tags.filter((item) => item !== tag)
    : [...tags, tag];
}

export function formatMainImageDisplayTags(tags: readonly MainImageDisplayTag[]): string {
  if (tags.length === 0) {
    return '无';
  }
  return tags.map((tag) => MAIN_IMAGE_DISPLAY_TAG_LABELS[tag]).join('、');
}

export function formatMainImageDisplayTagsByIndex(
  showProductByIndex: readonly boolean[],
  extraByIndex: readonly MainImageExtraContentSelection[],
  count: number,
): string {
  return Array.from({ length: count }, (_, index) => {
    const showProduct = showProductByIndex[index] ?? true;
    const extra = extraByIndex[index] ?? { preset: 'none' as const, toggles: [] as MainImageExtraContentToggle[] };
    const tags = mainImageDisplayTagsFromFields(showProduct, extra);
    return `图${index + 1}：${formatMainImageDisplayTags(tags)}`;
  }).join('、');
}
