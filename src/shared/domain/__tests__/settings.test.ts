import { describe, expect, it } from 'vitest';
import {
  createDefaultAppSettings,
  createRuntimeConfigFromSettings,
  redactAppSettings,
  resolveModelProtocolFromSettings,
} from '../settings';

describe('settings domain', () => {
  it('creates defaults required by the AI image task API', () => {
    const settings = createDefaultAppSettings('/tmp/tickpic-workspace');

    expect(settings).toEqual({
      schemaVersion: 1,
      n1nApiKey: '',
      baseUrl: 'https://api.n1n.ai',
      workspaceDir: '/tmp/tickpic-workspace',
      defaultModels: {
        generation: '',
        vision: '',
      },
      defaultCount: 1,
      maxCount: 2,
      maxConcurrentTasks: 5,
    });
  });

  it('redacts the API key before settings are returned to renderer', () => {
    const redacted = redactAppSettings({
      ...createDefaultAppSettings('/tmp/tickpic-workspace'),
      n1nApiKey: 'sk-live-secret-value',
    });

    expect('n1nApiKey' in redacted).toBe(false);
    expect(redacted.hasApiKey).toBe(true);
    expect(redacted.apiKeyPreview).toBe('sk-l...alue');
  });

  it('derives model protocol from baseUrl when not explicitly configured', () => {
    expect(resolveModelProtocolFromSettings({
      baseUrl: 'https://api.n1n.ai',
    })).toBe('openai');

    expect(resolveModelProtocolFromSettings({
      baseUrl: 'https://generativelanguage.googleapis.com',
    })).toBe('gemini');

    expect(resolveModelProtocolFromSettings({
      baseUrl: 'https://api.n1n.ai',
      modelProtocol: 'gemini',
    })).toBe('gemini');
  });

  it('converts settings into image task runtime config', () => {
    const runtimeConfig = createRuntimeConfigFromSettings({
      ...createDefaultAppSettings('/tmp/tickpic-workspace'),
      defaultModels: {
        generation: 'gpt-image-2-all',
        vision: 'gpt-5.4-mini',
      },
      modelProtocol: 'gemini',
      defaultCount: 3,
      maxCount: 6,
    });

    expect(runtimeConfig).toEqual({
      defaultModels: {
        generation: 'gpt-image-2-all',
        vision: 'gpt-5.4-mini',
      },
      modelProtocol: 'gemini',
      defaultCount: 3,
      maxCount: 6,
    });
  });
});
