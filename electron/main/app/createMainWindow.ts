import { BrowserWindow } from 'electron';
import path from 'node:path';
import { loadRenderer } from './loadRenderer.js';

export function createMainWindow(__dirname: string, rendererUrl: string | undefined, rendererIndexPath: string) {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#050505',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void loadRenderer(mainWindow, rendererUrl, rendererIndexPath);
}
