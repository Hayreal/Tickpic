import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../../src/shared/contracts/desktop.js';
import type { AppSettings } from '../../../../src/shared/domain/settings.js';
import type { SettingsStore } from './settingsStore.js';

export function registerSettingsService(store: SettingsStore) {
  ipcMain.handle(IPC_CHANNELS.settings.get, () => {
    return store.loadRedacted();
  });

  ipcMain.handle(IPC_CHANNELS.settings.save, (_event, settings: AppSettings) => {
    return store.save(settings);
  });

  ipcMain.handle(IPC_CHANNELS.settings.testConnection, async () => {
    const settings = await store.load();
    const apiKey = settings.n1nApiKey.trim();
    if (!apiKey) {
      throw new Error('API Key 未配置');
    }

    const isOpenAI = settings.baseUrl.includes('openai');
    const url = isOpenAI
      ? `${settings.baseUrl}/models`
      : `${settings.baseUrl}/v1beta/models`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`连接失败: ${response.status} ${response.statusText}`);
    }
    return { success: true, message: '连接成功' };
  });
}
