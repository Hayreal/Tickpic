import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACTIVATION_CODE_MD5 } from '../../../../../src/shared/domain/activation';
import { isActivated, markActivated } from '../activationStore';

describe('activationStore', () => {
  let tempDir: string;
  let activationFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'tickpic-activation-'));
    activationFile = path.join(tempDir, 'activation.json');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('reports inactive when no activation file exists', async () => {
    await expect(isActivated(activationFile)).resolves.toBe(false);
  });

  it('persists activation state after successful verification', async () => {
    await markActivated(activationFile);

    await expect(isActivated(activationFile)).resolves.toBe(true);
    await expect(readFile(activationFile, 'utf8')).resolves.toContain(ACTIVATION_CODE_MD5);
  });
});
