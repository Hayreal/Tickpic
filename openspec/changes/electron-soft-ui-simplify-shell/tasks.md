## 1. Desktop Shell Setup

- [x] 1.1 Add Electron runtime, packaging dependencies, and desktop build scripts.
- [x] 1.2 Create Electron main/preload entry files and wire them to the built renderer output.
- [x] 1.3 Add packaging configuration for Windows application artifacts.

## 2. Workspace Shell Simplification

- [x] 2.1 Remove the simulated top titlebar and related state/controls from the main frame component.
- [x] 2.2 Remove the sidebar footer status block and clean up resulting layout/styling.
- [x] 2.3 Soften the shared shell colors and background treatment across the main frame and sidebar.

## 3. Validation

- [x] 3.1 Run type/lint/build validation for the renderer and Electron entrypoints.
- [ ] 3.2 Run the Windows packaging command to verify the desktop bundle can be produced.

Packaging note: `pnpm dist:win` emitted `release/Tickpic Setup 0.0.0.exe`, but the command exited non-zero on this Linux host because `wine` is not installed for the final NSIS tooling step.
