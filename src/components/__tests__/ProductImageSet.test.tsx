import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImportBatch } from '../../shared/domain/images';
import type { ImageTaskRecord, ImageTaskRequest } from '../../shared/domain/imageFeatureApi';
import type { RendererAppSettings } from '../../shared/domain/settings';
import type { AppLogEntry } from '../../shared/domain/appLog';
import type { TaskRecord } from '../../shared/domain/tasks';
import ProductImageSet from '../ProductImageSet';

const submitMany = vi.fn<(requests: ImageTaskRequest[], options?: { outputBatchId?: string; forceOutputBatchId?: boolean }) => Promise<unknown[]>>(() => Promise.resolve([]));
const bindTask = vi.fn(() => Promise.resolve());
const restoreTask = vi.fn();
const reset = vi.fn();
const imageTaskGet = vi.fn(() => Promise.resolve(null));
const listTasks = vi.fn(() => Promise.resolve([]));
const openActiveTaskDirectory = vi.fn(() => Promise.resolve());
const copyImageToClipboard = vi.fn(() => Promise.resolve());
let activeTasks: ImageTaskRecord[] = [];
let appLogs: AppLogEntry[] = [];
let taskError: string | null = null;
let settings: Pick<RendererAppSettings, 'maxCount'> = { maxCount: 4 };
const desktopClient = {
  copyImageToClipboard,
  listTasks,
  settings: { get: vi.fn(() => Promise.resolve(settings)) },
  imageTask: { get: imageTaskGet },
};

vi.mock('../../hooks/useImageTask', () => ({
  useImageTask: () => ({
    submitMany,
    bindTask,
    restoreTask,
    getTask: vi.fn(() => activeTasks.at(-1) ?? null),
    getTasks: vi.fn(() => activeTasks),
    getError: vi.fn(() => taskError),
    isSubmitting: false,
    reset,
  }),
}));

vi.mock('../../hooks/useDesktopClient', () => ({
  useDesktopClient: () => desktopClient,
}));

vi.mock('../../hooks/useAppLogs', () => ({
  useAppLogs: () => ({ logs: appLogs, isLoading: false }),
}));

vi.mock('../../hooks/useOpenOutputDirectory', () => ({
  useOpenOutputDirectory: () => ({ openActiveTaskDirectory }),
}));

vi.mock('../GenerationTaskStatus', () => ({
  default: ({ tasks, logs, error }: { tasks: unknown[]; logs: Array<{ message: string }>; error: string | null }) => (
    <div data-testid="generation-status">{tasks.length} tasks {error} {logs.map((log) => log.message).join(' ')}</div>
  ),
}));

vi.mock('../GenerationResult', () => ({
  default: ({ results, onCopyImage, onOpenDirectory }: {
    results: Array<{ imageUrl: string }>;
    onCopyImage: (item: { imageUrl: string }) => void;
    onOpenDirectory: () => void;
  }) => (
    <div data-testid="generation-result">
      {results.map((result) => <button key={result.imageUrl} type="button" onClick={() => onCopyImage(result)}>copy {result.imageUrl}</button>)}
      <button type="button" onClick={onOpenDirectory}>open result directory</button>
    </div>
  ),
}));

