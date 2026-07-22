import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageTaskRequest } from '../../shared/domain/imageFeatureApi';
import StickerGen from '../StickerGen';

const submitMany = vi.fn();
const bindTask = vi.fn(() => Promise.resolve(null));
const restoreTask = vi.fn();
const imageTaskGet = vi.fn(() => Promise.resolve(null));
const desktopClient = {
  copyImageToClipboard: vi.fn(),
  imageTask: {
    get: imageTaskGet,
  },
};

vi.mock('../../hooks/useImageTask', () => ({
  useImageTask: () => ({
    submitMany,
    bindTask,
    restoreTask,
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
  useDesktopClient: () => desktopClient,
}));

vi.mock('../../hooks/useAppLogs', () => ({
  useAppLogs: () => ({
    logs: [],
    isLoading: false,
  }),
}));

afterEach(() => {
  cleanup();
  submitMany.mockReset();
  bindTask.mockClear();
  restoreTask.mockClear();
  imageTaskGet.mockClear();
});

describe('StickerGen', () => {
  it('defaults sticker replica logo text to wkau', async () => {
    submitMany.mockResolvedValue(undefined);

    render(<StickerGen restoredTask={createStickerReplicaTask()} />);

    fireEvent.click(screen.getByText('高级参数'));

    const logoTextInput = await waitFor(() => {
      const input = document.getElementById('copy-logo-text-input') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      return input!;
    });
    expect(logoTextInput.value).toBe('wkau');

    fireEvent.click(document.getElementById('submit-sticker-copy')!);

    await waitFor(() => {
      expect(submitMany).toHaveBeenCalled();
    });
    const requests = submitMany.mock.calls[0][0] as ImageTaskRequest[];
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      feature: 'sticker_replica',
      logoText: 'wkau',
    });
  });

  it('defaults variation and original brand fields to wkau', async () => {
    render(<StickerGen />);

    fireEvent.click(document.getElementById('sticker-subtab-variation')!);
    fireEvent.click(screen.getByText('高级参数'));

    const variationBrandInput = await waitFor(() => {
      const input = document.getElementById('variation-brand-input') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      return input!;
    });
    expect(variationBrandInput.value).toBe('wkau');

    fireEvent.click(document.getElementById('sticker-subtab-original')!);
    fireEvent.click(screen.getByText('高级参数'));

    const originalBrandInput = await waitFor(() => {
      const input = document.getElementById('original-brand-input') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      return input!;
    });
    expect(originalBrandInput.value).toBe('wkau');
  });

  it('submits original sticker brand separately from logo text', async () => {
    submitMany.mockResolvedValue(undefined);

    render(<StickerGen />);

    fireEvent.click(document.getElementById('sticker-subtab-original')!);
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
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      feature: 'sticker_original',
      brand: 'wuku',
      productCategory: '汽车玻璃水',
    });
    expect(requests[0].productName).toBeUndefined();
    expect(requests[0]).not.toHaveProperty('logoText');
  });

  it('uses a styled sticker variation direction dropdown and submits the selected direction', async () => {
    submitMany.mockResolvedValue(undefined);

    render(<StickerGen restoredTask={createStickerVariationTask()} />);

    const directionButton = await waitFor(() => (
      screen.getByRole('button', { name: /裂变方向.*不指定/ })
    ));
    expect(document.getElementById('variation-direction-select')).not.toBeInstanceOf(HTMLSelectElement);

    fireEvent.click(directionButton);
    expect(screen.getByRole('listbox', { name: '裂变方向' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: /换色裂变/ }));
    fireEvent.click(document.getElementById('submit-sticker-variation')!);

    await waitFor(() => {
      expect(submitMany).toHaveBeenCalled();
    });
    const requests = submitMany.mock.calls[0][0] as ImageTaskRequest[];
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      feature: 'sticker_variation',
      stickerVariationDirection: 'color',
    });
  });

  it('omits sticker variation direction when none is selected', async () => {
    submitMany.mockResolvedValue(undefined);

    render(<StickerGen restoredTask={createStickerVariationTask()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /裂变方向.*不指定/ })).toBeInTheDocument();
    });

    fireEvent.click(document.getElementById('submit-sticker-variation')!);

    await waitFor(() => {
      expect(submitMany).toHaveBeenCalled();
    });
    const requests = submitMany.mock.calls[0][0] as ImageTaskRequest[];
    expect(requests[0].stickerVariationDirection).toBeUndefined();
    expect(requests[0].brand).toBe('wkau');
  });

  it('submits the sticker replica negative prompt with preserved newlines', async () => {
    submitMany.mockResolvedValue(undefined);
    render(<StickerGen restoredTask={createStickerReplicaTask()} />);
    fireEvent.click(screen.getByText('高级参数'));

    const input = await waitFor(() => document.getElementById('copy-negative-prompt-input')!);
    fireEvent.change(input, { target: { value: '禁止 BEST\n不要金色渐变' } });
    fireEvent.click(document.getElementById('submit-sticker-copy')!);

    await waitFor(() => expect(submitMany).toHaveBeenCalled());
    const requests = submitMany.mock.calls[0][0] as ImageTaskRequest[];
    expect(requests[0].negativePrompt).toBe('禁止 BEST\n不要金色渐变');
  });

  it('restores mode-specific negative prompts for variation and original tasks', async () => {
    const variationTask = createStickerVariationTask();
    variationTask.request.negativePrompt = '不要产品';
    const { unmount } = render(<StickerGen restoredTask={variationTask} />);

    fireEvent.click(screen.getByText('高级参数'));
    await waitFor(() => {
      expect((document.getElementById('variation-negative-prompt-input') as HTMLTextAreaElement).value)
        .toBe('不要产品');
    });
    unmount();

    render(<StickerGen restoredTask={createStickerOriginalTask('不要金色')} />);
    fireEvent.click(screen.getByText('高级参数'));
    await waitFor(() => {
      expect((document.getElementById('original-negative-prompt-input') as HTMLTextAreaElement).value)
        .toBe('不要金色');
    });
  });
});

function createStickerReplicaTask() {
  return {
    taskId: 'task-copy',
    batchId: 'batch-copy',
    category: '贴纸',
    feature: '贴纸复刻',
    status: 'Pending' as const,
    imports: [],
    outputs: [],
    request: {
      feature: 'sticker_replica' as const,
      images: [{ role: 'source' as const, path: '/authorized/input/package.png' }],
      count: 1,
    },
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-06-10T00:00:00.000Z',
  };
}

function createStickerVariationTask() {
  return {
    taskId: 'task-variation',
    batchId: 'batch-variation',
    category: '贴纸',
    feature: '贴纸裂变',
    status: 'Pending' as const,
    imports: [],
    outputs: [],
    request: {
      feature: 'sticker_variation' as const,
      images: [{ role: 'source' as const, path: '/authorized/input/sticker.png' }],
      count: 1,
    },
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-06-10T00:00:00.000Z',
  };
}

function createStickerOriginalTask(negativePrompt?: string) {
  return {
    taskId: 'task-original',
    batchId: 'batch-original',
    category: '贴纸',
    feature: '贴纸原创',
    status: 'Pending' as const,
    imports: [],
    outputs: [],
    request: {
      feature: 'sticker_original' as const,
      productCategory: '清洁剂',
      brand: 'wkau',
      negativePrompt,
      count: 1,
    },
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-06-10T00:00:00.000Z',
  };
}
