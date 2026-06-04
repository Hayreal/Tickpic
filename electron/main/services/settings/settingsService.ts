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
}
