import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppLogList from '../AppLogList';

const writeText = vi.fn();

afterEach(() => {
  cleanup();
  writeText.mockReset();
});

describe('AppLogList', () => {
  it('copies a single log entry and all logs', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });
    writeText.mockResolvedValue(undefined);

    const logs = [
      {
        id: 'log-1',
        timestamp: '2026-06-08T10:00:05.000Z',
        level: 'info' as const,
        source: 'image-task' as const,
        message: '开始生成第 1/4 张图片',
        details: '{"taskId":"task-1"}',
      },
      {
        id: 'log-2',
        timestamp: '2026-06-08T10:00:06.000Z',
        level: 'warn' as const,
        source: 'model' as const,
        message: '模型响应 (execution)',
      },
    ];

    render(<AppLogList logs={logs} />);

    fireEvent.click(screen.getAllByTitle('复制日志')[0]);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('开始生成第 1/4 张图片'));
    });

    fireEvent.click(screen.getByRole('button', { name: '复制全部' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('模型响应 (execution)'));
    });
  });
});
