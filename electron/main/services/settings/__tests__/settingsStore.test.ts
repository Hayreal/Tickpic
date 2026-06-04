import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultAppSettings } from '../../../../../src/shared/domain/settings';
import { createFileSettingsStore } from '../settingsStore';

describe('settingsStore', () => {
  let tempDir: string;
  let settingsFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'tickpic-settings-'));
    settingsFile = path.join(tempDir, 'settings.json');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('loads default settings when no settings file exists', async () => {
    const store = createFileSettingsStore(settingsFile, tempDir);

    await expect(store.load()).resolves.toEqual(createDefaultAppSettings(tempDir));
  });

  it('saves settings without writing the raw API key to disk', async () => {
    const store = createFileSettingsStore(settingsFile, tempDir);
    const settings = {
      ...createDefaultAppSettings(tempDir),
      n1nApiKey: 'sk-live-secret-value',
      baseUrl: 'https://api.n1n.ai',
      defaultCount: 2,
    };

    await store.save(settings);

    const raw = await readFile(settingsFile, 'utf-8');
    expect(raw).not.toContain('sk-live-secret-value');
    await expect(store.load()).resolves.toEqual(settings);
  });

  it('returns redacted settings for renderer reads', async () => {
    const store = createFileSettingsStore(settingsFile, tempDir);
    await store.save({
      ...createDefaultAppSettings(tempDir),
      n1nApiKey: 'sk-live-secret-value',
    });

    const redacted = await store.loadRedacted();

    expect('n1nApiKey' in redacted).toBe(false);
    expect(redacted).toMatchObject({
      hasApiKey: true,
      apiKeyPreview: 'sk-l...alue',
    });
  });

  it('rejects invalid settings before saving', async () => {
    const store = createFileSettingsStore(settingsFile, tempDir);

    await expect(store.save({
      ...createDefaultAppSettings(tempDir),
      baseUrl: 'not a url',
    })).rejects.toThrow('baseUrl must be a valid URL');
  });
});
