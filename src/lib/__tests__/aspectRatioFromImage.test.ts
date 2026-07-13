import { describe, expect, it, vi } from 'vitest';
import {
  closestAspectRatioOption,
  formatAspectRatio,
  inferStickerSourceAspectRatio,
} from '../aspectRatioFromImage';

describe('aspectRatioFromImage', () => {
  it('formats image dimensions into a simplified ratio', () => {
    expect(formatAspectRatio(800, 600)).toBe('4:3');
    expect(formatAspectRatio(1000, 1000)).toBe('1:1');
    expect(formatAspectRatio(700, 500)).toBe('7:5');
    expect(formatAspectRatio(1000, 333)).toBe('1000:333');
  });

  it('picks the closest supported ratio when exact match is unavailable', () => {
    expect(closestAspectRatioOption(700, 500)).toBe('4:3');
    expect(closestAspectRatioOption(1920, 1080)).toBe('16:9');
  });

  it('keeps the source image ratio exact instead of snapping it to a preset', async () => {
    vi.stubGlobal('Image', class {
      naturalWidth = 700;
      naturalHeight = 500;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    });

    await expect(inferStickerSourceAspectRatio('/authorized/input/sticker.png')).resolves.toBe('7:5');

    vi.unstubAllGlobals();
  });
});