vi.mock('../ImageUploader', () => ({
  default: ({ onBatchChange, label }: { onBatchChange: (batch: ImportBatch) => void; label: string }) => (
    <div>
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onBatchChange({
          batchId: 'sku-front',
          page: 'productSet',
          feature: 'product_main_image',
          createdAt: '2026-07-31T00:00:00.000Z',
          images: [
            { id: 'sku-front', fileName: 'front.png', filePath: 'C:/sku/front.png', fileSize: 0, mimeType: 'image/png', createdAt: '2026-07-31T00:00:00.000Z' },
            { id: 'sku-side', fileName: 'side.png', filePath: 'C:/sku/side.png', fileSize: 0, mimeType: 'image/png', createdAt: '2026-07-31T00:00:00.000Z' },
          ],
        })}
      >
        mock upload sku
      </button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  submitMany.mockClear();
  bindTask.mockClear();
  restoreTask.mockClear();
  reset.mockClear();
  imageTaskGet.mockClear();
  listTasks.mockClear();
  openActiveTaskDirectory.mockClear();
  copyImageToClipboard.mockClear();
  activeTasks = [];
  appLogs = [];
  taskError = null;
  settings = { maxCount: 4 };
  desktopClient.settings.get.mockClear();
});

describe('ProductImageSet', () => {
  it('renders three tabs and shared controls', () => {
    render(<ProductImageSet />);

    expect(document.getElementById('product-set-subtab-main')).toHaveTextContent('主图');
    expect(document.getElementById('product-set-subtab-comparison')).toHaveTextContent('对比图');
    expect(document.getElementById('product-set-subtab-multi-scene')).toHaveTextContent('多场景图');
    expect(screen.getByText('SKU 产品图')).toBeInTheDocument();
    expect(screen.getByText('图片比例')).toBeInTheDocument();
    expect(screen.getByText('生成数量')).toBeInTheDocument();
    expect(screen.queryByLabelText('提示词')).not.toBeInTheDocument();
  });

  it('submits two complete comparison requests', async () => {
    render(<ProductImageSet />);

    fireEvent.click(document.getElementById('product-set-subtab-comparison')!);
    fireEvent.click(screen.getByRole('button', { name: 'mock upload sku' }));
    fireEvent.click(document.getElementById('product-set-comparison-count')!);
    fireEvent.click(screen.getByRole('option', { name: '2 张' }));
    fireEvent.click(document.getElementById('submit-product-set-comparison')!);

    await waitFor(() => expect(submitMany).toHaveBeenCalledTimes(1));
    expect(submitMany.mock.calls[0]![0]).toEqual([
      expect.objectContaining({ feature: 'product_comparison_image', count: 1, variantIndex: 1, variantTotal: 2 }),
      expect.objectContaining({ feature: 'product_comparison_image', count: 1, variantIndex: 2, variantTotal: 2 }),
    ]);
  });

  it('rejects a product image set count above the system maximum without submitting', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    settings = { maxCount: 1 };
    render(<ProductImageSet />);

    fireEvent.click(screen.getByRole('button', { name: 'mock upload sku' }));
    fireEvent.click(document.getElementById('product-set-main-count')!);
    fireEvent.click(screen.getByRole('option', { name: '2 张' }));
    fireEvent.click(document.getElementById('submit-product-set-main')!);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('生成数量不能超过系统最大数量'));
    expect(submitMany).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('submits only once while settings are loading and submits after they resolve', async () => {
    let resolveSettings: (value: Pick<RendererAppSettings, 'maxCount'>) => void;
    desktopClient.settings.get.mockReturnValueOnce(new Promise((resolve) => { resolveSettings = resolve; }));
    render(<ProductImageSet />);

    fireEvent.click(screen.getByRole('button', { name: 'mock upload sku' }));
    const submitButton = document.getElementById('submit-product-set-main')!;
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    expect(desktopClient.settings.get).toHaveBeenCalledTimes(1);
    expect(submitMany).not.toHaveBeenCalled();

    resolveSettings!({ maxCount: 4 });
    await waitFor(() => expect(submitMany).toHaveBeenCalledTimes(1));
  });

  it('releases the submission guard when settings cannot be read', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    desktopClient.settings.get.mockRejectedValueOnce(new Error('settings unavailable'));
    render(<ProductImageSet />);

    fireEvent.click(screen.getByRole('button', { name: 'mock upload sku' }));
    const submitButton = document.getElementById('submit-product-set-main')!;
    fireEvent.click(submitButton);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('settings unavailable'));

    fireEvent.click(submitButton);
    await waitFor(() => expect(submitMany).toHaveBeenCalledTimes(1));
    expect(desktopClient.settings.get).toHaveBeenCalledTimes(2);
    alertSpy.mockRestore();
  });

  it('keeps successfully submitted tasks visible and opens the drawer after a later request fails', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    activeTasks = [createLiveTask('task-first')];
    taskError = 'second request failed';
    submitMany.mockRejectedValueOnce(new Error('second request failed'));
    render(<ProductImageSet />);

    fireEvent.click(screen.getByRole('button', { name: 'mock upload sku' }));
    fireEvent.click(document.getElementById('product-set-main-count')!);
    fireEvent.click(screen.getByRole('option', { name: '2 张' }));
    fireEvent.click(document.getElementById('submit-product-set-main')!);

    await waitFor(() => expect(document.getElementById('feature-task-drawer')).toBeInTheDocument());
    expect(screen.getByTestId('generation-status')).toHaveTextContent('1 tasks second request failed');
    expect(alertSpy).toHaveBeenCalledWith('second request failed');
    alertSpy.mockRestore();
  });

  it('shows the task state for its owning tab after switching away and back', () => {
    activeTasks = [{ ...createLiveTask('task-main'), feature: 'product_main_image' }];
    render(<ProductImageSet />);

    fireEvent.click(screen.getByText('任务信息'));
    expect(screen.getByTestId('generation-status')).toHaveTextContent('1 tasks');
    fireEvent.click(screen.getAllByLabelText('关闭任务信息')[1]!);
    fireEvent.click(document.getElementById('product-set-subtab-comparison')!);
    fireEvent.click(document.getElementById('product-set-subtab-main')!);
    fireEvent.click(screen.getByText('任务信息'));

    expect(screen.getByTestId('generation-status')).toHaveTextContent('1 tasks');
  });

  it('renders main defaults and submits all main-image controls', async () => {
    render(<ProductImageSet />);

    openAdvancedParameters();
    expect(screen.getByLabelText('提示词')).toHaveValue('');
    expect(screen.getByLabelText('反向提示词')).toHaveValue('');
    expect(screen.getByLabelText('具体场景词')).toHaveValue('');
    expect(document.getElementById('product-set-main-handheld-not_handheld')).toHaveClass('ui-segment-active');
    expect(document.getElementById('product-set-main-effect-auto')).toHaveClass('ui-segment-active');

    fireEvent.click(screen.getByRole('button', { name: 'mock upload sku' }));
    fireEvent.change(screen.getByLabelText('提示词'), { target: { value: ' premium display ' } });
    fireEvent.change(screen.getByLabelText('反向提示词'), { target: { value: ' no props ' } });
    fireEvent.change(screen.getByLabelText('具体场景词'), { target: { value: ' kitchen ' } });
    fireEvent.click(document.getElementById('product-set-main-handheld-handheld')!);
    fireEvent.click(document.getElementById('product-set-main-effect-show')!);
    fireEvent.click(document.getElementById('submit-product-set-main')!);

    await waitFor(() => expect(submitMany).toHaveBeenCalledTimes(1));
    expect(submitMany.mock.calls[0]![0][0]).toMatchObject({
      feature: 'product_main_image', prompt: 'premium display', negativePrompt: 'no props', scenePrompt: 'kitchen',
      productHandheldMode: 'handheld', productEffectMode: 'show',
    });
  });

  it('keeps enhanced fields isolated across tabs and allows an empty multi-scene prompt', async () => {
    render(<ProductImageSet />);

    openAdvancedParameters();
    fireEvent.change(screen.getByLabelText('提示词'), { target: { value: 'main prompt' } });
    fireEvent.click(document.getElementById('product-set-subtab-comparison')!);
    openAdvancedParameters();
    fireEvent.change(screen.getByLabelText('具体场景词'), { target: { value: 'bathroom' } });
    fireEvent.click(document.getElementById('product-set-comparison-layout-vertical')!);
    fireEvent.click(document.getElementById('product-set-comparison-show-product-false')!);
    fireEvent.click(document.getElementById('product-set-comparison-intensity-heavy')!);
    fireEvent.click(document.getElementById('product-set-subtab-main')!);
    expect(screen.getByLabelText('提示词')).toHaveValue('main prompt');
    fireEvent.click(document.getElementById('product-set-subtab-comparison')!);
    expect(screen.getByLabelText('具体场景词')).toHaveValue('bathroom');
    expect(document.getElementById('product-set-comparison-layout-vertical')).toHaveClass('ui-segment-active');
    expect(document.getElementById('product-set-comparison-show-product-false')).toHaveClass('ui-segment-active');
    expect(document.getElementById('product-set-comparison-intensity-heavy')).toHaveClass('ui-segment-active');

    fireEvent.click(document.getElementById('product-set-subtab-multi-scene')!);
    expect(document.getElementById('product-set-multiScene-layout-single')).toHaveClass('ui-segment-active');
    fireEvent.click(document.getElementById('product-set-multiScene-layout-grid')!);
    fireEvent.click(screen.getByRole('button', { name: 'mock upload sku' }));
    fireEvent.click(document.getElementById('submit-product-set-multiScene')!);

    await waitFor(() => expect(submitMany).toHaveBeenCalledTimes(1));
    expect(submitMany.mock.calls[0]![0][0]).toMatchObject({
      feature: 'product_multi_scene',
      multiSceneLayout: 'grid',
    });
    expect(submitMany.mock.calls[0]![0][0]).not.toHaveProperty('prompt');
  });

  it('keeps each tab form state when switching tabs', () => {
    render(<ProductImageSet />);

    fireEvent.click(document.getElementById('product-set-subtab-main')!);
    openAdvancedParameters();
    fireEvent.change(screen.getByLabelText('具体场景词'), { target: { value: 'kitchen' } });
    fireEvent.click(document.getElementById('product-set-subtab-comparison')!);
    openAdvancedParameters();
    fireEvent.click(document.getElementById('product-set-subtab-main')!);

    expect(screen.getByLabelText('具体场景词')).toHaveValue('kitchen');
  });

  it('restores a multi-scene task into its tab, prompt, and count', async () => {
    const liveTask = createLiveTask('task-scene');
    imageTaskGet.mockResolvedValueOnce(liveTask);
    render(<ProductImageSet restoredTask={createMultiSceneTask()} />);

    await waitFor(() => {
      expect(document.getElementById('product-set-subtab-multi-scene')).toHaveClass('ui-subtab-active');
    });
    openAdvancedParameters();
    expect(screen.getByLabelText('提示词')).toHaveValue('bathroom use');
    expect(document.getElementById('product-set-multiScene-layout-grid')).toHaveClass('ui-segment-active');
    expect(document.getElementById('product-set-multiScene-count')).toHaveAttribute('aria-label', '生成数量 2 张');
    await waitFor(() => expect(restoreTask).toHaveBeenCalledWith(liveTask));
    expect(bindTask).not.toHaveBeenCalled();
  });

  it('restores every persisted task in a product image set output batch', async () => {
    const first = createMultiSceneTask();
    const second = { ...createMultiSceneTask(), taskId: 'task-scene-2' };
    first.request.outputBatchId = 'output-batch-1';
    second.request.outputBatchId = 'output-batch-1';
    listTasks.mockResolvedValue([first, second]);

    render(<ProductImageSet restoredTask={first} />);

    await waitFor(() => expect(imageTaskGet).toHaveBeenCalledWith('task-scene-2'));
    expect(restoreTask).toHaveBeenCalledTimes(2);
  });

  it('finishes batch restoration before a consuming parent clears the restored task', async () => {
    let resolveTasks: (tasks: TaskRecord[]) => void;
    let resolveFirstLiveTask: (task: ImageTaskRecord | undefined) => void;
    let resolveSecondLiveTask: (task: ImageTaskRecord | undefined) => void;
    const first = createMultiSceneTask();
    const second = { ...createMultiSceneTask(), taskId: 'task-scene-2' };
    first.request!.outputBatchId = 'output-batch-1';
    second.request!.outputBatchId = 'output-batch-1';
    listTasks.mockReturnValueOnce(new Promise<TaskRecord[]>((resolve) => { resolveTasks = resolve; }));
    imageTaskGet
      .mockReturnValueOnce(new Promise<ImageTaskRecord | undefined>((resolve) => { resolveFirstLiveTask = resolve; }))
      .mockReturnValueOnce(new Promise<ImageTaskRecord | undefined>((resolve) => { resolveSecondLiveTask = resolve; }));
    const onRestoreConsumed = vi.fn();
    render(<RestoreHost task={first} onRestoreConsumed={onRestoreConsumed} />);

    expect(onRestoreConsumed).not.toHaveBeenCalled();
    resolveTasks!([first, second]);
    await waitFor(() => expect(imageTaskGet).toHaveBeenCalledWith('task-scene-2'));
    expect(onRestoreConsumed).not.toHaveBeenCalled();
    resolveFirstLiveTask!(createLiveTask('task-scene'));
    resolveSecondLiveTask!(createLiveTask('task-scene-2'));
    await waitFor(() => expect(onRestoreConsumed).toHaveBeenCalledTimes(1));
    expect(restoreTask).toHaveBeenCalledWith(createLiveTask('task-scene-2'));
  });

  it('resets the feature before each same-feature restore', async () => {
    const first = createMultiSceneTask();
    const second = { ...createMultiSceneTask(), taskId: 'task-scene-2' };
    const { rerender } = render(<ProductImageSet restoredTask={first} />);
    rerender(<ProductImageSet restoredTask={second} />);

    await waitFor(() => expect(reset).toHaveBeenCalledTimes(2));
    expect(reset).toHaveBeenNthCalledWith(1, 'product_multi_scene');
    expect(reset).toHaveBeenNthCalledWith(2, 'product_multi_scene');
  });

  it('clears the prior feature before restoring a different product image set feature', async () => {
    const mainTask = {
      ...createMultiSceneTask(),
      taskId: 'task-main',
      request: { ...createMultiSceneTask().request!, feature: 'product_main_image' as const },
    };
    const sceneTask = createMultiSceneTask();
    const { rerender } = render(<ProductImageSet restoredTask={mainTask} />);

    await waitFor(() => expect(restoreTask).toHaveBeenCalledWith(expect.objectContaining({ feature: 'product_main_image' })));
    rerender(<ProductImageSet restoredTask={sceneTask} />);

    await waitFor(() => expect(restoreTask).toHaveBeenCalledWith(expect.objectContaining({ feature: 'product_multi_scene' })));
    expect(reset).toHaveBeenNthCalledWith(1, 'product_main_image');
    expect(reset).toHaveBeenNthCalledWith(2, 'product_main_image');
    expect(reset).toHaveBeenNthCalledWith(3, 'product_multi_scene');
  });

  it('ignores a stale live task after another task is restored', async () => {
    let resolveFirst: (value: ImageTaskRecord | undefined) => void;
    const firstLiveTask = new Promise<ImageTaskRecord | undefined>((resolve) => {
      resolveFirst = resolve;
    });
    const secondLiveTask = createLiveTask('task-scene-2');
    imageTaskGet.mockReturnValueOnce(firstLiveTask).mockResolvedValueOnce(secondLiveTask);
    const first = createMultiSceneTask();
    const second = { ...createMultiSceneTask(), taskId: 'task-scene-2' };
    const onRestoreConsumed = vi.fn();

    const { rerender } = render(<ProductImageSet restoredTask={first} onRestoreConsumed={onRestoreConsumed} />);
    rerender(<ProductImageSet restoredTask={second} onRestoreConsumed={onRestoreConsumed} />);
    await waitFor(() => expect(restoreTask).toHaveBeenCalledWith(secondLiveTask));
    await waitFor(() => expect(onRestoreConsumed).toHaveBeenCalledTimes(1));
    resolveFirst!({
      taskId: 'stale-live-task', feature: 'product_multi_scene', images: [], status: 'completed',
      model: undefined, protocol: undefined, outputDir: undefined, requestJsonPath: undefined,
      imageInstructionPath: undefined, outputJsonPath: undefined, textNotes: undefined,
      warnings: [], createdAt: '', updatedAt: '', request: createMultiSceneTask().request,
    });

    await waitFor(() => {
      expect(restoreTask).not.toHaveBeenCalledWith(expect.objectContaining({ taskId: 'stale-live-task' }));
      expect(onRestoreConsumed).toHaveBeenCalledTimes(1);
    });
  });

  it('logs a rejected live task lookup while retaining the persisted fallback', async () => {
    const error = new Error('live task unavailable');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    imageTaskGet.mockRejectedValueOnce(error);
    const task = createMultiSceneTask();
    const onRestoreConsumed = vi.fn();
    render(<ProductImageSet restoredTask={task} onRestoreConsumed={onRestoreConsumed} />);

    await waitFor(() => expect(restoreTask).toHaveBeenCalledWith(expect.objectContaining({ taskId: task.taskId })));
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('恢复实时任务失败', task.taskId, error));
    expect(onRestoreConsumed).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });

  it('allows a new parent restore after consuming A and ignores A live completion', async () => {
    const taskA = createMultiSceneTask();
    const taskB = { ...createMultiSceneTask(), taskId: 'task-scene-b' };
    const liveA = createLiveTask('task-scene');
    const liveB = createLiveTask('task-scene-b');
    imageTaskGet.mockResolvedValueOnce(liveA).mockResolvedValueOnce(liveB);
    const consumed = vi.fn();
    render(<SequentialRestoreHost taskA={taskA} taskB={taskB} onRestoreConsumed={consumed} />);

    await waitFor(() => expect(consumed).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'restore B' }));
    await waitFor(() => expect(restoreTask).toHaveBeenCalledWith(liveB));
    await waitFor(() => expect(consumed).toHaveBeenCalledTimes(2));

    expect(restoreTask).toHaveBeenCalledWith(liveA);
    expect(consumed).toHaveBeenCalledTimes(2);
  });

  it('does not restore stale batch fallbacks after a later restore cancels its list', async () => {
    let resolveFirstBatch: (tasks: TaskRecord[]) => void;
    const first = createMultiSceneTask();
    const staleBatchTask = { ...createMultiSceneTask(), taskId: 'stale-batch-task' };
    const second = { ...createMultiSceneTask(), taskId: 'task-scene-2' };
    first.request!.outputBatchId = 'output-batch-1';
    staleBatchTask.request!.outputBatchId = 'output-batch-1';
    listTasks.mockReturnValueOnce(new Promise<TaskRecord[]>((resolve) => { resolveFirstBatch = resolve; }));

    const { rerender } = render(<ProductImageSet restoredTask={first} />);
    rerender(<ProductImageSet restoredTask={second} />);
    restoreTask.mockClear();
    resolveFirstBatch!([first, staleBatchTask]);

    await waitFor(() => {
      expect(restoreTask).not.toHaveBeenCalledWith(expect.objectContaining({ taskId: 'stale-batch-task' }));
    });
  });

  it('renders active task status, results, logs, and output actions', async () => {
    activeTasks = [{
      taskId: 'task-output', feature: 'product_main_image', images: ['C:/output/result.png'], status: 'completed',
      model: undefined, protocol: undefined, outputDir: 'C:/output', requestJsonPath: undefined,
      imageInstructionPath: undefined, outputJsonPath: undefined, textNotes: undefined, warnings: [],
      createdAt: '', updatedAt: '', request: { feature: 'product_main_image', count: 1, images: [] },
    }];
    appLogs = [{
      id: 'log-output', timestamp: '2026-07-31T00:00:01.000Z', level: 'info', source: 'image-task',
      message: 'task-output complete', details: 'task-output',
    }];
    render(<ProductImageSet />);
    fireEvent.click(screen.getByText('任务信息'));

    expect(screen.getByTestId('generation-status')).toHaveTextContent('1 tasks task-output complete');
    expect(screen.getByTestId('generation-result')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'copy C:/output/result.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'open result directory' }));

    await waitFor(() => expect(copyImageToClipboard).toHaveBeenCalledWith({ filePath: 'C:/output/result.png' }));
    expect(openActiveTaskDirectory).toHaveBeenCalledWith(activeTasks[0]);
  });
});

