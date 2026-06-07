import { normalizeGeminiBaseUrl, normalizeOpenAIBaseUrl } from './modelGatewayFactory.js';

export function buildOpenAIChatCompletionsUrl(baseUrl: string) {
  return `${normalizeOpenAIBaseUrl(baseUrl)}/chat/completions`;
}

export function buildOpenAIImagesGenerateUrl(baseUrl: string) {
  return `${normalizeOpenAIBaseUrl(baseUrl)}/images/generations`;
}

export function buildOpenAIImagesEditUrl(baseUrl: string) {
  return `${normalizeOpenAIBaseUrl(baseUrl)}/images/edits`;
}

export function buildGeminiGenerateContentUrl(baseUrl: string, model: string) {
  const root = normalizeGeminiBaseUrl(baseUrl);
  const modelPath = normalizeGeminiModelId(model);
  return `${root}/v1beta/${modelPath}:generateContent`;
}

function normalizeGeminiModelId(model: string) {
  const trimmed = model.trim();
  if (trimmed.startsWith('models/')) {
    return trimmed;
  }
  return `models/${trimmed}`;
}
