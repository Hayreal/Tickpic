import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rendererUrl = process.env.ELECTRON_RENDERER_URL;
const rendererIndexPath = path.join(__dirname, '../dist/index.html');

const storageBase = path.join(app.getPath('userData'), 'storage');
const importsDir = path.join(storageBase, 'imports');
const outputsDir = path.join(storageBase, 'outputs');
const tasksDir = path.join(storageBase, 'tasks');
const tasksFile = path.join(tasksDir, 'tasks.json');

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readTasksJson(): unknown[] {
  ensureDir(tasksDir);
  if (!fs.existsSync(tasksFile)) {
    fs.writeFileSync(tasksFile, '[]', 'utf-8');
  }
  return JSON.parse(fs.readFileSync(tasksFile, 'utf-8')) as unknown[];
}

function writeTasksJson(tasks: unknown[]) {
  ensureDir(tasksDir);
  fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2), 'utf-8');
}

function registerIpcHandlers() {
  ipcMain.handle('storage:save-import-batch', (_event, payload: {
    page: string;
    feature: string;
    files: { name: string; type: string; buffer: ArrayBuffer }[];
  }) => {
    const batchId = randomUUID();
    const batchDir = path.join(importsDir, payload.page, payload.feature, batchId);
    ensureDir(batchDir);

    const images = payload.files.map((file) => {
      const filePath = path.join(batchDir, file.name);
      fs.writeFileSync(filePath, Buffer.from(file.buffer));
      return {
        id: randomUUID(),
        fileName: file.name,
        filePath,
        fileSize: Buffer.from(file.buffer).byteLength,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
      };
    });

    return {
      batchId,
      page: payload.page,
      feature: payload.feature,
      images,
      createdAt: new Date().toISOString(),
    };
  });

  ipcMain.handle('storage:save-task-outputs', (_event, payload: {
    taskId: string;
    page: string;
    feature: string;
    outputs: { name: string; buffer: ArrayBuffer }[];
  }) => {
    const outputDir = path.join(outputsDir, payload.page, payload.feature, payload.taskId);
    ensureDir(outputDir);

    return payload.outputs.map((file) => {
      const filePath = path.join(outputDir, file.name);
      fs.writeFileSync(filePath, Buffer.from(file.buffer));
      return {
        id: randomUUID(),
        fileName: file.name,
        filePath,
        fileSize: Buffer.from(file.buffer).byteLength,
        mimeType: 'image/png',
        createdAt: new Date().toISOString(),
      };
    });
  });

  ipcMain.handle('tasks:list', () => {
    return readTasksJson();
  });

  ipcMain.handle('tasks:create', (_event, record: Record<string, unknown>) => {
    const tasks = readTasksJson();
    tasks.push(record);
    writeTasksJson(tasks);
  });

  ipcMain.handle('tasks:update', (_event, record: Record<string, unknown>) => {
    const tasks = readTasksJson() as Record<string, unknown>[];
    const idx = tasks.findIndex((t) => t.taskId === record.taskId);
    if (idx >= 0) {
      tasks[idx] = record;
    } else {
      tasks.push(record);
    }
    writeTasksJson(tasks);
  });
}

function showStartupHelp(mainWindow: BrowserWindow, failedUrl: string) {
  const html = `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <title>Tickpic 启动提示</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #ece4d9;
            color: #3c4454;
            font-family: sans-serif;
          }
          .card {
            width: min(720px, calc(100vw - 48px));
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.8);
            box-shadow: 0 24px 60px rgba(87, 93, 112, 0.18);
            padding: 28px;
          }
          h1 { margin: 0 0 12px; font-size: 28px; }
          p { margin: 0 0 12px; line-height: 1.6; }
          code {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 999px;
            background: #efe8f5;
            color: #705f8d;
          }
          pre {
            margin: 16px 0 0;
            padding: 16px;
            border-radius: 16px;
            background: #2b2f3a;
            color: #f2f4f8;
            overflow: auto;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>开发页面没有启动</h1>
          <p>Electron 试图加载 <code>${failedUrl}</code>，但这个地址当前不可用，所以你看到的是空白页。</p>
          <p>如果你要联调开发，请先运行：</p>
          <pre>pnpm dev
pnpm dev:electron</pre>
          <p>如果你只是想在本机 Linux 上直接打开应用，请改用：</p>
          <pre>pnpm desktop</pre>
        </div>
      </body>
    </html>
  `;

  void mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

async function loadRenderer(mainWindow: BrowserWindow) {
  if (rendererUrl) {
    mainWindow.webContents.once('did-fail-load', () => {
      showStartupHelp(mainWindow, rendererUrl);
    });
    await mainWindow.loadURL(rendererUrl);
    return;
  }

  if (!fs.existsSync(rendererIndexPath)) {
    showStartupHelp(mainWindow, rendererIndexPath);
    return;
  }

  await mainWindow.loadFile(rendererIndexPath);
}

function createMainWindow() {
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

  void loadRenderer(mainWindow);
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
