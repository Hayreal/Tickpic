import { dialog, ipcMain } from 'electron';
import OpenAI from 'openai';
import { IPC_CHANNELS } from '../../../../src/shared/contracts/desktop.js';
import type { AppSettings } from '../../../../src/shared/domain/settings.js';
import { resolveModelProtocolFromSettings } from '../../../../src/shared/domain/settings.js';
import type { SettingsStore } from './settingsStore.js';
import { normalizeGeminiBaseUrl, normalizeOpenAIBaseUrl } from '../image-tasks/modelGatewayFactory.js';
import { getAppLogger } from '../logger/appLogger.js';

export interface RegisterSettingsServiceOptions {
  onSettingsSaved?: () => void | Promise<void>;
}

export function registerSettingsService(
  store: SettingsStore,
  options: RegisterSettingsServiceOptions = {},
) {
  const logger = getAppLogger();

  ipcMain.handle(IPC_CHANNELS.settings.get, () => {
    return store.loadRedacted();
  });

  ipcMain.handle(IPC_CHANNELS.settings.save, async (_event, settings: AppSettings) => {
    logger.info('settings', '保存应用设置', {
      baseUrl: settings.baseUrl,
      modelProtocol: settings.modelProtocol,
      workspaceDir: settings.workspaceDir,
      hasApiKey: Boolean(settings.n1nApiKey?.trim()),
    });
    await store.save(settings);
    await options.onSettingsSaved?.();
    logger.info('settings', '应用设置已保存');
  });

  ipcMain.handle(IPC_CHANNELS.settings.pickWorkspaceDir, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      logger.info('settings', '用户取消选择工作目录');
      return null;
    }
    logger.info('settings', '用户选择工作目录', { workspaceDir: result.filePaths[0] });
    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.settings.testConnection, async () => {
    logger.info('settings', '开始连接测试');
    const settings = await store.load();
    const apiKey = settings.n1nApiKey.trim();
    if (!apiKey) {
      logger.warn('settings', '连接测试失败：API Key 未配置');
      return { success: false, message: 'API Key 未配置' };
    }

    const protocol = resolveModelProtocolFromSettings(settings);

    if (protocol === 'gemini') {
      const url = `${normalizeGeminiBaseUrl(settings.baseUrl)}/v1beta/models`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        logger.warn('settings', 'Gemini 连接测试失败', { status: response.status });
        return { success: false, message: `连接失败: ${response.status} ${response.statusText}` };
      }
      logger.info('settings', 'Gemini 连接测试成功');
      return { success: true, message: '连接成功' };
    }

    const client = new OpenAI({
      apiKey,
      baseURL: normalizeOpenAIBaseUrl(settings.baseUrl),
    });

    try {
      await client.models.list();
      logger.info('settings', 'OpenAI 兼容连接测试成功');
      return { success: true, message: '连接成功' };
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        logger.warn('settings', '连接测试认证失败', { status });
        return { success: false, message: '认证失败，请检查 API Key' };
      }
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('settings', '连接测试失败', { message: msg, status });
      return { success: false, message: `握手测试失败：${msg}` };
    }
  });
}
