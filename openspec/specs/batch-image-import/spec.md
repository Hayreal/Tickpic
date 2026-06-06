## MODIFIED Requirements

### Requirement: Imported images are stored locally by batch
The system SHALL persist imported images into project-local batch directories by calling `desktop.saveImportBatch()` through the Main Process, instead of keeping them only in transient renderer memory. The saved file paths SHALL be used for subsequent image task submissions.

#### Scenario: Save a newly imported batch
- **WHEN** an import batch is accepted by the upload component
- **THEN** the system calls `desktop.saveImportBatch()` with the file data
- **AND** the Main Process writes each image to a batch-specific directory under the authorized imports path
- **AND** the returned `ImportBatch` contains disk file paths (not blob URLs)
- **AND** the page uses the saved batch metadata with disk paths to render the current imported image set

#### Scenario: Use persisted paths for image task submission
- **WHEN** the user starts a generation task with an imported batch
- **THEN** the image paths passed to `desktop.imageTask.submit()` are the disk paths from `saveImportBatch`
- **AND** the paths pass the Main Process's `requestSecurity` path validation

#### Scenario: Save import batch fails
- **WHEN** `desktop.saveImportBatch()` returns an error (disk full, permission denied)
- **THEN** the upload component displays the error to the user
- **AND** the images remain visible in the UI but are marked as unsaved
- **AND** the generate button is disabled until images are successfully persisted
