export const IMAGE_ASPECT_RATIO_OPTIONS = [
  { value: 'auto', label: '自动', description: '保持原图比例，去产品/换产品首选' },
  { value: '1:1', label: '正方', description: '电商主图，淘宝京东首图' },
  { value: '3:2', label: '横图', description: '详情页横版配图' },
  { value: '2:3', label: '竖图', description: '竖版商品展示图' },
  { value: '4:3', label: '横图', description: '详情页场景横图' },
  { value: '3:4', label: '竖图', description: '竖版主图，小红书商品图' },
  { value: '5:4', label: '横图', description: '包装贴纸横版构图' },
  { value: '4:5', label: '竖图', description: '包装贴纸竖版构图' },
  { value: '16:9', label: '横图', description: '详情页场景横图' },
  { value: '9:16', label: '竖图', description: '竖版主图，小红书商品图' },
  { value: '2:1', label: '横图', description: '活动页超宽横幅' },
  { value: '1:2', label: '竖图', description: '长图详情，竖版海报' },
  { value: '3:1', label: '横图', description: '首页通栏广告位' },
  { value: '1:3', label: '竖图', description: '超长竖版卖点长图' },
  { value: '21:9', label: '横图', description: '超宽店招头图' },
  { value: '9:21', label: '竖图', description: '全屏竖版直播素材' },
] as const;

export type ImageAspectRatioValue = typeof IMAGE_ASPECT_RATIO_OPTIONS[number]['value'];

export type ImageAspectRatioOption = typeof IMAGE_ASPECT_RATIO_OPTIONS[number];

export const DEFAULT_IMAGE_ASPECT_RATIO: ImageAspectRatioValue = 'auto';

export function filterAspectRatioOptions(
  query: string,
  options: readonly ImageAspectRatioOption[] = IMAGE_ASPECT_RATIO_OPTIONS,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...options];
  }

  return options.filter((option) => {
    const haystack = `${option.value} ${option.label} ${option.description}`.toLowerCase();
    return haystack.includes(normalized);
  });
}
