import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ImageTaskRecord } from '../../shared/domain/imageFeatureApi';
import GenerationTaskStatus from '../GenerationTaskStatus';

afterEach(() => {
  cleanup();
});

describe('GenerationTaskStatus', () => {
  it('shows progress summary and filtered task logs', () => {
    const task: ImageTaskRecord = {
      taskId: 'task-progress',
      feature: 'remove_product',
      status: 'running',
      progress: { completed: 1, total: 4 },
      images: ['/tmp/output-1.png'],
      request: { feature: 'remove_product', count: 4 },
      createdAt: '2026-06-08T10:00:00.000Z',
      updatedAt: '2026-06-08T10:00:10.000Z',
    };

    render(
      <GenerationTaskStatus
        tasks={[task]}
        fallbackCount={4}
        logs={[
          {
            id: 'log-1',
            timestamp: '2026-06-08T10:00:05.000Z',
            level: 'info',
            source: 'image-task',
            message: '开始生成第 1/4 张图片',
            details: JSON.stringify({ taskId: 'task-progress' }),
          },
        ]}
      />,
    );

    expect(screen.getByText('AI 模型正在生成')).toBeInTheDocument();
    expect(screen.getByText('进度 1 / 4')).toBeInTheDocument();
    expect(screen.getByText('任务日志')).toBeInTheDocument();
    expect(screen.getByText('开始生成第 1/4 张图片')).toBeInTheDocument();
  });
});
