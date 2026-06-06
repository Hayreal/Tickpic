import { dialog, ipcMain } from 'electron';
import OpenAI from 'openai';
import { IPC_CHANNELS } from '../../../../src/shared/contracts/desktop.js';
import type { AppSettings } from '../../../../src/shared/domain/settings.js';
import type { SettingsStore } from './settingsStore.js';
import { normalizeOpenAIBaseUrl } from '../image-tasks/modelGatewayFactory.js';

export interface RegisterSettingsServiceOptions {
  onSettingsSaved?: () => void | Promise<void>;
}

export function registerSettingsService(
  store: SettingsStore,
  options: RegisterSettingsServiceOptions = {},
) {
  ipcMain.handle(IPC_CHANNELS.settings.get, () => {
    return store.loadRedacted();
  });

  ipcMain.handle(IPC_CHANNELS.settings.save, async (_event, settings: AppSettings) => {
    await store.save(settings);
    await options.onSettingsSaved?.();
  });

  ipcMain.handle(IPC_CHANNELS.settings.pickWorkspaceDir, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.settings.testConnection, async () => {
    const settings = await store.load();
    const apiKey = settings.n1nApiKey.trim();
    if (!apiKey) {
      return { success: false, message: 'API Key 未配置' };
    }

    const isGeminiApi =
      settings.baseUrl.includes('google') || settings.baseUrl.includes('gemini');

    if (isGeminiApi) {
      const url = `${settings.baseUrl}/v1beta/models`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        return { success: false, message: `连接失败: ${response.status} ${response.statusText}` };
      }
      return { success: true, message: '连接成功' };
    }

    const client = new OpenAI({
      apiKey,
      baseURL: normalizeOpenAIBaseUrl(settings.baseUrl),
    });

    try {
      await client.models.list();
      return { success: true, message: '连接成功' };
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        return { success: false, message: '认证失败，请检查 API Key' };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `握手测试失败：${msg}` };
    }
  });
}
