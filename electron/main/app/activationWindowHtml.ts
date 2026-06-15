export function buildActivationWindowHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tickpic 激活</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #050505;
        color: #f5f5f5;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(420px, calc(100vw - 40px));
        padding: 28px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 24px;
        font-weight: 600;
      }
      p {
        margin: 0 0 20px;
        color: #a3a3a3;
        line-height: 1.5;
        font-size: 14px;
      }
      label {
        display: block;
        margin-bottom: 8px;
        font-size: 13px;
        color: #d4d4d4;
      }
      input {
        width: 100%;
        padding: 12px 14px;
        border-radius: 10px;
        border: 1px solid #3f3f46;
        background: #18181b;
        color: #fafafa;
        font-size: 14px;
        outline: none;
      }
      input:focus {
        border-color: #a78bfa;
        box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.2);
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
      }
      button {
        border: none;
        border-radius: 10px;
        padding: 10px 16px;
        font-size: 14px;
        cursor: pointer;
      }
      button.secondary {
        background: #27272a;
        color: #e4e4e7;
      }
      button.primary {
        background: #7c3aed;
        color: #fff;
      }
      button:disabled {
        opacity: 0.6;
        cursor: wait;
      }
      .error {
        min-height: 20px;
        margin-top: 12px;
        color: #f87171;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>激活 Tickpic</h1>
      <p>首次启动需要输入激活码。验证通过后将不再提示。</p>
      <form id="activation-form">
        <label for="activation-code">激活码</label>
        <input id="activation-code" type="password" autocomplete="off" spellcheck="false" />
        <div class="error" id="error"></div>
        <div class="actions">
          <button class="secondary" type="button" id="cancel">退出</button>
          <button class="primary" type="submit" id="submit">激活并继续</button>
        </div>
      </form>
    </div>
    <script>
      const form = document.getElementById('activation-form');
      const input = document.getElementById('activation-code');
      const error = document.getElementById('error');
      const submitButton = document.getElementById('submit');
      const cancelButton = document.getElementById('cancel');

      cancelButton.addEventListener('click', () => {
        window.activationShell.cancel();
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        error.textContent = '';
        submitButton.disabled = true;

        try {
          const result = await window.activationShell.submit(input.value);
          if (!result.ok) {
            error.textContent = result.message || '激活失败，请重试。';
          }
        } catch {
          error.textContent = '激活失败，请重试。';
        } finally {
          submitButton.disabled = false;
        }
      });

      input.focus();
    </script>
  </body>
</html>`;
}
