export type ImageAspectOrientation = 'square' | 'landscape' | 'portrait';
export type OpenAIImageSize = '1024x1024' | '1536x1024' | '1024x1536' | 'auto';

export interface NormalizedImageAspectRatio {
  aspectRatio: string;
  orientation?: ImageAspectOrientation;
  openaiSize: OpenAIImageSize;
}

export function normalizeImageAspectRatio(value: string | undefined): NormalizedImageAspectRatio | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.toLowerCase() === 'auto') {
    return {
      aspectRatio: 'auto',
      openaiSize: 'auto',
    };
  }

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!match) {
    throw new Error('aspectRatio must be in "width:height" format');
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('aspectRatio values must be greater than zero');
  }

  const orientation = resolveOrientation(width, height);

  return {
    aspectRatio: `${stripTrailingZeros(match[1])}:${stripTrailingZeros(match[2])}`,
    orientation,
    openaiSize: orientation === 'square'
      ? '1024x1024'
      : orientation === 'landscape'
        ? '1536x1024'
        : '1024x1536',
  };
}

function resolveOrientation(width: number, height: number): ImageAspectOrientation {
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.000001) {
    return 'square';
  }

  return ratio > 1 ? 'landscape' : 'portrait';
}

function stripTrailingZeros(value: string) {
  return String(Number(value));
}
