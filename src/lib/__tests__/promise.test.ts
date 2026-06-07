import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from '../promise';

describe('withTimeout', () => {
  it('rejects when the promise does not settle in time', async () => {
    vi.useFakeTimers();

    const pending = new Promise<string>(() => {});
    const timed = withTimeout(pending, 1000, 'timeout');

    vi.advanceTimersByTimeAsync(1000);

    await expect(timed).rejects.toThrow('timeout');
    vi.useRealTimers();
  });

  it('resolves when the promise settles before timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'timeout')).resolves.toBe('ok');
  });
});
