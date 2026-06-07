import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../../src/shared/contracts/desktop.js';
import type { AppLogger } from './appLogger.js';
import { getAppLogger } from './appLogger.js';

export function registerAppLogIpc(logger: AppLogger = getAppLogger()) {
  ipcMain.handle(IPC_CHANNELS.appLog.list, () => {
    return logger.list();
  });

  logger.subscribe((entry) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.appLog.entry, entry);
    }
  });
}
