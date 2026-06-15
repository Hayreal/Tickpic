import { app, BrowserWindow, protocol } from 'electron';
import { APP_SHUTDOWN_MESSAGE } from './services/tasks/reconcileOrphanedTasks.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getStoragePaths } from './services/storage/storagePaths.js';
import { registerDesktopHandlers } from './ipc/registerDesktopHandlers.js';
import { createMainWindow } from './app/createMainWindow.js';
import { ensureMacActivation } from './app/ensureMacActivation.js';
import { getAppLogger } from './services/logger/appLogger.js';
import { LOCAL_FILE_PROTOCOL, registerLocalFileProtocol } from './services/storage/localFileProtocol.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rendererUrl = process.env.ELECTRON_RENDERER_URL;
const rendererIndexPath = path.join(__dirname, '../../../dist/index.html');

const paths = getStoragePaths(app.getPath('userData'));
let shutdownActiveTasks: ((message: string) => void) | undefined;

protocol.registerSchemesAsPrivileged([
  {
    scheme: LOCAL_FILE_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

app.whenReady().then(async () => {
  const logger = getAppLogger();
  logger.info('app', 'Electron 应用已就绪', { platform: process.platform, version: app.getVersion() });

  const activated = await ensureMacActivation(paths.activationFile, __dirname);
  if (!activated) {
    logger.info('app', '未完成激活，应用退出');
    return;
  }

  const desktopHandlers = registerDesktopHandlers({
    settingsFile: paths.settingsFile,
    defaultWorkspaceDir: paths.storageBase,
  });
  shutdownActiveTasks = desktopHandlers.shutdownActiveTasks;
  registerLocalFileProtocol({ resolveAuthorizedRoots: desktopHandlers.resolveAuthorizedRoots });
  createMainWindow(__dirname, rendererUrl, rendererIndexPath);
  logger.info('app', '主窗口已创建');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(__dirname, rendererUrl, rendererIndexPath);
      logger.info('app', '主窗口已重新创建');
    }
  });
});

app.on('before-quit', () => {
  getAppLogger().info('app', '应用即将退出');
  shutdownActiveTasks?.(APP_SHUTDOWN_MESSAGE);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    getAppLogger().info('app', '所有窗口已关闭，准备退出');
    app.quit();
  }
});
