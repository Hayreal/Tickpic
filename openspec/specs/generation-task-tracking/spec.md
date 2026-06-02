## ADDED Requirements

### Requirement: Tasks are created only when generation starts
The system SHALL create a task record only after the user explicitly starts a generation flow, not when images are merely imported.

#### Scenario: Import images without starting generation
- **WHEN** the user imports one or more images into a page
- **THEN** no task record is created yet
- **AND** the imported batch remains available only as the current page input

#### Scenario: Start generation with an imported batch
- **WHEN** the user clicks the generation start action for a feature with a valid current batch
- **THEN** the system creates a task record with a task ID and batch ID
- **AND** the task starts in a pending or running state
- **AND** the task stores the batch's imported image records

### Requirement: Task records include import and output history
The system SHALL persist task records with generation status, import records, and output records for display in the personal center.

#### Scenario: Complete generation successfully
- **WHEN** a generation flow finishes successfully
- **THEN** the task status becomes completed
- **AND** the system stores the generated output records with local file metadata
- **AND** the personal center can display both import and output records for that task

#### Scenario: Generation fails after task creation
- **WHEN** a generation flow fails after the task record exists
- **THEN** the task status becomes failed
- **AND** the task still retains its import records
- **AND** the output record list is empty or partial based on what was produced before the failure
