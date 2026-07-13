import { describe, expect, it, vi } from 'vitest';

const electronMock = vi.hoisted(() => ({
  createFromBuffer: vi.fn(),
}));

vi.mock('electron', () => ({
  nativeImage: {
    createFromBuffer: electronMock.createFromBuffer,
  },
}));

import { inspectGeneratedImage, outputDimensionWarning } from '../generatedImageDimensions';

describe('generatedImageDimensions', () => {
  it('returns native image dimensions for a readable generated image', () => {
    electronMock.createFromBuffer.mockReturnValue({
      isEmpty: () => false,
      getSize: () => ({ width: 2048, height: 1360 }),
    });

    expect(inspectGeneratedImage(new Uint8Array([1, 2, 3]))).toEqual({ width: 2048, height: 1360 });
  });

  it('returns undefined for empty, unreadable, or zero-sized image data', () => {
    electronMock.createFromBuffer
      .mockReturnValueOnce({ isEmpty: () => true, getSize: () => ({ width: 1, height: 1 }) })
      .mockReturnValueOnce({ isEmpty: () => false, getSize: () => ({ width: 0, height: 0 }) })
      .mockImplementationOnce(() => { throw new Error('unreadable'); });

    expect(inspectGeneratedImage(new Uint8Array([1]))).toBeUndefined();
    expect(inspectGeneratedImage(new Uint8Array([2]))).toBeUndefined();
    expect(inspectGeneratedImage(new Uint8Array([3]))).toBeUndefined();
    expect(inspectGeneratedImage(new Uint8Array())).toBeUndefined();
  });

  it('formats a warning only when actual dimensions differ from the target', () => {
    expect(outputDimensionWarning({ width: 2048, height: 1360 }, { width: 2048, height: 1360 })).toBeUndefined();
    expect(outputDimensionWarning({ width: 2048, height: 1360 }, { width: 1024, height: 680 }))
      .toBe('模型返回尺寸 2048x1360，与目标尺寸 1024x680 不一致');
  });
});
