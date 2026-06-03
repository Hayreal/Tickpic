## ADDED Requirements

### Requirement: Application runs inside an Electron desktop shell
The system SHALL provide an Electron main process that launches the existing React workspace inside a desktop window for local use.

#### Scenario: Launch desktop application in development or production
- **WHEN** the application is started through the desktop entrypoint
- **THEN** an Electron `BrowserWindow` loads the rendered React application
- **AND** the user can use the existing workspace without opening a standalone browser tab

### Requirement: Application supports Windows packaging
The system SHALL expose a build path that produces a Windows-distributable desktop application artifact.

#### Scenario: Build Windows package
- **WHEN** the maintainer runs the Windows packaging command
- **THEN** the build process compiles the renderer and Electron processes
- **AND** emits a Windows application package in the configured output directory
