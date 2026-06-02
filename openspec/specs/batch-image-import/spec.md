## ADDED Requirements

### Requirement: All upload surfaces support batch image import
The system SHALL allow every image upload surface in the application to import multiple images through drag-and-drop, multi-file picker selection, and focused paste from the clipboard.

#### Scenario: Drag and drop multiple images into an upload area
- **WHEN** the user drags 1 to 4 image files into any upload area
- **THEN** the upload area accepts the files as a single import batch
- **AND** the page displays all imported images from that batch

#### Scenario: Paste images into a focused upload area
- **WHEN** an upload area has focus and the user pastes image content from the clipboard
- **THEN** the system imports the pasted images into that upload area's current batch
- **AND** the paste action does not target unrelated text inputs or unfocused upload areas

#### Scenario: Select multiple images from the file picker
- **WHEN** the user chooses multiple image files from the file picker for any upload area
- **THEN** the system imports the selected files as a single batch
- **AND** the page displays all imported images from that batch

### Requirement: Single import batches are limited to four images
The system SHALL enforce a maximum of 4 images per import batch across every upload surface.

#### Scenario: Attempt to import more than four images
- **WHEN** the user imports more than 4 images in one drag, paste, or selection action
- **THEN** the system rejects the overflow beyond the first 4 allowed images
- **AND** the user receives feedback that a single batch supports at most 4 images

### Requirement: Imported images are stored locally by batch
The system SHALL persist imported images into project-local batch directories instead of keeping them only in transient renderer memory.

#### Scenario: Save a newly imported batch
- **WHEN** an import batch is accepted
- **THEN** the system creates or uses a batch-specific local directory under the project storage path
- **AND** each imported image is written into that directory with retrievable metadata
- **AND** the page uses the saved batch metadata to render the current imported image set
