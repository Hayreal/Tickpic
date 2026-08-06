import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskRecord } from '../../shared/domain/tasks';
import Profile from '../Profile';

const openTaskOutputDirectory = vi.fn();
const resetOpenOutputDirectory = vi.fn();
const copyImageToClipboard = vi.fn();

vi.mock('../../hooks/useOpenOutputDirectory', () => ({
  useOpenOutputDirectory: () => ({
    openTaskOutputDirectory,
    resetOpenOutputDirectory,
  }),
}));

vi.mock('../../hooks/useDesktopClient', () => ({
  useDesktopClient: () => ({
    copyImageToClipboard,
  }),
}));

vi.mock('../../hooks/useAppLogs', () => ({
  useAppLogs: () => ({
    logs: [
      {
        id: 'log-1',
        timestamp: '2026-06-07T10:00:00.000Z',
        level: 'info',
        source: 'app',
        message: 'Electron 应用已就绪',
      },
    ],
    isLoading: false,
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  openTaskOutputDirectory.mockReset();
  resetOpenOutputDirectory.mockReset();
  copyImageToClipboard.mockReset();
});

function makeTask(index: number, updatedAt: string): TaskRecord {
  return {
    taskId: `task-${index}`,
    batchId: `batch-${index}`,
    category: '贴纸',
    feature: `功能 ${index}`,
    status: 'Completed',
    imports: [],
    outputs: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('Profile', () => {
  it('shows application process logs instead of task metrics', () => {
    render(<Profile tasks={[]} onRefresh={vi.fn()} onRestoreTask={vi.fn()} />);

    expect(document.getElementById('profile-app-logs')).toBeInTheDocument();
    expect(document.getElementById('profile-dashboard-metrics')).not.toBeInTheDocument();
    expect(screen.getByText('应用进程日志')).toBeInTheDocument();
    expect(screen.getByText('Electron 应用已就绪')).toBeInTheDocument();
    expect(screen.queryByText('总任务数')).not.toBeInTheDocument();
  });

  it('shows tasks in reverse chronological order with 10 rows per page', () => {
    const tasks = Array.from({ length: 12 }, (_, index) =>
      makeTask(index + 1, `2026-06-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`),
    );

    render(<Profile tasks={tasks} onRefresh={vi.fn()} onRestoreTask={vi.fn()} />);

    const tableBody = document.getElementById('tasks-table-body')!;
    const rows = within(tableBody).getAllByRole('row');
    expect(rows).toHaveLength(10);
    expect(rows[0]).toHaveTextContent('功能 12');
    expect(rows[9]).toHaveTextContent('功能 3');
  });

  it('clears opening directory state when closing the drawer during an open request', async () => {
    let resolveOpen: (() => void) | undefined;
    openTaskOutputDirectory.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveOpen = resolve;
      }),
    );

    const task: TaskRecord = {
      taskId: 'task-opening',
      batchId: 'batch-opening',
      category: '贴纸',
      feature: '贴纸复刻',
      status: 'Completed',
      imports: [],
      outputs: [
        {
          id: 'output-1',
          fileName: 'result.png',
          filePath: '/tmp/result.png',
          fileSize: 1,
          mimeType: 'image/png',
          createdAt: '2026-06-03T10:05:00.000Z',
        },
      ],
      createdAt: '2026-06-03T10:00:00.000Z',
      updatedAt: '2026-06-03T10:05:00.000Z',
    };

    render(<Profile tasks={[task]} onRefresh={vi.fn()} onRestoreTask={vi.fn()} />);

    fireEvent.click(screen.getByText('贴纸复刻'));
    fireEvent.click(screen.getByText('打开输出目录'));
    expect(screen.getByText('打开中...')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('关闭任务详情'));
    await waitFor(() => {
      expect(screen.queryByText('打开中...')).not.toBeInTheDocument();
    });
    expect(resetOpenOutputDirectory).toHaveBeenCalled();

    resolveOpen?.();
  });

  it('opens a drawer with task parameters and output images', () => {
    const task: TaskRecord = {
      taskId: 'task-detail',
      batchId: 'batch-detail',
      category: '贴纸',
      feature: '贴纸复刻',
      status: 'Completed',
      imports: [
        {
          id: 'import-1',
          fileName: 'source.png',
          filePath: '/tmp/source.png',
          fileSize: 1,
          mimeType: 'image/png',
          createdAt: '2026-06-03T10:00:00.000Z',
        },
      ],
      outputs: [
        {
          id: 'output-1',
          fileName: 'result.png',
          filePath: '/tmp/result.png',
          fileSize: 1,
          mimeType: 'image/png',
          createdAt: '2026-06-03T10:05:00.000Z',
        },
      ],
      request: {
        feature: 'sticker_replica',
        prompt: '复刻贴纸风格',
        count: 1,
      },
      createdAt: '2026-06-03T10:00:00.000Z',
      updatedAt: '2026-06-03T10:05:00.000Z',
    };

    render(<Profile tasks={[task]} onRefresh={vi.fn()} onRestoreTask={vi.fn()} />);

    fireEvent.click(screen.getByText('贴纸复刻'));

    expect(screen.getByText('任务详情')).toBeInTheDocument();
    expect(screen.getByText('复刻贴纸风格')).toBeInTheDocument();
    expect(screen.getByAltText('source.png')).toBeInTheDocument();
    expect(screen.getByAltText('result.png')).toBeInTheDocument();
  });

  it('copies input and output images from the task detail drawer', async () => {
    copyImageToClipboard.mockResolvedValue({ mimeType: 'image/png' });

    const task: TaskRecord = {
      taskId: 'task-copy',
      batchId: 'batch-copy',
      category: '贴纸',
      feature: '贴纸复刻',
      status: 'Completed',
      imports: [
        {
          id: 'import-1',
          fileName: 'source.png',
          filePath: '/tmp/source.png',
          fileSize: 1,
          mimeType: 'image/png',
          createdAt: '2026-06-03T10:00:00.000Z',
        },
      ],
      outputs: [
        {
          id: 'output-1',
          fileName: 'result.png',
          filePath: '/tmp/result.png',
          fileSize: 1,
          mimeType: 'image/png',
          createdAt: '2026-06-03T10:05:00.000Z',
        },
      ],
      createdAt: '2026-06-03T10:00:00.000Z',
      updatedAt: '2026-06-03T10:05:00.000Z',
    };

    render(<Profile tasks={[task]} onRefresh={vi.fn()} onRestoreTask={vi.fn()} />);

    fireEvent.click(screen.getByText('贴纸复刻'));

    const copyButtons = screen.getAllByTitle('复制图片');
    expect(copyButtons).toHaveLength(2);

    fireEvent.click(copyButtons[0]);
    await waitFor(() => {
      expect(copyImageToClipboard).toHaveBeenCalledWith({ filePath: '/tmp/source.png' });
    });

    fireEvent.click(copyButtons[1]);
    await waitFor(() => {
      expect(copyImageToClipboard).toHaveBeenCalledWith({ filePath: '/tmp/result.png' });
    });
  });

  it('groups shared outputBatchId tasks into one batch row and drawer', () => {
    const sharedBatchId = 'batch-shared-id';
    const makeBatchTask = (taskId: string, status: TaskRecord['status']): TaskRecord => ({
      taskId,
      batchId: sharedBatchId,
      category: '贴纸',
      feature: '贴纸裂变',
      status,
      imports: [],
      outputs: status === 'Completed'
        ? [{
            id: `out-${taskId}`,
            fileName: `${taskId}.png`,
            filePath: `/tmp/${taskId}.png`,
            fileSize: 1,
            mimeType: 'image/png',
            createdAt: '2026-06-08T10:05:00.000Z',
          }]
        : [],
      request: { feature: 'sticker_variation', outputBatchId: sharedBatchId },
      createdAt: '2026-06-08T10:00:00.000Z',
      updatedAt: '2026-06-08T10:05:00.000Z',
    });

    render(
      <Profile
        tasks={[
          makeBatchTask('task-batch-1', 'Completed'),
          makeBatchTask('task-batch-2', 'Running'),
          makeTask(9, '2026-06-07T10:00:00.000Z'),
        ]}
        onRefresh={vi.fn()}
        onRestoreTask={vi.fn()}
      />,
    );

    expect(screen.getByText('批量任务 · 2 项')).toBeInTheDocument();
    expect(screen.getAllByText('贴纸裂变')).toHaveLength(1);

    fireEvent.click(screen.getByText('批量任务 · 2 项'));

    expect(screen.getByText('批量任务详情')).toBeInTheDocument();
    expect(screen.getByText('子任务')).toBeInTheDocument();
    expect(screen.getByText('输出图片 (1)')).toBeInTheDocument();
  });

  it('allows restoring only product image set batch representatives', () => {
    const onRestoreTask = vi.fn();
    const makeBatchTask = (taskId: string, feature: 'product_multi_scene' | 'sticker_variation'): TaskRecord => ({
      taskId,
      batchId: 'batch-shared',
      category: '套图',
      feature: feature === 'product_multi_scene' ? '多场景图' : '贴纸裂变',
      status: 'Completed',
      imports: [],
      outputs: [],
      request: { feature, outputBatchId: feature },
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: `2026-07-31T00:00:0${taskId.at(-1)}.000Z`,
    });
    const productTasks = [
      makeBatchTask('product-1', 'product_multi_scene'),
      makeBatchTask('product-2', 'product_multi_scene'),
    ];
    const stickerTasks = [
      makeBatchTask('sticker-1', 'sticker_variation'),
      makeBatchTask('sticker-2', 'sticker_variation'),
    ];

    render(<Profile tasks={[...productTasks, ...stickerTasks]} onRefresh={vi.fn()} onRestoreTask={onRestoreTask} />);

    const productRestore = document.getElementById('restore-task-product-2')!;
    const stickerRestore = document.getElementById('restore-task-sticker-2')!;
    expect(productRestore).toBeEnabled();
    expect(stickerRestore).toBeDisabled();

    fireEvent.click(productRestore);
    fireEvent.click(stickerRestore);
    expect(onRestoreTask).toHaveBeenCalledWith(productTasks[1]);
    expect(onRestoreTask).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByText('批量任务 · 2 项')[1]!);
    expect(screen.getByRole('button', { name: '还原到功能页' })).toBeDisabled();
  });

  it('restores a product image set batch from its detail drawer', () => {
    const onRestoreTask = vi.fn();
    const tasks: TaskRecord[] = ['product-1', 'product-2'].map((taskId) => ({
      taskId,
      batchId: 'batch-product-set',
      category: '套图',
      feature: '多场景图',
      status: 'Completed',
      imports: [],
      outputs: [],
      request: { feature: 'product_multi_scene', outputBatchId: 'batch-product-set' },
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z',
    }));
    render(<Profile tasks={tasks} onRefresh={vi.fn()} onRestoreTask={onRestoreTask} />);

    fireEvent.click(screen.getByText('批量任务 · 2 项'));
    fireEvent.click(screen.getByRole('button', { name: '还原到功能页' }));

    expect(onRestoreTask).toHaveBeenCalledWith(tasks[0]);
  });
});
