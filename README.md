# Tickpic

Tickpic is a desktop-first Electron application for local creative workflows.

## Development

1. Install dependencies with `pnpm install`
2. Start renderer dev server with `pnpm dev`
3. Start Electron shell with `pnpm dev:electron`

## Desktop Build

- `pnpm desktop`
- `pnpm dist:win`

## Architecture

- `electron/` contains the desktop shell and local services
- `src/` contains the renderer UI for the desktop app
- local storage is managed by the Electron main process
