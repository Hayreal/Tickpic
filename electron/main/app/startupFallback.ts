import type { BrowserWindow } from 'electron';

export function showStartupHelp(mainWindow: BrowserWindow, failedUrl: string) {
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
