export const IMAGE_COUNT_OPTIONS = [1, 2] as const;

export type ImageCountValue = typeof IMAGE_COUNT_OPTIONS[number];

export const DEFAULT_IMAGE_COUNT: ImageCountValue = 1;

export const MAX_IMAGE_COUNT: ImageCountValue = 2;

export function resolveImageCount(count: number): ImageCountValue {
  return (IMAGE_COUNT_OPTIONS as readonly number[]).includes(count)
    ? (count as ImageCountValue)
    : DEFAULT_IMAGE_COUNT;
}
