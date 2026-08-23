import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';

const mockListTasks = vi.fn();

vi.mock('../hooks/useDesktopClient', () => ({
  useDesktopClient: () => ({
    listTasks: (...args: unknown[]) => mockListTasks(...args),
    createTask: vi.fn(),
    updateTask: vi.fn(),
  }),
}));

const mockRefresh = vi.fn();
let currentTasks: unknown[] = [];
vi.mock('../hooks/useDesktopTasks', () => ({
  useDesktopTasks: () => ({
    tasks: currentTasks,
    taskService: {
      createTask: vi.fn(),
      startTask: vi.fn(),
      completeTask: vi.fn(),
      updateTask: vi.fn(),
      failTask: vi.fn(),
    },
    refresh: mockRefresh,
  }),
}));

vi.mock('../components/StickerGen', () => ({
  default: () => <div data-testid="sticker-gen">StickerGen</div>,
}));
vi.mock('../components/ProductProcessing', () => ({
  default: () => <div data-testid="product-processing">ProductProcessing</div>,
}));
vi.mock('../components/SkuGen', () => ({
  default: () => <div data-testid="sku-gen">SkuGen</div>,
}));
vi.mock('../components/Settings', () => ({
  default: () => <div data-testid="settings">Settings</div>,
}));

const profileTasksSpy = vi.fn();
vi.mock('../components/Profile', () => ({
  default: ({ tasks, onRefresh, onRestoreTask }: {
    tasks: { taskId: string; feature: string }[];
    onRefresh: () => void;
    onRestoreTask: (task: unknown) => void;
  }) => {
    profileTasksSpy(tasks);
    return (
      <div data-testid="profile">
        {tasks.map((t, i) => (
          <span key={i} data-testid="task-entry">{t.feature}</span>
        ))}
        <button type="button" onClick={() => onRestoreTask(tasks[0])}>restore first task</button>
      </div>
    );
  },
}));

const productImageSetSpy = vi.fn();
vi.mock('../components/ProductImageSet', () => ({
  default: ({ restoredTask, onRestoreConsumed }: {
    restoredTask: { taskId: string } | null;
    onRestoreConsumed: () => void;
  }) => {
    productImageSetSpy(restoredTask);
    return (
      <div data-testid="product-image-set">
        ProductImageSet {restoredTask?.taskId ?? 'empty'}
        {restoredTask ? <button type="button" onClick={onRestoreConsumed}>consume restore</button> : null}
      </div>
    );
  },
}));

import App from '../App';

describe('App shell', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mockListTasks.mockReset();
    mockRefresh.mockReset();
    profileTasksSpy.mockReset();
    productImageSetSpy.mockReset();
    currentTasks = [];
  });

  it('renders sidebar and default sticker tab', () => {
    render(<App />);
    expect(screen.getByTestId('sticker-gen')).toBeInTheDocument();
  });

  it('loads persisted tasks on mount through the desktop client', () => {
    currentTasks = [
      {
        taskId: 'task-1',
        batchId: 'batch-1',
        category: 'sticker',
        feature: '贴纸复刻',
        status: 'Completed',
        imports: [],
        outputs: [{ id: 'o1', fileName: 'a.png', filePath: '/a.png', fileSize: 1, mimeType: 'image/png', createdAt: '2026-06-03T00:00:00.000Z' }],
        createdAt: '2026-06-03T00:00:00.000Z',
        updatedAt: '2026-06-03T00:00:00.000Z',
      },
    ];

    render(<App />);

    // Switch to profile tab to see the loaded tasks
    fireEvent.click(document.getElementById('sidebar-tab-profile')!);

    const lastCall = profileTasksSpy.mock.calls[profileTasksSpy.mock.calls.length - 1];
    expect(lastCall[0]).toHaveLength(1);
    expect(lastCall[0][0].feature).toBe('贴纸复刻');
  });

  it('shows the product image set page from sidebar navigation', () => {
    render(<App />);

    fireEvent.click(document.getElementById('sidebar-tab-productSet')!);

    expect(screen.getByTestId('product-image-set')).toBeVisible();
  });

  it('shows the sku image gen page from sidebar navigation', () => {
    render(<App />);

    fireEvent.click(document.getElementById('sidebar-tab-sku')!);

    expect(screen.getByTestId('sku-gen')).toBeVisible();
  });

  it('restores a product multi-scene task from profile into the product image set page', () => {
    currentTasks = [{
      taskId: 'product-set-task',
      batchId: 'batch-1',
      category: '套图',
      feature: '多场景图',
      status: 'Completed',
      imports: [],
      outputs: [],
      request: { feature: 'product_multi_scene', count: 1, images: [] },
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z',
    }];
    render(<App />);

    fireEvent.click(document.getElementById('sidebar-tab-profile')!);
    fireEvent.click(screen.getByRole('button', { name: 'restore first task' }));

    expect(screen.getByTestId('product-image-set')).toBeVisible();
    expect(screen.getByTestId('product-image-set')).toHaveTextContent('product-set-task');
    fireEvent.click(screen.getByRole('button', { name: 'consume restore' }));
    expect(screen.getByTestId('product-image-set')).toHaveTextContent('empty');
  });
});
