import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('package scripts', () => {
  it('starts Vite and waits for it before launching Electron', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.scripts['dev:electron']).toContain('concurrently');
    expect(packageJson.scripts['dev:electron']).toContain('pnpm dev');
    expect(packageJson.scripts['dev:electron']).toContain('pnpm dev:electron:app');
    expect(packageJson.scripts['dev:electron:app']).toContain('wait-on http://127.0.0.1:3000');
    expect(packageJson.scripts['dev:electron:app']).toContain(
      'cross-env ELECTRON_RENDERER_URL=http://127.0.0.1:3000',
    );
  });
});
