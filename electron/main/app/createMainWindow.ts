import { BrowserWindow, nativeImage } from 'electron';
import path from 'node:path';
import { loadRenderer } from './loadRenderer.js';

function resolveWindowIcon(__dirname: string) {
  const iconPath = path.join(__dirname, '..', '..', '..', 'resources', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? undefined : icon;
}

export function createMainWindow(__dirname: string, rendererUrl: string | undefined, rendererIndexPath: string) {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#050505',
    autoHideMenuBar: true,
    icon: resolveWindowIcon(__dirname),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void loadRenderer(mainWindow, rendererUrl, rendererIndexPath);
}
