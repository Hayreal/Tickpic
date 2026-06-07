import { describe, expect, it } from 'vitest';
import {
  buildGeminiGenerateContentUrl,
  buildOpenAIChatCompletionsUrl,
  buildOpenAIImagesEditUrl,
  buildOpenAIImagesGenerateUrl,
} from '../modelRequestUrls';

describe('modelRequestUrls', () => {
  it('builds OpenAI-compatible request URLs', () => {
    expect(buildOpenAIChatCompletionsUrl('https://api.n1n.ai')).toBe(
      'https://api.n1n.ai/v1/chat/completions',
    );
    expect(buildOpenAIImagesGenerateUrl('https://api.n1n.ai/v1/')).toBe(
      'https://api.n1n.ai/v1/images/generations',
    );
    expect(buildOpenAIImagesEditUrl('https://api.n1n.ai/')).toBe(
      'https://api.n1n.ai/v1/images/edits',
    );
  });

  it('builds Gemini generateContent request URLs', () => {
    expect(buildGeminiGenerateContentUrl('https://api.n1n.ai', 'gemini-2.5-flash-image')).toBe(
      'https://api.n1n.ai/v1beta/models/gemini-2.5-flash-image:generateContent',
    );
    expect(buildGeminiGenerateContentUrl('https://api.n1n.ai/v1beta', 'models/gemini-3.1-flash-lite')).toBe(
      'https://api.n1n.ai/v1beta/models/gemini-3.1-flash-lite:generateContent',
    );
  });
});
