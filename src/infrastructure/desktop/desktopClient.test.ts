import { describe, expect, it, vi } from 'vitest';
import { createDesktopClient } from './desktopClient';

describe('desktopClient', () => {
  it('returns undefined when the desktop bridge is unavailable', () => {
    const client = createDesktopClient(undefined);
    expect(client.isAvailable()).toBe(false);
  });
});
