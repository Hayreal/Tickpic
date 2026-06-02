import { describe, expect, it } from 'vitest';
import { hasDesktopStorageApi } from './desktopShell';

describe('hasDesktopStorageApi', () => {
  it('returns false when the preload bridge is unavailable', () => {
    expect(hasDesktopStorageApi()).toBe(false);
  });
});
