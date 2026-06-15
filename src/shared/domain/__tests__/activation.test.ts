import { describe, expect, it } from 'vitest';
import {
  ACTIVATION_CODE_MD5,
  hashActivationCode,
  verifyActivationCode,
} from '../activation';

describe('activation', () => {
  it('hashes the production activation code with MD5', () => {
    expect(hashActivationCode('potato20tic26')).toBe(ACTIVATION_CODE_MD5);
    expect(hashActivationCode('  potato20tic26  ')).toBe(ACTIVATION_CODE_MD5);
  });

  it('accepts the valid activation code', () => {
    expect(verifyActivationCode('potato20tic26')).toBe(true);
  });

  it('rejects invalid activation codes', () => {
    expect(verifyActivationCode('wrong-code')).toBe(false);
    expect(verifyActivationCode('')).toBe(false);
  });
});
