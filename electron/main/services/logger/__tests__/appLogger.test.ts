import { afterEach, describe, expect, it } from 'vitest';
import { createAppLogger, resetAppLoggerForTests } from '../appLogger.js';

afterEach(() => {
  resetAppLoggerForTests();
});

describe('appLogger', () => {
  it('stores entries and notifies subscribers', () => {
    const logger = createAppLogger();
    const received: string[] = [];

    logger.subscribe((entry) => {
      received.push(entry.message);
    });

    logger.info('app', '应用已启动');
    logger.warn('task', '发现孤儿任务', { taskId: 'task-1' });
    logger.error('settings', '连接失败', { status: 401 });

    const entries = logger.list();
    expect(entries).toHaveLength(3);
    expect(entries[0]?.source).toBe('app');
    expect(entries[1]?.level).toBe('warn');
    expect(entries[2]?.details).toContain('401');
    expect(received).toEqual(['应用已启动', '发现孤儿任务', '连接失败']);
  });

  it('redacts secrets in details', () => {
    const logger = createAppLogger();
    logger.info('settings', '保存设置', { n1nApiKey: 'sk-live-secret-value' });

    const entry = logger.list()[0];
    expect(entry?.details).toContain('[secret redacted]');
    expect(entry?.details).not.toContain('sk-live-secret-value');
  });

  it('keeps only the most recent entries', () => {
    const logger = createAppLogger();

    for (let index = 0; index < 505; index += 1) {
      logger.info('app', `log-${index}`);
    }

    const entries = logger.list();
    expect(entries).toHaveLength(500);
    expect(entries[0]?.message).toBe('log-5');
    expect(entries.at(-1)?.message).toBe('log-504');
  });
});
