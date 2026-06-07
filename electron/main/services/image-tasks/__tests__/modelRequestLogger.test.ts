import { afterEach, describe, expect, it } from 'vitest';
import { getAppLogger, resetAppLoggerForTests } from '../../logger/appLogger.js';
import { logModelRequest, logModelResponse } from '../modelRequestLogger.js';

afterEach(() => {
  resetAppLoggerForTests();
});

describe('modelRequestLogger', () => {
  it('logs full sanitized request payload even when url is present', () => {
    logModelRequest('instruction', {
      protocol: 'openai',
      url: 'https://api.n1n.ai/v1/chat/completions',
      model: 'gpt-5.4-mini',
      messages: [{ role: 'user', content: 'generate sticker prompt' }],
    });

    const entry = getAppLogger().list().at(-1);
    expect(entry?.message).toBe('模型请求 (instruction)');
    expect(entry?.details).toContain('gpt-5.4-mini');
    expect(entry?.details).toContain('generate sticker prompt');
    expect(entry?.details).toContain('https://api.n1n.ai/v1/chat/completions');
  });

  it('logs sanitized model responses', () => {
    logModelResponse('execution', {
      protocol: 'openai',
      model: 'gpt-image-2',
      imageCount: 1,
      response: {
        data: [{ b64_json: 'a'.repeat(128) }],
      },
    });

    const entry = getAppLogger().list().at(-1);
    expect(entry?.message).toBe('模型响应 (execution)');
    expect(entry?.details).toContain('b64_json');
    expect(entry?.details).toMatch(/\[base64 redacted/);
    expect(entry?.details).not.toContain('a'.repeat(64));
  });
});
