import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';

const mockListTasks = vi.fn();

vi.mock('./hooks/useDesktopClient', () => ({
  useDesktopClient: () => ({
    listTasks: (...args: unknown[]) => mockListTasks(...args),
    createTask: vi.fn(),
    updateTask: vi.fn(),
  }),
}));

const mockRefresh = vi.fn();
let currentTasks: unknown[] = [];
vi.mock('./hooks/useDesktopTasks', () => ({
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

vi.mock('./components/StickerGen', () => ({
  default: () => <div data-testid="sticker-gen">StickerGen</div>,
}));
vi.mock('./components/ProductProcessing', () => ({
  default: () => <div data-testid="product-processing">ProductProcessing</div>,
}));
vi.mock('./components/Settings', () => ({
  default: () => <div data-testid="settings">Settings</div>,
}));

const profileTasksSpy = vi.fn();
vi.mock('./components/Profile', () => ({
  default: ({ tasks, onRefresh }: { tasks: { feature: string }[]; onRefresh: () => void }) => {
    profileTasksSpy(tasks);
    return (
      <div data-testid="profile">
        {tasks.map((t, i) => (
          <span key={i} data-testid="task-entry">{t.feature}</span>
        ))}
      </div>
    );
  },
}));

import App from './App';

describe('App shell', () => {
  beforeEach(() => {
    mockListTasks.mockReset();
    mockRefresh.mockReset();
    profileTasksSpy.mockReset();
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
});
