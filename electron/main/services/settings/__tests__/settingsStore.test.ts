import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultAppSettings } from '../../../../../src/shared/domain/settings';
import { createFileSettingsStore } from '../settingsStore';

function createSavableSettings(tempDir: string) {
  return {
    ...createDefaultAppSettings(tempDir),
    defaultModels: {
      generation: 'gpt-image-2-all',
      vision: 'gpt-5.4-mini',
    },
  };
}

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

  it('persists modelProtocol for n1n Gemini routing', async () => {
    const store = createFileSettingsStore(settingsFile, tempDir);
    const settings = {
      ...createSavableSettings(tempDir),
      n1nApiKey: 'sk-live-secret-value',
      baseUrl: 'https://api.n1n.ai',
      modelProtocol: 'gemini' as const,
    };

    await store.save(settings);

    await expect(store.load()).resolves.toEqual(settings);
    await expect(store.loadRedacted()).resolves.toMatchObject({
      modelProtocol: 'gemini',
      hasApiKey: true,
    });
  });

  it('saves settings without writing the raw API key to disk', async () => {
    const store = createFileSettingsStore(settingsFile, tempDir);
    const settings = {
      ...createSavableSettings(tempDir),
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
      ...createSavableSettings(tempDir),
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

  it('preserves existing API key when __KEEP_EXISTING__ sentinel is used', async () => {
    const store = createFileSettingsStore(settingsFile, tempDir);
    const initialSettings = {
      ...createSavableSettings(tempDir),
      n1nApiKey: 'sk-live-original-key',
    };

    await store.save(initialSettings);

    const updatedSettings = {
      ...createSavableSettings(tempDir),
      n1nApiKey: '__KEEP_EXISTING__',
      defaultCount: 5,
    };

    await store.save(updatedSettings);

    const loaded = await store.load();
    expect(loaded.n1nApiKey).toBe('sk-live-original-key');
    expect(loaded.defaultCount).toBe(5);
  });

  it('overwrites API key when new value is provided', async () => {
    const store = createFileSettingsStore(settingsFile, tempDir);
    const initialSettings = {
      ...createSavableSettings(tempDir),
      n1nApiKey: 'sk-live-old-key',
    };

    await store.save(initialSettings);

    const updatedSettings = {
      ...createSavableSettings(tempDir),
      n1nApiKey: 'sk-live-new-key',
    };

    await store.save(updatedSettings);

    const loaded = await store.load();
    expect(loaded.n1nApiKey).toBe('sk-live-new-key');
  });

  it('saves empty API key when explicitly provided', async () => {
    const store = createFileSettingsStore(settingsFile, tempDir);
    const initialSettings = {
      ...createSavableSettings(tempDir),
      n1nApiKey: 'sk-live-original-key',
    };

    await store.save(initialSettings);

    const updatedSettings = {
      ...createSavableSettings(tempDir),
      n1nApiKey: '',
    };

    await store.save(updatedSettings);

    const loaded = await store.load();
    expect(loaded.n1nApiKey).toBe('');
  });
});
