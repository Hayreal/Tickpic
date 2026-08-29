import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskRecord } from '../../shared/domain/tasks';
import SkuGen from '../SkuGen';

const submitMany = vi.fn();
const restoreTask = vi.fn();
const reset = vi.fn();
const getTask = vi.fn(() => null);
const getTasks = vi.fn(() => []);
const getError = vi.fn(() => null);
const imageTaskGet = vi.fn(() => Promise.resolve(null));
const listTasks = vi.fn(() => Promise.resolve([]));
const openActiveTaskDirectory = vi.fn(() => Promise.resolve());
const desktopClient = {
  listTasks,
  imageTask: { get: imageTaskGet },
};

vi.mock('../../hooks/useImageTask', () => ({
  useImageTask: () => ({
    submitMany,
    restoreTask,
    getTask,
    getTasks,
    getError,
    isSubmitting: false,
    reset,
  }),
}));

vi.mock('../../hooks/useOpenOutputDirectory', () => ({
  useOpenOutputDirectory: () => ({ openActiveTaskDirectory }),
}));

vi.mock('../../hooks/useDesktopClient', () => ({
  useDesktopClient: () => desktopClient,
}));

vi.mock('../../hooks/useOpenLocalImage', () => ({
  useOpenLocalImage: () => ({
    openPreview: vi.fn(),
    fallbackPreview: null,
    closeFallbackPreview: vi.fn(),
  }),
}));

vi.mock('../../hooks/useAppLogs', () => ({
  useAppLogs: () => ({ logs: [], isLoading: false }),
}));

afterEach(() => {
  cleanup();
  submitMany.mockReset();
  restoreTask.mockClear();
  reset.mockClear();
  imageTaskGet.mockClear();
  listTasks.mockClear();
});

describe('SkuGen hit main tab', () => {
  it('defaults brand fields to wkau on every sub tab', async () => {
    render(<SkuGen />);

    for (const subTab of ['replica', 'variation', 'original', 'hitMain'] as const) {
      fireEvent.click(document.getElementById(`sku-subtab-${subTab}`)!);
      await waitFor(() => {
        expect(document.getElementById(`sku-subtab-${subTab}`)).toHaveClass('ui-subtab-active');
      });

      const panel = document.getElementById('feature-parameters-panel')!;
      fireEvent.click(within(panel).getByRole('button', { name: /高级参数/ }));

      const brandInput = await waitFor(() => {
        const input = within(panel).getByLabelText('品牌') as HTMLInputElement;
        expect(input.id).toBe(`${subTab}-brand-input`);
        return input;
      });
      expect(brandInput.value).toBe('wkau');
    }
  });

  it('renders the fourth tab and required hit-main reference uploader', () => {
    render(<SkuGen />);

    fireEvent.click(screen.getByRole('button', { name: '爆款主图' }));

    expect(screen.getByText('爆款主图参考')).toBeTruthy();
    expect(screen.getByText('上传一张爆款电商主图作卖点与场景参考')).toBeTruthy();
    expect(screen.queryByText('可选')).toBeNull();
  });

  it('alerts when generating hit-main without the reference image', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    render(<SkuGen />);

    fireEvent.click(screen.getByRole('button', { name: '爆款主图' }));
    fireEvent.click(document.getElementById('submit-sku-hitMain')!);

    expect(alertSpy).toHaveBeenCalledWith('请上传 SKU 图');
    expect(submitMany).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('SkuGen restore', () => {
  it('restores every persisted task in a sku output batch', async () => {
    const first = createSkuVariationTask();
    const second = { ...createSkuVariationTask(), taskId: 'task-variation-2' };
    first.request!.outputBatchId = 'output-batch-1';
    second.request!.outputBatchId = 'output-batch-1';
    listTasks.mockResolvedValue([first, second]);

    render(<SkuGen restoredTask={first} />);

    await waitFor(() => expect(imageTaskGet).toHaveBeenCalledWith('task-variation-2'));
    expect(restoreTask).toHaveBeenCalledTimes(2);
    expect(reset).toHaveBeenCalledWith('sku_variation');
  });

  it('restores form state from the representative task', async () => {
    render(<SkuGen restoredTask={createSkuVariationTask()} />);

    await waitFor(() => {
      expect(document.getElementById('sku-subtab-variation')).toHaveClass('ui-subtab-active');
    });
    expect(document.getElementById('variation-count-selector')).toHaveAttribute('aria-label', '生成数量 6 张');
  });
});

function createSkuVariationTask(): TaskRecord {
  return {
    taskId: 'task-variation-1',
    batchId: 'batch-variation',
    category: 'SKU',
    feature: 'SKU 裂变',
    status: 'Completed',
    imports: [],
    outputs: [],
    request: {
      feature: 'sku_variation',
      images: [{ role: 'source', path: 'C:/sku/front.png' }],
      prompt: '差异化再大一点',
      count: 6,
    },
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  };
}
