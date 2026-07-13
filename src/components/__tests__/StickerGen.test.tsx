import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageTaskRequest } from '../../shared/domain/imageFeatureApi';
import type { TaskRecord } from '../../shared/domain/tasks';
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
const { inferStickerSourceAspectRatio } = vi.hoisted(() => ({
  inferStickerSourceAspectRatio: vi.fn(() => Promise.resolve('7:5')),
}));

vi.mock('../../lib/aspectRatioFromImage', () => ({
  formatAspectRatio: (width: number, height: number) => width === 700 && height === 500
    ? '7:5'
    : `${width}:${height}`,
  inferStickerSourceAspectRatio,
}));

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
  it('submits the canonical replica output fields without legacy product or logo fields', async () => {
    submitMany.mockResolvedValue(undefined);

    render(<StickerGen restoredTask={createStickerReplicaTask()} />);

    fireEvent.click(screen.getByText('高级参数'));

    expect(document.getElementById('copy-logo-text-input')).toBeNull();
    expect(document.getElementById('copy-brand-input')).toHaveValue('wkau');
    fireEvent.change(document.getElementById('copy-brand-input')!, { target: { value: '   ' } });

    fireEvent.click(document.getElementById('submit-sticker-copy')!);

    await waitFor(() => {
      expect(submitMany).toHaveBeenCalled();
    });
    const requests = submitMany.mock.calls[0][0] as ImageTaskRequest[];
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      feature: 'sticker_replica',
      aspectRatio: '21:5',
      outputQuality: '1K',
      brand: 'wkau',
    });
    expect(requests[0]).not.toHaveProperty('productRatio');
    expect(requests[0]).not.toHaveProperty('logoText');
  });

  it('keeps output quality independent for each tab and submits a selected 2K value', async () => {
    submitMany.mockResolvedValue(undefined);
    render(<StickerGen restoredTask={createStickerReplicaTask()} />);

    fireEvent.click(screen.getByRole('button', { name: '2K' }));
    fireEvent.click(document.getElementById('sticker-subtab-variation')!);
    expect(screen.getByRole('button', { name: '1K' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(document.getElementById('sticker-subtab-copy')!);
    expect(screen.getByRole('button', { name: '2K' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(document.getElementById('submit-sticker-copy')!);
    await waitFor(() => expect(submitMany).toHaveBeenCalled());
    const requests = submitMany.mock.calls[0][0] as ImageTaskRequest[];
    expect(requests[0].outputQuality).toBe('2K');
  });

  it('shows capacity preview and non-blocking warning while keeping the logo upload', async () => {
    render(<StickerGen restoredTask={createStickerReplicaTask()} />);
    fireEvent.click(screen.getByText(/高级参数/));

    fireEvent.change(document.getElementById('copy-capacity-input')!, { target: { value: '100 ml' } });
    expect(screen.getByText('NET: 100ML / 3.38 FL.OZ')).toBeInTheDocument();
    fireEvent.change(document.getElementById('copy-capacity-input')!, { target: { value: 'family pack' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(document.getElementById('submit-sticker-copy')).not.toBeDisabled();
    expect(screen.getByLabelText(/Logo/)).toBeInTheDocument();
  });

  it('resolves auto output ratios from region, source or style before submission', async () => {
    submitMany.mockResolvedValue(undefined);
    const copyTask = createStickerReplicaTask();
    copyTask.request.aspectRatio = 'auto';
    copyTask.imports = [storedImage('/authorized/input/package.png')];
    copyTask.request.regions = [{ id: 'region-1', x: 0, y: 0, width: 700, height: 500 }];
    render(<StickerGen restoredTask={copyTask} />);
    fireEvent.click(document.getElementById('submit-sticker-copy')!);
    await waitFor(() => expect(submitMany).toHaveBeenCalled());
    expect((submitMany.mock.calls[0][0] as ImageTaskRequest[])[0].aspectRatio).toBe('7:5');

    cleanup();
    submitMany.mockClear();
    render(<StickerGen restoredTask={createStickerVariationTask()} />);
    fireEvent.click(document.getElementById('submit-sticker-variation')!);
    await waitFor(() => expect(submitMany).toHaveBeenCalled());
    expect((submitMany.mock.calls[0][0] as ImageTaskRequest[])[0].aspectRatio).toBe('7:5');

    cleanup();
    submitMany.mockClear();
    render(<StickerGen restoredTask={createStickerOriginalTask()} />);
    fireEvent.click(document.getElementById('submit-sticker-original')!);
    await waitFor(() => expect(submitMany).toHaveBeenCalled());
    expect((submitMany.mock.calls[0][0] as ImageTaskRequest[])[0].aspectRatio).toBe('7:5');

    cleanup();
    submitMany.mockClear();
    render(<StickerGen />);
    fireEvent.click(document.getElementById('sticker-subtab-original')!);
    fireEvent.click(document.getElementById('submit-sticker-original')!);
    await waitFor(() => expect(submitMany).toHaveBeenCalled());
    expect((submitMany.mock.calls[0][0] as ImageTaskRequest[])[0].aspectRatio).toBe('1:1');
  });

  it('disables an extreme custom ratio at 1K and re-enables it at 2K', () => {
    render(<StickerGen restoredTask={createStickerReplicaTask()} />);
    fireEvent.click(document.getElementById('copy-product-ratio-select')!);
    fireEvent.click(screen.getByRole('option', { name: /自定义/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '比例宽' }), { target: { value: '100' } });
    fireEvent.change(screen.getByRole('textbox', { name: '比例高' }), { target: { value: '1' } });
    expect(document.getElementById('submit-sticker-copy')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '2K' }));
    expect(document.getElementById('submit-sticker-copy')).not.toBeDisabled();
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
    expect(directionButton.parentElement?.parentElement).toHaveClass('sm:col-span-3');

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
});

function createStickerReplicaTask(): TaskRecord {
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
      aspectRatio: '21:5',
      outputQuality: '1K',
      brand: 'wkau',
    },
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-06-10T00:00:00.000Z',
  };
}

function createStickerVariationTask(): TaskRecord {
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

function createStickerOriginalTask(): TaskRecord {
  return {
    taskId: 'task-original',
    batchId: 'batch-original',
    category: '贴纸',
    feature: '贴纸原创',
    status: 'Pending',
    imports: [],
    outputs: [],
    request: {
      feature: 'sticker_original',
      images: [{ role: 'style', path: '/authorized/input/style.png' }],
      count: 1,
      aspectRatio: 'auto',
      brand: 'wkau',
    },
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-06-10T00:00:00.000Z',
  };
}

function storedImage(filePath: string) {
  return {
    id: 'source-0',
    fileName: 'package.png',
    filePath,
    fileSize: 1,
    mimeType: 'image/png',
    createdAt: '2026-06-10T00:00:00.000Z',
  };
}
