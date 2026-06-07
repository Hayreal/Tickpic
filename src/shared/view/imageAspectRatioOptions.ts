export const IMAGE_ASPECT_RATIO_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: '1:1', label: '正方' },
  { value: '3:2', label: '横图' },
  { value: '2:3', label: '竖图' },
  { value: '4:3', label: '横图' },
  { value: '3:4', label: '竖图' },
  { value: '5:4', label: '横图' },
  { value: '4:5', label: '竖图' },
  { value: '16:9', label: '横图' },
  { value: '9:16', label: '竖图' },
  { value: '2:1', label: '横图' },
  { value: '1:2', label: '竖图' },
  { value: '3:1', label: '横图' },
  { value: '1:3', label: '竖图' },
  { value: '21:9', label: '横图' },
  { value: '9:21', label: '竖图' },
] as const;

export type ImageAspectRatioValue = typeof IMAGE_ASPECT_RATIO_OPTIONS[number]['value'];

export const DEFAULT_IMAGE_ASPECT_RATIO: ImageAspectRatioValue = 'auto';
