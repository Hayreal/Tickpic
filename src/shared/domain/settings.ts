import type { ImageModelProtocol } from './imageFeatureApi.js';
import type { ImageTaskRuntimeConfig } from './imageTaskPlan.js';

export const KEEP_EXISTING_API_KEY = '__KEEP_EXISTING__' as const;

export interface ImageStageModelSettings {
  /** Image generation / edit model */
  generation: string;
  /** Vision / instruction model for stage 1; must not be an image-only model */
  vision: string;
}

export interface AppSettings {
  schemaVersion: 1;
  n1nApiKey: string;
  baseUrl: string;
  workspaceDir: string;
  defaultModels: ImageStageModelSettings;
  /** Optional override; when omitted, derived from baseUrl at runtime. */
  modelProtocol?: ImageModelProtocol;
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
      generation: '',
      vision: '',
    },
    defaultCount: 1,
    maxCount: 8,
    maxConcurrentTasks: 5,
  };
}

export function resolveModelProtocolFromSettings(
  settings: Pick<AppSettings, 'baseUrl' | 'modelProtocol'>,
): ImageModelProtocol {
  if (settings.modelProtocol === 'openai' || settings.modelProtocol === 'gemini') {
    return settings.modelProtocol;
  }

  const baseUrl = settings.baseUrl.toLowerCase();
  if (baseUrl.includes('google') || baseUrl.includes('gemini')) {
    return 'gemini';
  }

  return 'openai';
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
    modelProtocol: resolveModelProtocolFromSettings(settings),
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
