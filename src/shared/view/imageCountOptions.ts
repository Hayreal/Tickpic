export const IMAGE_COUNT_OPTIONS = [1, 2, 4, 8] as const;

export type ImageCountValue = typeof IMAGE_COUNT_OPTIONS[number];

export const DEFAULT_IMAGE_COUNT: ImageCountValue = 4;
