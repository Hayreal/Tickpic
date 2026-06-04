import { describe, expect, it } from 'vitest';
import {
  createDefaultAppSettings,
  createRuntimeConfigFromSettings,
  redactAppSettings,
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
        vision: 'gemini-3.1-flash-lite',
        generation: 'gemini-2.5-flash-image',
        edit: 'gemini-2.5-flash-image',
      },
      modelProtocols: {
        'gemini-3.1-flash-lite': 'gemini',
        'gemini-2.5-flash-image': 'gemini',
        'gemini-3.1-flash-image-preview': 'gemini',
        'gpt-image-2': 'openai',
        'gpt-5.4-mini': 'openai',
      },
      defaultCount: 4,
      maxCount: 8,
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

  it('converts settings into image task runtime config', () => {
    const runtimeConfig = createRuntimeConfigFromSettings({
      ...createDefaultAppSettings('/tmp/tickpic-workspace'),
      defaultCount: 3,
      maxCount: 6,
    });

    expect(runtimeConfig).toEqual({
      defaultModels: {
        vision: 'gemini-3.1-flash-lite',
        generation: 'gemini-2.5-flash-image',
        edit: 'gemini-2.5-flash-image',
      },
      modelProtocols: expect.objectContaining({
        'gemini-2.5-flash-image': 'gemini',
        'gpt-image-2': 'openai',
      }),
      defaultCount: 3,
      maxCount: 6,
    });
  });
});
