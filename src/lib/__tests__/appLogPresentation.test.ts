import { describe, expect, it } from 'vitest';
import { formatAppLogEntriesText, formatAppLogEntryText } from '../appLogPresentation';

describe('appLogPresentation', () => {
  it('formats a single log entry for clipboard copy', () => {
    const text = formatAppLogEntryText({
      id: 'log-1',
      timestamp: '2026-06-08T10:00:05.000Z',
      level: 'info',
      source: 'image-task',
      message: '开始生成第 1/4 张图片',
      details: '{"taskId":"task-1"}',
    });

    expect(text).toContain('作图');
    expect(text).toContain('开始生成第 1/4 张图片');
    expect(text).toContain('{"taskId":"task-1"}');
  });

  it('joins multiple log entries with blank lines', () => {
    const text = formatAppLogEntriesText([
      {
        id: 'log-1',
        timestamp: '2026-06-08T10:00:05.000Z',
        level: 'info',
        source: 'model',
        message: '模型请求 (instruction)',
      },
      {
        id: 'log-2',
        timestamp: '2026-06-08T10:00:06.000Z',
        level: 'warn',
        source: 'storage',
        message: '保存输出',
      },
    ]);

    expect(text.split('\n\n')).toHaveLength(2);
  });
});
