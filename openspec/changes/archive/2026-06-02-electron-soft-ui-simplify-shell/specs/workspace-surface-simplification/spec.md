## ADDED Requirements

### Requirement: Workspace shell uses a softer visual palette
The system SHALL render the main workspace with a softer low-contrast color palette than the current dark violet shell while preserving readable navigation and content emphasis.

#### Scenario: Render main workspace shell
- **WHEN** the user opens the application
- **THEN** the workspace shell uses softened background, border, and accent colors
- **AND** primary content remains readable without relying on the previous high-contrast purple highlights

### Requirement: Window chrome simulation is removed
The system SHALL not render the simulated top window chrome that currently contains style toggles, title metadata, and close/minimize/maximize controls.

#### Scenario: Render top-level frame
- **WHEN** the main application frame is displayed
- **THEN** the content begins directly at the workspace body area
- **AND** no simulated titlebar controls or desktop-emulator labels are shown

### Requirement: Sidebar status block is removed
The system SHALL not render the sidebar footer status block that advertises GPU acceleration and local disk writing.

#### Scenario: Render sidebar footer area
- **WHEN** the sidebar is displayed
- **THEN** the footer status block is absent
- **AND** the sidebar ends after the primary navigation content
