import { describe, expect, it } from 'vitest';
import { createDefaultAppSettings } from '../../../../../src/shared/domain/settings';
import {
  createModelGatewayFromSettings,
  normalizeGeminiBaseUrl,
  normalizeOpenAIBaseUrl,
} from '../modelGatewayFactory';

describe('modelGatewayFactory', () => {
  it('normalizes n1n base URL for OpenAI-compatible clients', () => {
    expect(normalizeOpenAIBaseUrl('https://api.n1n.ai')).toBe('https://api.n1n.ai/v1');
    expect(normalizeOpenAIBaseUrl('https://api.n1n.ai/v1')).toBe('https://api.n1n.ai/v1');
    expect(normalizeOpenAIBaseUrl('https://api.n1n.ai/')).toBe('https://api.n1n.ai/v1');
  });

  it('normalizes Gemini-compatible base URL without duplicating API version segments', () => {
    expect(normalizeGeminiBaseUrl('https://api.n1n.ai')).toBe('https://api.n1n.ai');
    expect(normalizeGeminiBaseUrl('https://api.n1n.ai/')).toBe('https://api.n1n.ai');
    expect(normalizeGeminiBaseUrl('https://api.n1n.ai/v1')).toBe('https://api.n1n.ai');
    expect(normalizeGeminiBaseUrl('https://api.n1n.ai/v1beta')).toBe('https://api.n1n.ai');
  });

  it('fails fast when API key is missing', () => {
    expect(() => createModelGatewayFromSettings(createDefaultAppSettings('/tmp/tickpic'))).toThrow(
      'n1n API Key is not configured',
    );
  });
});
