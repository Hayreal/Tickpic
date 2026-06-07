import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskRecord } from '../../shared/domain/tasks';
import Profile from '../Profile';

const openTaskOutputDirectory = vi.fn();
const resetOpenOutputDirectory = vi.fn();

vi.mock('../../hooks/useOpenOutputDirectory', () => ({
  useOpenOutputDirectory: () => ({
    openTaskOutputDirectory,
    resetOpenOutputDirectory,
  }),
}));

afterEach(() => {
  cleanup();
  openTaskOutputDirectory.mockReset();
  resetOpenOutputDirectory.mockReset();
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
  it('shows tasks in reverse chronological order with 10 rows per page', () => {
    const tasks = Array.from({ length: 12 }, (_, index) =>
      makeTask(index + 1, `2026-06-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`),
    );

    render(<Profile tasks={tasks} onRefresh={vi.fn()} />);

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

    render(<Profile tasks={[task]} onRefresh={vi.fn()} />);

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

    render(<Profile tasks={[task]} onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByText('贴纸复刻'));

    expect(screen.getByText('任务详情')).toBeInTheDocument();
    expect(screen.getByText('复刻贴纸风格')).toBeInTheDocument();
    expect(screen.getByAltText('source.png')).toBeInTheDocument();
    expect(screen.getByAltText('result.png')).toBeInTheDocument();
  });
});
