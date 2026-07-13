import { nativeImage } from 'electron';

export interface GeneratedImageDimensions {
  width: number;
  height: number;
}

export function inspectGeneratedImage(buffer: Uint8Array): GeneratedImageDimensions | undefined {
  if (buffer.byteLength === 0) {
    return undefined;
  }

  try {
    const image = nativeImage.createFromBuffer(Buffer.from(buffer));
    if (image.isEmpty()) {
      return undefined;
    }

    const { width, height } = image.getSize();
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return undefined;
    }

    return { width, height };
  } catch {
    return undefined;
  }
}

export function outputDimensionWarning(
  actual?: GeneratedImageDimensions,
  expected?: GeneratedImageDimensions,
): string | undefined {
  if (!actual || !expected || (actual.width === expected.width && actual.height === expected.height)) {
    return undefined;
  }

  return `模型返回尺寸 ${actual.width}x${actual.height}，与目标尺寸 ${expected.width}x${expected.height} 不一致`;
}
