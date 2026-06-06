import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getStoragePaths } from './services/storage/storagePaths.js';
import { registerDesktopHandlers } from './ipc/registerDesktopHandlers.js';
import { createMainWindow } from './app/createMainWindow.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rendererUrl = process.env.ELECTRON_RENDERER_URL;
const rendererIndexPath = path.join(__dirname, '../../../dist/index.html');

const paths = getStoragePaths(app.getPath('userData'));

app.whenReady().then(() => {
  registerDesktopHandlers({
    settingsFile: paths.settingsFile,
    defaultWorkspaceDir: paths.storageBase,
  });
  createMainWindow(__dirname, rendererUrl, rendererIndexPath);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(__dirname, rendererUrl, rendererIndexPath);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
