import { createHash, timingSafeEqual } from 'node:crypto';

/** MD5 digest of the production activation code. */
export const ACTIVATION_CODE_MD5 = '24c8325b6edd4e97dc57f95df92fd5b3';

export function hashActivationCode(code: string): string {
  return createHash('md5').update(code.trim(), 'utf8').digest('hex');
}

export function verifyActivationCode(code: string): boolean {
  const digest = hashActivationCode(code);
  const expected = Buffer.from(ACTIVATION_CODE_MD5, 'utf8');
  const actual = Buffer.from(digest, 'utf8');

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
