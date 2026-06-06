import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  EYE_CARE_STORAGE_KEY,
  applyEyeCareClass,
  readEyeCareMode,
  writeEyeCareMode,
} from '../../shared/view/eyeCareMode';

describe('eyeCareMode', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('eye-care');
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('eye-care');
  });

  it('reads and writes persisted eye-care mode', () => {
    expect(readEyeCareMode()).toBe(false);
    writeEyeCareMode(true);
    expect(window.localStorage.getItem(EYE_CARE_STORAGE_KEY)).toBe('true');
    expect(readEyeCareMode()).toBe(true);
  });

  it('applies eye-care class on document root', () => {
    applyEyeCareClass(true);
    expect(document.documentElement.classList.contains('eye-care')).toBe(true);
    applyEyeCareClass(false);
    expect(document.documentElement.classList.contains('eye-care')).toBe(false);
  });
});
