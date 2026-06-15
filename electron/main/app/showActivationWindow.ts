import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
import { ACTIVATION_IPC_CHANNELS } from '../../../src/shared/contracts/activation.js';
import { verifyActivationCode } from '../../../src/shared/domain/activation.js';
import { buildActivationWindowHtml } from './activationWindowHtml.js';
import { markActivated } from '../services/activation/activationStore.js';

function resolveWindowIcon(electronDir: string) {
  const iconPath = path.join(electronDir, '..', '..', 'resources', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? undefined : icon;
}

export function showActivationWindow(activationFile: string, electronDir: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (activated: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      ipcMain.removeHandler(ACTIVATION_IPC_CHANNELS.submit);
      ipcMain.removeHandler(ACTIVATION_IPC_CHANNELS.cancel);
      resolve(activated);
    };

    const window = new BrowserWindow({
      width: 480,
      height: 360,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      title: 'Tickpic 激活',
      backgroundColor: '#050505',
      autoHideMenuBar: true,
      icon: resolveWindowIcon(electronDir),
      webPreferences: {
        preload: path.join(electronDir, '..', 'activation-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    ipcMain.handle(ACTIVATION_IPC_CHANNELS.submit, async (_event, code: unknown) => {
      if (typeof code !== 'string' || !code.trim()) {
        return { ok: false, message: '请输入激活码。' };
      }

      if (!verifyActivationCode(code)) {
        return { ok: false, message: '激活码无效，请检查后重试。' };
      }

      await markActivated(activationFile);
      finish(true);
      window.close();
      return { ok: true };
    });

    ipcMain.handle(ACTIVATION_IPC_CHANNELS.cancel, () => {
      finish(false);
      app.quit();
      return { ok: true };
    });

    window.on('closed', () => {
      if (!settled) {
        finish(false);
        app.quit();
      }
    });

    const html = buildActivationWindowHtml();
    void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).then(() => {
      window.show();
    });
  });
}
