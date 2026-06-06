import type { ImageModelProtocol } from './imageFeatureApi.js';
import type { ImageTaskRuntimeConfig } from './imageTaskPlan.js';

export const KEEP_EXISTING_API_KEY = '__KEEP_EXISTING__' as const;

export interface ImageStageModelSettings {
  generation: string;
}

export interface AppSettings {
  schemaVersion: 1;
  n1nApiKey: string;
  baseUrl: string;
  workspaceDir: string;
  defaultModels: ImageStageModelSettings;
  modelProtocols: Record<string, ImageModelProtocol>;
  defaultCount: number;
  maxCount: number;
  maxConcurrentTasks: number;
}

export type RendererAppSettings = Omit<AppSettings, 'n1nApiKey'> & {
  hasApiKey: boolean;
  apiKeyPreview?: string;
};

export function createDefaultAppSettings(workspaceDir: string): AppSettings {
  return {
    schemaVersion: 1,
    n1nApiKey: '',
    baseUrl: 'https://api.n1n.ai',
    workspaceDir,
    defaultModels: {
      generation: 'gemini-2.5-flash-image',
    },
    modelProtocols: {
      'gemini-3.1-flash-lite': 'gemini',
      'gemini-2.5-flash-image': 'gemini',
      'gemini-3.1-flash-image-preview': 'gemini',
      'gpt-image-2': 'openai',
      'gpt-5.4-mini': 'openai',
    },
    defaultCount: 1,
    maxCount: 8,
    maxConcurrentTasks: 5,
  };
}

export function redactAppSettings(settings: AppSettings): RendererAppSettings {
  const { n1nApiKey, ...rest } = settings;
  return {
    ...rest,
    hasApiKey: n1nApiKey.trim().length > 0,
    apiKeyPreview: n1nApiKey.trim().length > 0 ? previewSecret(n1nApiKey) : undefined,
  };
}

export function createRuntimeConfigFromSettings(settings: AppSettings): ImageTaskRuntimeConfig {
  return {
    defaultModels: settings.defaultModels,
    modelProtocols: settings.modelProtocols,
    defaultCount: settings.defaultCount,
    maxCount: settings.maxCount,
  };
}

function previewSecret(value: string) {
  if (value.length <= 8) {
    return '****';
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
