import type { ImageAspectRatioValue } from '../shared/view/imageAspectRatioOptions';
import { IMAGE_ASPECT_RATIO_OPTIONS } from '../shared/view/imageAspectRatioOptions';
import { toDisplaySrc } from './fileUrl';

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return x || 1;
}

export function formatAspectRatio(width: number, height: number): string {
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

export function closestAspectRatioOption(width: number, height: number): ImageAspectRatioValue {
  const ratio = width / height;
  const exact = formatAspectRatio(width, height);
  const exactOption = IMAGE_ASPECT_RATIO_OPTIONS.find((option) => option.value === exact);
  if (exactOption) {
    return exactOption.value;
  }

  let best: ImageAspectRatioValue = '1:1';
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const option of IMAGE_ASPECT_RATIO_OPTIONS) {
    if (option.value === 'auto') {
      continue;
    }
    const [optionWidth, optionHeight] = option.value.split(':').map(Number);
    const diff = Math.abs(ratio - optionWidth / optionHeight);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = option.value;
    }
  }

  return best;
}

export function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => reject(new Error('failed to load image dimensions'));
    image.src = src;
  });
}

export async function inferStickerSourceAspectRatio(filePath: string): Promise<ImageAspectRatioValue> {
  const dimensions = await loadImageDimensions(toDisplaySrc(filePath));
  return closestAspectRatioOption(dimensions.width, dimensions.height);
}
