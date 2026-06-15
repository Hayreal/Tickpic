import fs from 'node:fs/promises';
import path from 'node:path';
import { ACTIVATION_CODE_MD5 } from '../../../../src/shared/domain/activation.js';

export interface ActivationRecord {
  activated: true;
  verifiedDigest: typeof ACTIVATION_CODE_MD5;
  activatedAt: string;
}

export async function isActivated(activationFile: string): Promise<boolean> {
  try {
    const raw = await fs.readFile(activationFile, 'utf8');
    const record = JSON.parse(raw) as Partial<ActivationRecord>;
    return record.activated === true && record.verifiedDigest === ACTIVATION_CODE_MD5;
  } catch {
    return false;
  }
}

export async function markActivated(activationFile: string): Promise<void> {
  const record: ActivationRecord = {
    activated: true,
    verifiedDigest: ACTIVATION_CODE_MD5,
    activatedAt: new Date().toISOString(),
  };

  await fs.mkdir(path.dirname(activationFile), { recursive: true });
  await fs.writeFile(activationFile, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}