function createMultiSceneTask(): TaskRecord {
  return {
    taskId: 'task-scene', batchId: 'batch-scene', category: '套图', feature: '多场景图', status: 'Pending' as const,
    imports: [], outputs: [],
    request: {
      feature: 'product_multi_scene' as const,
      images: [{ role: 'product' as const, path: 'C:/sku/front.png' }],
      prompt: 'bathroom use', multiSceneLayout: 'grid', count: 1, variantIndex: 1, variantTotal: 2,
    },
    createdAt: '2026-07-31T00:00:00.000Z', updatedAt: '2026-07-31T00:00:00.000Z',
  };
}

function openAdvancedParameters() {
  if (!screen.queryByLabelText('提示词')) {
    fireEvent.click(screen.getByText('高级参数'));
  }
}

function createLiveTask(taskId: string): ImageTaskRecord {
  return {
    taskId,
    feature: 'product_multi_scene',
    images: [],
    status: 'completed',
    model: undefined,
    protocol: undefined,
    outputDir: undefined,
    requestJsonPath: undefined,
    imageInstructionPath: undefined,
    outputJsonPath: undefined,
    textNotes: undefined,
    warnings: [],
    createdAt: '',
    updatedAt: '',
    request: createMultiSceneTask().request!,
  };
}

function RestoreHost({ task, onRestoreConsumed }: { task: TaskRecord; onRestoreConsumed: () => void }) {
  const [restoredTask, setRestoredTask] = useState<TaskRecord | null>(task);
  return (
    <ProductImageSet
      restoredTask={restoredTask}
      onRestoreConsumed={() => {
        onRestoreConsumed();
        setRestoredTask(null);
      }}
    />
  );
}

function SequentialRestoreHost({
  taskA,
  taskB,
  onRestoreConsumed,
}: {
  taskA: TaskRecord;
  taskB: TaskRecord;
  onRestoreConsumed: () => void;
}) {
  const [restoredTask, setRestoredTask] = useState<TaskRecord | null>(taskA);
  return (
    <>
      <button type="button" onClick={() => setRestoredTask(taskB)}>restore B</button>
      <ProductImageSet
        restoredTask={restoredTask}
        onRestoreConsumed={() => {
          onRestoreConsumed();
          setRestoredTask(null);
        }}
      />
    </>
  );
}
