import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import type { AppSettings } from '../../../../src/shared/domain/settings.js';
import { createProtocolModelGateway } from './modelGateway.js';
import {
  createGeminiProtocolClient,
  createOpenAIProtocolClient,
} from './protocolClients.js';

export function createModelGatewayFromSettings(settings: AppSettings) {
  const apiKey = settings.n1nApiKey.trim();
  if (!apiKey) {
    throw new Error('n1n API Key is not configured');
  }

  console.log('[ModelGateway] Using baseUrl:', settings.baseUrl);
  console.log('[ModelGateway] API Key configured:', !!apiKey);

  const clientOptions = { baseUrl: settings.baseUrl };

  return createProtocolModelGateway({
    openai: createOpenAIProtocolClient(new OpenAI({
      apiKey,
      baseURL: normalizeOpenAIBaseUrl(settings.baseUrl),
    }), clientOptions),
    gemini: createGeminiProtocolClient(new GoogleGenAI({
      apiKey,
      httpOptions: {
        baseUrl: normalizeGeminiBaseUrl(settings.baseUrl),
      },
    }), clientOptions),
  });
}

export function normalizeOpenAIBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return /\/v\d+$/i.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

export function normalizeGeminiBaseUrl(baseUrl: string) {
  return baseUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v\d+(?:(?:alpha|beta)\d*)?$/i, '');
}
