import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageTaskRequest } from '../../shared/domain/imageFeatureApi';
import StickerGen from '../StickerGen';

const submitMany = vi.fn();

vi.mock('../../hooks/useImageTask', () => ({
  useImageTask: () => ({
    submitMany,
    bindTask: vi.fn(),
    restoreTask: vi.fn(),
    getTask: vi.fn(() => null),
    getTasks: vi.fn(() => []),
    getError: vi.fn(() => null),
    isSubmitting: false,
    reset: vi.fn(),
  }),
}));

vi.mock('../../hooks/useOpenOutputDirectory', () => ({
  useOpenOutputDirectory: () => ({
    openActiveTaskDirectory: vi.fn(),
  }),
}));

vi.mock('../../hooks/useOpenLocalImage', () => ({
  useOpenLocalImage: () => ({
    openPreview: vi.fn(),
    fallbackPreview: null,
    closeFallbackPreview: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDesktopClient', () => ({
  useDesktopClient: () => ({
    copyImageToClipboard: vi.fn(),
  }),
}));

vi.mock('../../hooks/useAppLogs', () => ({
  useAppLogs: () => ({
    logs: [],
    isLoading: false,
  }),
}));

afterEach(() => {
  submitMany.mockReset();
});

describe('StickerGen', () => {
  it('does not submit original sticker product name as logo text', async () => {
    submitMany.mockResolvedValue(undefined);

    render(<StickerGen />);

    fireEvent.click(screen.getByText('贴纸原创'));
    fireEvent.click(screen.getByText('高级参数'));
    fireEvent.change(document.getElementById('original-category-input')!, {
      target: { value: '汽车玻璃水' },
    });
    fireEvent.change(document.getElementById('original-brand-input')!, {
      target: { value: 'wuku' },
    });

    fireEvent.click(document.getElementById('submit-sticker-original')!);

    await waitFor(() => {
      expect(submitMany).toHaveBeenCalled();
    });
    const requests = submitMany.mock.calls[0][0] as ImageTaskRequest[];
    expect(requests).toHaveLength(4);
    expect(requests[0]).toMatchObject({
      feature: 'sticker_original',
      productName: 'wuku',
      productCategory: '汽车玻璃水',
    });
    expect(requests[0]).not.toHaveProperty('logoText');
  });
});
