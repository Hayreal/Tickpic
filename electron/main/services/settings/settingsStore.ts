import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppSettings, RendererAppSettings } from '../../../../src/shared/domain/settings.js';
import {
  createDefaultAppSettings,
  redactAppSettings,
} from '../../../../src/shared/domain/settings.js';

interface StoredSettingsPayload extends Omit<AppSettings, 'n1nApiKey'> {
  n1nApiKey: string | EncryptedSecret;
}

interface EncryptedSecret {
  encrypted: true;
  iv: string;
  tag: string;
  value: string;
}

export interface SettingsStore {
  load(): Promise<AppSettings>;
  loadRedacted(): Promise<RendererAppSettings>;
  save(settings: AppSettings): Promise<void>;
}

export function createFileSettingsStore(settingsFile: string, defaultWorkspaceDir: string): SettingsStore {
  const encryptionKey = createHash('sha256')
    .update(`tickpic-settings:${settingsFile}`)
    .digest();

  return {
    async load() {
      try {
        const payload = JSON.parse(await readFile(settingsFile, 'utf-8')) as StoredSettingsPayload;
        return validateSettings({
          ...payload,
          n1nApiKey: decryptSecret(payload.n1nApiKey, encryptionKey),
        });
      } catch (error) {
        if (isMissingFileError(error)) {
          return createDefaultAppSettings(defaultWorkspaceDir);
        }
        throw error;
      }
    },

    async loadRedacted() {
      return redactAppSettings(await this.load());
    },

    async save(settings) {
      const current = await this.load();
      const merged = {
        ...settings,
        n1nApiKey: settings.n1nApiKey === '__KEEP_EXISTING__'
          ? current.n1nApiKey
          : settings.n1nApiKey,
      };
      const validated = validateSettings(merged);
      await mkdir(path.dirname(settingsFile), { recursive: true });
      const payload: StoredSettingsPayload = {
        ...validated,
        n1nApiKey: encryptSecret(validated.n1nApiKey, encryptionKey),
      };
      await writeFile(settingsFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
    },
  };
}

function validateSettings(settings: AppSettings): AppSettings {
  if (settings.schemaVersion !== 1) {
    throw new Error('schemaVersion must be 1');
  }

  try {
    new URL(settings.baseUrl);
  } catch {
    throw new Error('baseUrl must be a valid URL');
  }

  if (!settings.workspaceDir.trim()) {
    throw new Error('workspaceDir is required');
  }
  if (!settings.defaultModels.generation.trim()) {
    throw new Error('defaultModels.generation is required');
  }
  if (!Number.isInteger(settings.defaultCount) || settings.defaultCount <= 0) {
    throw new Error('defaultCount must be a positive integer');
  }
  if (!Number.isInteger(settings.maxCount) || settings.maxCount < settings.defaultCount) {
    throw new Error('maxCount must be greater than or equal to defaultCount');
  }
  if (!Number.isInteger(settings.maxConcurrentTasks) || settings.maxConcurrentTasks <= 0) {
    throw new Error('maxConcurrentTasks must be a positive integer');
  }

  return settings;
}

function encryptSecret(value: string, key: Buffer): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()]);

  return {
    encrypted: true,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    value: encrypted.toString('base64'),
  };
}

function decryptSecret(value: string | EncryptedSecret, key: Buffer): string {
  if (typeof value === 'string') {
    return value;
  }

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(value.value, 'base64')),
    decipher.final(),
  ]).toString('utf-8');
}

function isMissingFileError(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'ENOENT';
}
